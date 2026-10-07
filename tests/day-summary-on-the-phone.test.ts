import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { daySummaryLines } from "@/lib/notifications";

/**
 * Owner, 2026-10-07: the evening reports went by email only. The day now also
 * comes to the Owner's phone in three short lines, beside the email.
 */
describe("the day on the phone", () => {
  it("says the money, the bills, the pairs and what is still to collect", () => {
    expect(daySummaryLines({ sales: 4200, bills: 3, pairsSold: 5, pairsMade: 48, onlineOrders: 0, toCollect: 12500 })).toEqual([
      "बिक्री रु 4,200 (3 बिल, 5 जोडी)",
      "उत्पादन 48 जोडी · online अर्डर 0",
      "उठाउन बाँकी रु 12,500",
    ]);
  });

  it("is sent by the evening run, tagged by the day so the retry run replaces it", async () => {
    const route = await readFile("app/api/cron/daily-sales/route.ts", "utf8");
    expect(route).toContain('name: "day-phone"');
    expect(route).toContain("await tellOwnerTheDay(now)");
    const notifications = await readFile("lib/notifications.ts", "utf8");
    expect(notifications).toContain("tag: `day-summary-${todayKey}`");
  });
});
