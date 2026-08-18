import webpush from "web-push";
import { queryPostgres } from "@/lib/postgres/client";
import { reportError } from "@/lib/report-error";

/**
 * Reaching the owner's phone the moment something happens.
 *
 * The shop tells a customer "we will call you shortly to confirm", and until
 * now the only way the owner learned an order existed was an email, or opening
 * the admin app and looking. An order placed at nine at night went unseen until
 * morning — the promise broken by nobody, simply by nobody being told.
 *
 * Web Push carries the message through the browser's own push service (Google's
 * on Android and Chrome, Apple's on iPhone). The payload is encrypted so that
 * service delivers a message it cannot itself read, which is why a subscription
 * carries two keys as well as an address.
 *
 * Nothing here throws at the caller. A push that fails must never take an order
 * down with it: the order is the thing that matters, the notification is a
 * convenience on top of it.
 */

const STORE = "notifications";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = {
  title: string;
  body: string;
  /** Where clicking should land. Defaults to the admin home. */
  url?: string;
  tag?: string;
};

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string;
};

/**
 * The VAPID identity, or null when it has not been set up.
 *
 * The public half is also served to the browser, so it is NEXT_PUBLIC_; the
 * private half signs the request that proves the push came from this shop and
 * must never be. Both are checked together because half a keypair produces an
 * authentication error from the push service that says nothing about keys.
 */
function vapid() {
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const subject = (process.env.VAPID_SUBJECT ?? "mailto:skschhapal@gmail.com").trim();

  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function pushConfigured() {
  return vapid() !== null;
}

/** Records a browser so it can be reached later. */
export async function savePushSubscription(
  subscription: PushSubscriptionInput,
  options: { staffId?: string; label?: string } = {},
) {
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { ok: false as const, reason: "यो browser ले push दिन सकेन।" };
  }

  // Re-subscribing the same browser has to update rather than insert, or every
  // notification would arrive twice on a device that was simply re-enabled.
  await queryPostgres(
    STORE,
    `
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, staff_id, label)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (endpoint) DO UPDATE
        SET p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            staff_id = EXCLUDED.staff_id,
            label = EXCLUDED.label
    `,
    [
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      options.staffId ?? null,
      options.label ?? "",
    ],
  );

  return { ok: true as const };
}

export async function removePushSubscription(endpoint: string) {
  await queryPostgres(STORE, `DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

export async function listPushSubscriptions() {
  return queryPostgres<SubscriptionRow & { last_used_at: Date | null }>(
    STORE,
    `SELECT endpoint, p256dh, auth, label, last_used_at FROM push_subscriptions ORDER BY created_at DESC`,
  );
}

/**
 * Sends one message to every subscribed device.
 *
 * Returns counts rather than throwing, and reports rather than rethrows, so a
 * push outage can never fail the order that triggered it.
 *
 * 404 and 410 are the push service saying a subscription is permanently gone —
 * the browser was uninstalled, or the permission revoked. Those rows are
 * deleted, because keeping them means every future notification waits on a
 * request that can only fail.
 */
export async function sendPushToStaff(payload: PushPayload) {
  const keys = vapid();
  if (!keys) return { sent: 0, failed: 0, skipped: true as const };

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  let subscriptions: SubscriptionRow[];
  try {
    subscriptions = await queryPostgres<SubscriptionRow>(
      STORE,
      `SELECT endpoint, p256dh, auth, label FROM push_subscriptions`,
    );
  } catch (error) {
    reportError("read push subscriptions", error);
    return { sent: 0, failed: 0, skipped: false as const };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/admin",
    tag: payload.tag,
  });

  const results = await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
        );
        await queryPostgres(
          STORE,
          `UPDATE push_subscriptions SET last_used_at = now() WHERE endpoint = $1`,
          [row.endpoint],
        );
        return true;
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await queryPostgres(STORE, `DELETE FROM push_subscriptions WHERE endpoint = $1`, [
            row.endpoint,
          ]).catch(() => undefined);
        } else {
          reportError(`push to ${row.label || "a device"}`, error);
        }
        return false;
      }
    }),
  );

  return {
    sent: results.filter(Boolean).length,
    failed: results.filter((ok) => !ok).length,
    skipped: false as const,
  };
}
