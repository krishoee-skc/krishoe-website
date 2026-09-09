import { describe, expect, it } from "vitest";
import {
  BONUS_SHARE,
  attendanceRate,
  qualityRate,
  workerPerformance,
  type WorkerMonthRow,
} from "@/lib/worker-performance";

/**
 * The month each worker is having, as the analytics screen reports it.
 *
 * It had been counting from the dormant production ledger and showing half of
 * everything — 120 pairs where 240 were made, Rs. 4,920 where Rs. 9,720 was
 * earned, and a bonus figured on the half. These hold the arithmetic that
 * decides what the owner reads beside a worker's name.
 */
function month(over: Partial<WorkerMonthRow> = {}): WorkerMonthRow {
  return {
    workerId: "w1",
    workerName: "santosh small",
    pairs: 240,
    rejectedPairs: 0,
    earnings: 9720,
    daysWorked: 1,
    ...over,
  };
}

describe("how clean a worker's month was", () => {
  it("counts good pairs against pairs made", () => {
    expect(qualityRate(100, 0)).toBe(100);
    expect(qualityRate(100, 5)).toBe(95);
    expect(qualityRate(240, 12)).toBe(95);
  });

  it("reads a month with no pairs as nothing, not as flawless", () => {
    // 100% would credit perfect work on a day the worker was not there.
    expect(qualityRate(0, 0)).toBe(0);
  });

  it("never reports more than perfect, whatever the rejects say", () => {
    // A negative reject count is a miskeyed row, not a bonus.
    expect(qualityRate(100, -5)).toBe(100);
    expect(qualityRate(100, 150)).toBe(0);
  });
});

describe("turning up", () => {
  it("counts days worked against days the factory ran", () => {
    expect(attendanceRate(20, 25)).toBe(80);
    expect(attendanceRate(25, 25)).toBe(100);
  });

  it("marks nobody absent for a day the factory did not run", () => {
    // The shop keeps no register: a day nobody posted work is a day the
    // factory was closed, not a day everyone missed.
    expect(attendanceRate(0, 0)).toBe(0);
    expect(attendanceRate(5, 0)).toBe(0);
  });

  it("does not exceed a hundred percent", () => {
    expect(attendanceRate(30, 25)).toBe(100);
  });
});

describe("the bonus the owner is shown", () => {
  it("is earned by clean work and being there", () => {
    const result = workerPerformance(month({ pairs: 240, rejectedPairs: 0, earnings: 9720 }), 1);

    expect(result.qualityRate).toBe(100);
    expect(result.attendanceRate).toBe(100);
    expect(result.bonusEligible).toBe(true);
    expect(result.bonusAmount).toBe(486); // 5% of 9,720
  });

  it("is refused when quality is exactly at the line, not above it", () => {
    // "> 95%", so 95 itself does not earn it.
    const result = workerPerformance(month({ pairs: 100, rejectedPairs: 5 }), 1);

    expect(result.qualityRate).toBe(95);
    expect(result.bonusEligible).toBe(false);
    expect(result.bonusAmount).toBe(0);
  });

  it("is refused when the worker missed too many days", () => {
    const result = workerPerformance(month({ daysWorked: 20 }), 25);

    expect(result.attendanceRate).toBe(80);
    expect(result.bonusEligible).toBe(false);
  });

  it("is refused for a month with no pairs in it", () => {
    // One perfect pair is 100% on both counts. A bonus for a day's work is not
    // what this is for, and a month of nothing certainly is not.
    const result = workerPerformance(month({ pairs: 0, earnings: 0 }), 1);

    expect(result.bonusEligible).toBe(false);
    expect(result.bonusAmount).toBe(0);
  });

  it("is a suggestion, worked out from what was actually earned", () => {
    const earnings = 9720;
    const result = workerPerformance(month({ earnings }), 1);

    expect(result.bonusAmount).toBe(Math.round(earnings * BONUS_SHARE));
    // Nothing here writes to a ledger; this figure is read, not paid.
    expect(result.earningsThisMonth).toBe(earnings);
  });

  it("reports the month santosh actually had", () => {
    // The screen said 120 pairs and Rs. 4,920 — half of the four entries that
    // were made, because it was reading the wrong table.
    const result = workerPerformance(month(), 1);

    expect(result.pairsThisMonth).toBe(240);
    expect(result.earningsThisMonth).toBe(9720);
  });
});
