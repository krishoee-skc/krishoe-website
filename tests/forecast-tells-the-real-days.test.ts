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
    });
  });
});
