import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reaching the owner's phone the moment an order arrives.
 *
 * The shop tells every customer "we will call you shortly to confirm", and the
 * only way the owner learned an order existed was an email, or opening the
 * admin app and looking. An order placed at nine at night went unseen until
 * morning — a promise broken by nobody being told.
 *
 * The rule these tests exist for is that the notification is never allowed to
 * matter more than the order. A push outage, a missing key, a dead subscription
 * — none of them may fail the order that triggered them.
 */

const sent: unknown[] = [];
const queries: { sql: string; params: unknown[] }[] = [];
let sendBehaviour: () => void = () => {};

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (subscription: unknown, body: string) => {
      sendBehaviour();
      sent.push({ subscription, body });
    }),
  },
}));

vi.mock("@/lib/postgres/client", () => ({
  queryPostgres: vi.fn(async (_store: string, sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    if (sql.includes("SELECT")) {
      return [{ endpoint: "https://push.example/abc", p256dh: "key", auth: "auth", label: "phone" }];
    }
    return [];
  }),
}));

vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

const ORIGINAL = { ...process.env };

beforeEach(() => {
  sent.length = 0;
  queries.length = 0;
  sendBehaviour = () => {};
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-key";
  process.env.VAPID_PRIVATE_KEY = "private-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

describe("sending", () => {
  it("delivers the message to every subscribed device", async () => {
    const { sendPushToStaff } = await import("@/lib/push-notifications");
    const result = await sendPushToStaff({ title: "नयाँ अर्डर", body: "Sita · Rs. 1,999" });

    expect(result.sent).toBe(1);
    expect(JSON.parse((sent[0] as { body: string }).body)).toMatchObject({
      title: "नयाँ अर्डर",
      body: "Sita · Rs. 1,999",
      url: "/admin",
    });
  });

  it("carries a link, so tapping it lands on the order", async () => {
    const { sendPushToStaff } = await import("@/lib/push-notifications");
    await sendPushToStaff({ title: "t", body: "b", url: "/admin/orders" });

    expect(JSON.parse((sent[0] as { body: string }).body).url).toBe("/admin/orders");
  });

  it("does nothing at all when no keys are configured", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    vi.resetModules();
    const { sendPushToStaff, pushConfigured } = await import("@/lib/push-notifications");

    expect(pushConfigured()).toBe(false);
    // Skipped, not failed: an unconfigured shop is not a broken one.
    expect(await sendPushToStaff({ title: "t", body: "b" })).toMatchObject({ skipped: true });
    expect(sent).toHaveLength(0);
  });

  it("treats half a keypair as not configured", async () => {
    // Signing with one half produces an authentication error from the push
    // service that says nothing about keys.
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    vi.resetModules();
    const { pushConfigured } = await import("@/lib/push-notifications");
    expect(pushConfigured()).toBe(false);
  });
});

describe("when a device goes away", () => {
  it("forgets a subscription the push service says is gone", async () => {
    sendBehaviour = () => {
      throw Object.assign(new Error("gone"), { statusCode: 410 });
    };

    const { sendPushToStaff } = await import("@/lib/push-notifications");
    const result = await sendPushToStaff({ title: "t", body: "b" });

    expect(result.failed).toBe(1);
    // Keeping dead rows means every future notification waits on a request that
    // can only fail.
    expect(queries.some((query) => query.sql.includes("DELETE FROM push_subscriptions"))).toBe(true);
  });

  it("keeps a subscription that failed for a temporary reason", async () => {
    sendBehaviour = () => {
      throw Object.assign(new Error("service unavailable"), { statusCode: 503 });
    };

    const { sendPushToStaff } = await import("@/lib/push-notifications");
    await sendPushToStaff({ title: "t", body: "b" });

    expect(queries.some((query) => query.sql.includes("DELETE FROM push_subscriptions"))).toBe(false);
  });

  it("never throws, whatever the push service does", async () => {
    sendBehaviour = () => {
      throw new Error("network down");
    };

    const { sendPushToStaff } = await import("@/lib/push-notifications");
    // The order is the thing that matters; the notification sits on top of it.
    await expect(sendPushToStaff({ title: "t", body: "b" })).resolves.toBeDefined();
  });
});

describe("re-enabling the same device", () => {
  it("updates the row instead of adding a second one", async () => {
    const { savePushSubscription } = await import("@/lib/push-notifications");
    await savePushSubscription(
      { endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } },
      { label: "phone" },
    );

    const insert = queries.find((query) => query.sql.includes("INSERT INTO push_subscriptions"));
    // Otherwise every notification would arrive twice on a device that was
    // simply switched off and on again.
    expect(insert?.sql).toContain("ON CONFLICT (endpoint) DO UPDATE");
  });

  it("refuses a subscription missing its encryption keys", async () => {
    const { savePushSubscription } = await import("@/lib/push-notifications");
    const result = await savePushSubscription(
      { endpoint: "https://push.example/abc" } as never,
    );

    expect(result.ok).toBe(false);
    expect(queries).toHaveLength(0);
  });
});

describe("the service worker", () => {
  it("opens what the notification was about", async () => {
    const sw = await readFile("public/sw.js", "utf8");

    // It used to open "/" regardless, landing the owner on the shop homepage
    // and leaving them to find the order themselves.
    expect(sw).toContain("event.notification.data");
    expect(sw).toContain('data.url || "/admin"');
  });

  it("was bumped, or the old worker would keep running", async () => {
    const sw = await readFile("public/sw.js", "utf8");
    expect(sw).toContain("krishoe-shell-v3");
  });
});
