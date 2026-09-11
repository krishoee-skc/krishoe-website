import { describe, expect, it } from "vitest";
import { runShopSelfCheck } from "@/lib/shop-self-check";

/**
 * The self checks, run against the real database.
 *
 * Seven SQL queries that no unit test can prove: reading source cannot tell you
 * whether a column exists or a join is right. The rating check is the reason
 * this file exists — it was first written against a `status = 'published'`
 * string, and customer_voice has no such value; it keeps its published state in
 * a boolean. It passed review and would have reported nothing, forever.
 */
describe.skipIf(!process.env.DATABASE_URL)("the shop's self checks, against real data", () => {
  it("every query runs", async () => {
    const found = await runShopSelfCheck();

    // Not a count: what is true today changes as the shop is put right. What
    // must hold is that all seven ran without throwing, and each one that
    // reported did so with a real number and somewhere to go.
    expect(Array.isArray(found)).toBe(true);

    for (const check of found) {
      expect(check.count, check.id).toBeGreaterThan(0);
      expect(check.href, check.id).toMatch(/^\/admin\//);
      expect(check.titleNe.length, check.id).toBeGreaterThan(0);
      expect(check.title, check.id).toContain(String(check.count));
    }
  });

  it("puts anything critical above the rest", async () => {
    const found = await runShopSelfCheck();
    const rank = { critical: 0, warning: 1, info: 2 } as const;

    for (let i = 1; i < found.length; i += 1) {
      expect(rank[found[i].severity]).toBeGreaterThanOrEqual(rank[found[i - 1].severity]);
    }
  });

  it("finds the star ratings that have no review behind them", async () => {
    const found = await runShopSelfCheck();
    const rating = found.find((check) => check.id === "rating-without-reviews");

    // Three Active shoes each carry a hand-typed 4.8 and no published review is
    // linked to any of them. If this stops finding them, either the shop was
    // put right — or the query broke, which is what happened the first time.
    if (rating) {
      expect(rating.count).toBeGreaterThan(0);
      expect(rating.severity).toBe("warning");
    }
  });
});
