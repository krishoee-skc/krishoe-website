import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  pushConfigured,
  removePushSubscription,
  savePushSubscription,
  sendPushToStaff,
} from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

/**
 * Registering the device an alert should reach.
 *
 * Behind the admin permission check: a push subscription is an address that
 * receives the shop's operational alerts, and anyone able to add one could have
 * new orders delivered to their own phone.
 */
export async function POST(request: Request) {
  const admin = await requireAdminPermission("settings:write");

  const body = (await request.json().catch(() => null)) as {
    action?: "subscribe" | "unsubscribe" | "test";
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
    label?: string;
  } | null;

  if (!body) return Response.json({ ok: false, error: "Bad request" }, { status: 400 });

  if (body.action === "unsubscribe") {
    if (body.subscription?.endpoint) await removePushSubscription(body.subscription.endpoint);
    return Response.json({ ok: true });
  }

  if (body.action === "test") {
    const result = await sendPushToStaff({
      title: "KRISHOE — जाँच 🔔",
      body: "यो सन्देश आयो भने notification चालु छ।",
      url: "/admin",
      tag: "push-test",
    });
    return Response.json({ ok: true, ...result });
  }

  if (!body.subscription) {
    return Response.json({ ok: false, error: "No subscription" }, { status: 400 });
  }

  const saved = await savePushSubscription(body.subscription, {
    staffId: admin?.session?.staffId,
    label: (body.label ?? "").slice(0, 80),
  });

  return Response.json(saved);
}

export async function GET() {
  await requireAdminPermission("settings:write");
  return Response.json({ configured: pushConfigured() });
}
