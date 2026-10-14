import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { averagesOf } from "@/lib/recent-averages";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/** Owner, 2026-10-14 ("2 garau"): the Forecast tab showed numbers written into the code. */
describe("the Analytics forecast tab", () => {
  it("no longer shows numbers written into the code", async () => {
    const dashboard = await read("components/admin/AdvancedAnalyticsDashboard.tsx");
    expect(dashboard).not.toContain("Average: 180 pairs/day");
    expect(dashboard).not.toContain("Average: Rs. 35,000/day");
    expect(dashboard).not.toContain("Confidence:");
    expect(dashboard).toContain('fetch("/api/admin/analytics?section=recent")');
    const route = await read("app/api/admin/analytics/route.ts");
    expect(route).toContain("getRecentAverages(30)");
  });

  it("counts real days: pairs without taken-back lines, sales net of returns", async () => {
    const source = await read("lib/recent-averages.ts");
    expect(source).toContain("work.status <> 'reversed'");
    expect(source).toContain("salesByDay(invoices as SaleLike[], days)");
  });

  it("averages over the days with work, and remembers the last one", () => {
    const result = averagesOf(
      30,
      [
        { day: "2026-10-04", pairs: 240 },
        { day: "2026-09-25", pairs: 120 },
        { day: "2026-09-26", pairs: 0 },
      ],
      [
        { day: "2026-10-01", net: 700 },
        { day: "2026-10-02", net: 0 },
        { day: "2026-10-04", net: 3100 },
      ],
    );
    expect(result).toEqual({
      days: 30,
      pairsTotal: 360,
      pairsDays: 2,
      lastPairsDay: "2026-10-04",
      salesTotal: 3800,
      salesDays: 2,
      lastSalesDay: "2026-10-04",
      bills: 0,
      averageBill: 0,
    });
  });
});

describe("the 30-day trends", () => {
  it("counts every Nepal day: bills, pairs, and sales less returns", async () => {
    const { trendsFrom } = await import("@/lib/recent-averages");
    const trends = trendsFrom(
      ["2026-10-03", "2026-10-04"],
      [{ day: "2026-10-04", pairs: 240 }],
      [
        { createdAt: "2026-10-04T03:00:00Z", kind: "Sale", status: "Paid", total: 2100 },
        { createdAt: "2026-10-04T04:00:00Z", kind: "Sale", status: "Voided", total: 3900 },
        { createdAt: "2026-10-04T05:00:00Z", kind: "Return", status: "Paid", total: 100 },
        // 1 a.m. in Nepal on the 4th is still the 3rd in UTC.
        { createdAt: "2026-10-03T19:30:00Z", kind: "Sale", status: "Paid", total: 500 },
      ],
    );
    expect(trends.salesTrend.map((point) => point.value)).toEqual([0, 2]);
    expect(trends.productionTrend.map((point) => point.value)).toEqual([0, 240]);
    expect(trends.revenueTrend.map((point) => point.value)).toEqual([0, 2500]);
    expect(trends.revenueTrend[1].label).toBe("Oct 4");
  });

  it("no longer reads the digits of an order's text", async () => {
    const engine = await read("lib/analytics-engine.ts");
    const trends = engine.slice(engine.indexOf("export async function getSalesTrend"), engine.indexOf("export async function getKeyMetrics"));
    expect(trends).not.toContain("SUBSTRING");
    expect(trends.match(/getDailyTrends\(\)/g)).toHaveLength(3);
  });
});

describe("the goals and the average bill", () => {
  it("are the owner's own goal and the bills' own totals", async () => {
    const dashboard = await read("components/admin/AdvancedAnalyticsDashboard.tsx");
    expect(dashboard).toContain('fetch("/api/admin/analytics?section=month_goals")');
    expect(dashboard).not.toContain("analytics.goals.map");
    expect(dashboard).not.toContain("customerAnalytics.avgOrderValue");
    expect(dashboard).toContain('href="/admin/settings#goals"');
    const source = await read("lib/recent-averages.ts");
    expect(source).toContain("getBusinessGoal(monthKey)");
    expect(source).toContain("netSalesBetween(invoices as SaleLike[], month.startKey, month.endKey)");
  });

  it("averages the bills", async () => {
    const { averagesOf } = await import("@/lib/recent-averages");
    expect(averagesOf(30, [], [], [2100, 900]).averageBill).toBe(1500);
    expect(averagesOf(30, [], [], []).averageBill).toBe(0);
  });
});
