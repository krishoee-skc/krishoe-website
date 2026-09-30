import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { migrationChecksum } from "@/lib/delivery-database";
import { NOTIFICATION_KINDS, kindsMissingFrom, notificationTypesMigration } from "@/lib/notification-types-database";
import { errorKind, isCustomerMailFailure, outsideCheckFreshness, thingsToDo } from "@/lib/shop-watch-rules";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The monitoring screen said "Nothing needs attention" while the only online
 * order's buyer got no mail, the outside check had been silent three days, and
 * two of "3 errors" were a rule refusing a bill (owner, 2026-09-30).
 */
describe("1. the notification kinds, put back", () => {
  it("is the migration file word for word, and allows every kind the code writes", async () => {
    const file = await read(`scripts/migrations/${notificationTypesMigration.name}`);
    expect(notificationTypesMigration.sql).toBe(file);
    expect(migrationChecksum(notificationTypesMigration.sql)).toBe(migrationChecksum(file));
    for (const kind of NOTIFICATION_KINDS) expect(file).toContain(`'${kind}'`);
    const code = await read("lib/notifications.ts");
    const union = code.slice(code.indexOf("export type NotificationEventType"), code.indexOf("export type OperationalAlertSeverity"));
    for (const kind of union.match(/"([a-z-]+)"/g) ?? []) expect(NOTIFICATION_KINDS).toContain(kind.replace(/"/g, ""));
  });

  it("reads what the live rule leaves out", () => {
    const live =
      "CHECK ((type = ANY (ARRAY['order'::text, 'contact'::text, 'password-reset'::text, 'email-verification'::text, 'operational-alert'::text])))";
    expect(kindsMissingFrom(live)).toEqual(["staff-security", "review-request", "order-confirmation"]);
  });

  it("fixes the snapshot a rebuilt database is made from", async () => {
    const schema = await read("docs/schema.sql");
    expect(schema).not.toContain("CHECK (type IN ('order', 'contact', 'password-reset', 'email-verification', 'operational-alert'))");
    expect(schema.split("'review-request', 'order-confirmation', 'operational-alert'").length - 1).toBe(2);
  });

  it("is a button in Settings, and a red dot until pressed", async () => {
    const settings = await read("app/admin/settings/page.tsx");
    expect(settings).toContain("<form action={prepareNotificationTypesAction}");
    const selfCheck = await read("lib/shop-self-check.ts");
    expect(selfCheck).toContain('id: "notification-kinds"');
  });
});

describe("3. the screen says what is so", () => {
  it("tells a fault from a rule and a browser", () => {
    expect(errorKind({ level: "error", message: "save POS bill failed: Error: bantu hill wholesale minimum order is 6 pairs. Cannot bill 5 pairs." })).toBe("refused");
    expect(errorKind({ level: "warning", message: "CSP blocked https://translate.google.com/gen204 (img-src)" })).toBe("browser");
    expect(errorKind({ level: "error", message: 'confirm order KRS-ORD-1 to the customer failed: error: new row for relation "notification_events"' })).toBe("broke");
  });

  it("knows a customer's mail failing", () => {
    expect(isCustomerMailFailure("confirm order KRS-ORD-20260927182722-4YZ2 to the customer failed: error")).toBe(true);
    expect(isCustomerMailFailure("deliver review request abc failed")).toBe(true);
    expect(isCustomerMailFailure("save POS bill failed")).toBe(false);
  });

  it("calls a day without an outside check stopped", () => {
    const now = Date.parse("2026-09-30T12:00:00Z");
    expect(outsideCheckFreshness("2026-09-30T11:00:00Z", now)).toBe("fresh");
    expect(outsideCheckFreshness("2026-09-30T07:00:00Z", now)).toBe("late");
    expect(outsideCheckFreshness("2026-09-27T08:39:00Z", now)).toBe("stale");
    expect(outsideCheckFreshness(null, now)).toBe("never");
  });

  it("puts the customer's mail first on the to-do strip", () => {
    const items = thingsToDo({ notificationKindsMissing: ["order-confirmation"], customerMailFailures7d: 1, outsideCheck: "stale", brokeIn7d: 1 });
    expect(items.map((item) => item.key)).toEqual(["notification-kinds", "outside-check", "broke"]);
    expect(items[0].href).toBe("/admin/settings#notification-types");
    expect(thingsToDo({ notificationKindsMissing: [], customerMailFailures7d: 0, outsideCheck: "fresh", brokeIn7d: 0 })).toEqual([]);
  });

  it("draws the strip, the week by kind, and plain words", async () => {
    const screen = await read("components/admin/MonitoringDashboard.tsx");
    expect(screen).toContain("watch && watch.toDo.length > 0 ? (");
    expect(screen).toContain('<AlertText en="Rule refused (not a fault)" ne="नियमले रोक्यो (गल्ती होइन)" />');
    expect(screen).toContain('name: "SMS / WhatsApp"');
    expect(screen).toContain("Keeping each branch's records apart is not built yet.");
    expect(screen).not.toContain("🔍 Production Monitoring");
  });
});

describe("4. the Owner is told, and saves are timed", () => {
  it("pushes to the Owner when a customer's mail fails, refused or undelivered", async () => {
    const code = await read("lib/notifications.ts");
    expect(code).toContain('title: "ग्राहकलाई email गएन 📧"');
    expect(code).toContain('if (!delivered || delivered.status === "failed") await tellOwnerCustomerMailFailed(what, key);');
  });

  it("fails an evening job when the outside check has stopped", async () => {
    const cron = await read("app/api/cron/daily-sales/route.ts");
    expect(cron).toContain('{ name: "outside-check", run: () => outsideCheckStillRunning() },');
  });

  it("times bill and purchase saves under their own metric", async () => {
    const pos = await read("app/admin/pos/actions.ts");
    expect(pos).toContain('await recordSaveTime(textValue(formData, "kind") === "Exchange" ? "Exchange (counter)" : "Bill (counter)", startedAt);');
    const purchase = await read("app/admin/purchasing/actions.ts");
    expect(purchase).toContain('if (result.ok) await recordSaveTime("Purchase bill", startedAt);');
    const timing = await read("lib/save-timing.ts");
    expect(timing).toContain('metric: "SAVE",');
  });
});
