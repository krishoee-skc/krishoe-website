import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * What the owner opens this app to find out.
 *
 * The dashboard led with today's PRODUCTION — pairs made — which is the
 * factory's question, not the shop's. The figure the owner actually wants on
 * waking is whether money came in, and it was somewhere below a wall of tiles.
 *
 * Worse, two of those tiles were lying. "Active workers" was hardcoded to 12
 * and "pending payments" to 3, sitting in a row of real numbers on the owner's
 * own screen. A made-up figure among real ones is worse than a blank: it
 * teaches the reader to distrust the numbers beside it, and the owner had no
 * way to tell which was which.
 */
const PAGE = "app/admin/page.tsx";

describe("the owner's first screen", () => {
  it("leads with the money, not with the pairs", async () => {
    const page = await readFile(PAGE, "utf8");
    const body = page.slice(page.indexOf('<section className="p-6 space-y-6">'));

    const sales = body.indexOf("<TodaySales");
    const board = body.indexOf("<TodayBoard");

    expect(sales).toBeGreaterThan(-1);
    expect(sales).toBeLessThan(board);
  });

  it("shows a figure the books can be reconciled against", async () => {
    const page = await readFile(PAGE, "utf8");

    // Net of returns, and beside it what was actually collected — a good day
    // of credit sales is not a good day, and one number alone hides that.
    expect(page).toContain('getPos("summary.todayNetSales", 0)');
    expect(page).toContain("collected={todayCollected}");
  });

  it("says something when the day is empty rather than showing a bare zero", async () => {
    const card = await readFile("components/admin/TodaySales.tsx", "utf8");

    expect(card).toContain("billCount > 0");
    expect(card).toContain("आज अझै बिल काटिएको छैन");
  });

  it("has no invented number left on it", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).not.toContain("Placeholder");
    expect(page).not.toContain("activeWorkers: 12");
    expect(page).not.toContain("count: 3,");
  });

  it("counts the workers who worked, not the workers on the payroll", async () => {
    const accounting = await readFile("lib/production-accounting.ts", "utf8");

    // A headcount would climb as the factory hires and say nothing about
    // today. This is people who logged work today.
    expect(accounting).toContain("count(DISTINCT employee_id)");
    expect(accounting).toContain("active_worker_count");
  });
});
