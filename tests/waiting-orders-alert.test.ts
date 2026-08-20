import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The alert for a customer still waiting for the call the shop promised.
 *
 * Every KRISHOE order page says "we will call you shortly to confirm". Three
 * orders had been sitting untouched — the oldest for six days — while the alert
 * centre reported busily on supplier payables and stock levels. Money owed to a
 * supplier raised a warning; a person waiting for their shoes did not.
 */
describe("orders waiting for a call", () => {
  it("is one of the things the alert centre looks at", async () => {
    const source = await readFile("lib/notifications.ts", "utf8");
    const centre = source.slice(source.indexOf("getOperationalAlertCenter"));

    expect(centre).toContain("getOrders()");
    expect(centre).toContain('order.status === "New"');
    expect(centre).toContain("order-waiting-");
  });

  it("turns critical once a whole day has passed", async () => {
    const source = await readFile("lib/notifications.ts", "utf8");
    // Two hours is a nudge. A day means the promise is already broken, and the
    // alert should not keep saying "warning" about it.
    expect(source).toContain("hoursWaiting >= 2");
    expect(source).toContain('days >= 1 ? "critical" : "warning"');
  });

  it("says who to call and what to do about it", async () => {
    const source = await readFile("lib/notifications.ts", "utf8");
    const alert = source.slice(source.indexOf("order-waiting-"), source.indexOf("order-waiting-") + 900);

    // An alert naming a problem without naming the next move is one that gets
    // read and left.
    expect(alert).toContain("order.phone");
    expect(alert).toContain("mark the order Contacted");
    expect(alert).toContain('href: "/admin/orders"');
  });

  it("is raised before the supplier and stock ones", async () => {
    const source = await readFile("lib/notifications.ts", "utf8");
    const centre = source.slice(source.indexOf("getOperationalAlertCenter"));

    // It is the shop's own promise to a customer, so it outranks the rest.
    expect(centre.indexOf("order-waiting-")).toBeLessThan(centre.indexOf("`collection-$"));
    expect(centre.indexOf("order-waiting-")).toBeLessThan(centre.indexOf("`supplier-$"));
  });
});
