import { describe, expect, it } from "vitest";
import { goalProgress, currentGoalMonthKey } from "@/lib/business-goals";

/**
 * The goal maths the dashboard leans on. It is small, but it decides whether the
 * owner sees "85% of the way there" or a broken bar, so it is pinned: a zero
 * goal must read as "not tracking" (null), never 0% or a divide-by-zero, and a
 * real goal must give a plain whole percent.
 */
describe("goal progress", () => {
  it("gives a whole percent against a real goal", () => {
    expect(goalProgress(8500, 10000).percent).toBe(85);
    expect(goalProgress(10000, 10000).percent).toBe(100);
    expect(goalProgress(12000, 10000).percent).toBe(120); // over goal is allowed
  });

  it("treats a zero or missing goal as 'not tracking', never a divide-by-zero", () => {
    expect(goalProgress(5000, 0).percent).toBeNull();
    expect(goalProgress(0, 0).percent).toBeNull();
  });

  it("carries the achieved and goal figures through unchanged", () => {
    const p = goalProgress(3200, 8000);
    expect(p.achieved).toBe(3200);
    expect(p.goal).toBe(8000);
  });

  it("keys the month in Bikram Sambat, 'YYYY-MM'", () => {
    // 2026-09-04 is Bhadra 2083 → 2083-05.
    expect(currentGoalMonthKey(new Date("2026-09-04"))).toBe("2083-05");
  });
});
