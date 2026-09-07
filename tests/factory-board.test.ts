import { describe, expect, it } from "vitest";
import {
  factoryDayStats,
  factoryTotalsFromRow,
  normalisePayrollRow,
  normaliseWorkRow,
  payrollTotals,
  pieceWage,
  sortPayroll,
  topProducts,
  topWorkers,
  type FactoryPayrollRow,
  type FactoryWorkRow,
} from "@/lib/factory-board";

/**
 * The factory board reports a day's work and the wage it earned. Those numbers
 * decide what the workshop is paid, so they are checked here rather than by
 * opening the screen and reading it.
 */

function work(over: Partial<FactoryWorkRow> = {}): FactoryWorkRow {
  return normaliseWorkRow({
    worker_id: "w1",
    worker_name: "Ram",
    item_id: "i1",
    item_name: "Kids slipper",
    pairs_count: 10,
    reject_pairs: 0,
    amount_earned: 250,
    status: "completed",
    ...over,
  });
}

describe("a day on the factory board", () => {
  it("adds up pairs, rejects and the wage earned", () => {
    const stats = factoryDayStats([
      work({ pairs_count: 10, reject_pairs: 1, amount_earned: 250 }),
      work({ worker_id: "w2", worker_name: "Sita", pairs_count: 8, reject_pairs: 0, amount_earned: 200 }),
    ]);

    expect(stats.totalPairs).toBe(18);
    expect(stats.totalReject).toBe(1);
    expect(stats.totalAmount).toBe(450);
    expect(stats.goodPairs).toBe(17);
  });

  it("counts a worker once however many entries they made", () => {
    const stats = factoryDayStats([
      work({ worker_id: "w1" }),
      work({ worker_id: "w1" }),
      work({ worker_id: "w2", worker_name: "Sita" }),
    ]);

    expect(stats.workersActive).toBe(2);
  });

  it("reads the wage as a number when Postgres sends it as a string", () => {
    // NUMERIC columns arrive as strings. Left alone, `+` would join them:
    // "250" + "200" is "250200", and the day's wage would be nonsense.
    const rows = [
      normaliseWorkRow({ ...work(), amount_earned: "250" as unknown as number }),
      normaliseWorkRow({ ...work(), amount_earned: "200.50" as unknown as number }),
    ];

    expect(factoryDayStats(rows).totalAmount).toBe(450.5);
  });

  it("treats a missing count as nothing, not as a broken sum", () => {
    const row = normaliseWorkRow({
      worker_id: "w1",
      worker_name: "Ram",
      item_id: "i1",
      item_name: "Kids slipper",
      pairs_count: undefined,
      reject_pairs: null as unknown as number,
      amount_earned: undefined,
      status: "completed",
    });

    expect(row.pairs_count).toBe(0);
    expect(row.reject_pairs).toBe(0);
    expect(factoryDayStats([row]).totalAmount).toBe(0);
  });

  it("works out the success rate from every entry, not just the finished ones", () => {
    const stats = factoryDayStats([
      work({ status: "completed" }),
      work({ status: "completed" }),
      work({ status: "in_progress" }),
      work({ status: "rework" }),
    ]);

    expect(stats.completedEntries).toBe(2);
    expect(stats.successRate).toBe(50);
  });

  it("reports an empty day as zero, never as a division by nothing", () => {
    const stats = factoryDayStats([]);

    expect(stats.successRate).toBe(0);
    expect(stats.rejectRate).toBe(0);
    expect(stats.totalPairs).toBe(0);
    expect(Number.isNaN(stats.successRate)).toBe(false);
  });

  it("never shows a negative pair count when rejects outrun pairs", () => {
    // A miskeyed entry should read as nothing made, not as minus five pairs
    // standing on the shelf.
    const stats = factoryDayStats([work({ pairs_count: 3, reject_pairs: 8 })]);

    expect(stats.goodPairs).toBe(0);
  });
});

/**
 * The amount the add-work screen shows before saving has to be the amount that
 * lands in the worker's ledger. The database settles it as ROUND(rate * pairs,
 * 2); anything else on screen is a promise the book will not keep.
 */
describe("what a piece of work earns", () => {
  it("multiplies pairs by the rate", () => {
    expect(pieceWage(10, 25)).toBe(250);
  });

  it("rounds to the paisa, the way the ledger stores it", () => {
    // Plain JavaScript gives 76.66499999999999 here, and the entry saves 76.66.
    // A worker reading one number and being paid the other is the argument this
    // prevents.
    expect(pieceWage(3, 25.555)).toBe(76.66);
    expect(pieceWage(7, 10.333)).toBe(72.33);
    expect(pieceWage(3, 1.005)).toBe(3.01);
  });

  it("earns nothing from no pairs and no rate", () => {
    expect(pieceWage(0, 25)).toBe(0);
    expect(pieceWage(10, 0)).toBe(0);
  });

  it("refuses to turn a bad entry into a negative wage", () => {
    expect(pieceWage(-5, 25)).toBe(0);
    expect(pieceWage(10, -25)).toBe(0);
  });

  it("reads a rate that arrived as text", () => {
    // Rates come back from the API as strings often enough that the guard
    // belongs here rather than at each call.
    expect(pieceWage("4" as unknown as number, "12.5" as unknown as number)).toBe(50);
    expect(pieceWage(Number.NaN, 25)).toBe(0);
  });
});

/**
 * The board's headline figures are counted in the database so they stay right
 * however big a day gets; the same figures can also be added up from the
 * entries themselves. Two roads to one day's wage is exactly how two screens
 * end up disagreeing about what the factory is owed, so they are held to the
 * same answer here.
 */
describe("counting the day in the database and counting it in JavaScript", () => {
  it("arrive at the same day", () => {
    const rows = [
      work({ worker_id: "w1", pairs_count: 10, reject_pairs: 1, amount_earned: 250, status: "completed" }),
      work({ worker_id: "w2", worker_name: "Sita", pairs_count: 8, reject_pairs: 2, amount_earned: 200, status: "completed" }),
      work({ worker_id: "w3", worker_name: "Hari", pairs_count: 6, reject_pairs: 0, amount_earned: 150, status: "in_progress" }),
      work({ worker_id: "w1", pairs_count: 4, reject_pairs: 0, amount_earned: 100, status: "rework" }),
    ];

    const fromEntries = factoryDayStats(rows);

    // What Postgres hands back for the same day: NUMERIC as strings, counts as
    // numbers — the shape the aggregate query actually returns.
    const fromDatabase = factoryTotalsFromRow({
      total_pairs: "28",
      total_reject: "3",
      total_amount: "700",
      workers_active: 3,
      completed_entries: 2,
      in_progress_entries: 1,
      rework_entries: 1,
    });

    expect(fromDatabase).toEqual(fromEntries);
  });

  it("reads an empty day the same way from either side", () => {
    // Postgres returns no row at all when nothing matched; COALESCE covers the
    // sums, but the board still has to render zeros rather than NaN.
    const fromDatabase = factoryTotalsFromRow({});

    expect(fromDatabase).toEqual(factoryDayStats([]));
    expect(fromDatabase.successRate).toBe(0);
    expect(Number.isNaN(fromDatabase.totalAmount)).toBe(false);
  });

  it("holds the good-pair floor on the database road too", () => {
    expect(factoryTotalsFromRow({ total_pairs: 3, total_reject: 8 }).goodPairs).toBe(0);
  });
});

/**
 * The month's payroll is what the factory pays out. Its totals are checked
 * here rather than by opening the reports screen and reading them.
 */
describe("the month's payroll", () => {
  function payroll(over: Partial<FactoryPayrollRow> = {}): FactoryPayrollRow {
    return normalisePayrollRow({
      worker_id: "w1",
      worker_name: "Ram",
      category: "Upper",
      total_pairs: 100,
      total_earned: 2500,
      total_paid: 2000,
      final_balance: 500,
      status: "draft",
      ...over,
    });
  }

  it("adds the team's pairs, earnings, payments and balance", () => {
    const totals = payrollTotals([
      payroll({ total_pairs: 100, total_earned: 2500, total_paid: 2000, final_balance: 500 }),
      payroll({
        worker_id: "w2",
        worker_name: "Sita",
        total_pairs: 80,
        total_earned: 2000,
        total_paid: 2000,
        final_balance: 0,
      }),
    ]);

    expect(totals.totalPairs).toBe(180);
    expect(totals.totalEarned).toBe(4500);
    expect(totals.totalPaid).toBe(4000);
    expect(totals.totalBalance).toBe(500);
    expect(totals.workerCount).toBe(2);
  });

  it("adds money as numbers when Postgres sends it as text", () => {
    // The bug this prevents: "2500" + "2000" is "25002000", and the month's
    // wage bill becomes a number nobody can explain.
    const totals = payrollTotals([
      normalisePayrollRow({ ...payroll(), total_earned: "2500" as unknown as number }),
      normalisePayrollRow({ ...payroll(), total_earned: "2000.50" as unknown as number }),
    ]);

    expect(totals.totalEarned).toBe(4500.5);
  });

  it("counts who is still owed, not just how much", () => {
    const totals = payrollTotals([
      payroll({ final_balance: 500 }),
      payroll({ worker_id: "w2", final_balance: 0 }),
      payroll({ worker_id: "w3", final_balance: 250 }),
    ]);

    expect(totals.owedCount).toBe(2);
    expect(totals.totalBalance).toBe(750);
  });

  it("keeps a month of fractions to the paisa", () => {
    // Three payslips of 33.33 must not total 99.99000000000001 on screen.
    const totals = payrollTotals([
      payroll({ total_earned: 33.33, total_paid: 0, final_balance: 33.33 }),
      payroll({ worker_id: "w2", total_earned: 33.33, total_paid: 0, final_balance: 33.33 }),
      payroll({ worker_id: "w3", total_earned: 33.33, total_paid: 0, final_balance: 33.33 }),
    ]);

    expect(totals.totalEarned).toBe(99.99);
    expect(totals.totalBalance).toBe(99.99);
  });

  it("reports an empty month as zero", () => {
    const totals = payrollTotals([]);

    expect(totals.totalEarned).toBe(0);
    expect(totals.workerCount).toBe(0);
    expect(totals.owedCount).toBe(0);
  });

  it("reads the payroll with the biggest earner first", () => {
    const sorted = sortPayroll([
      payroll({ worker_id: "w1", worker_name: "Ram", total_earned: 1500 }),
      payroll({ worker_id: "w2", worker_name: "Sita", total_earned: 3000 }),
      payroll({ worker_id: "w3", worker_name: "Hari", total_earned: 2000 }),
    ]);

    expect(sorted.map((row) => row.worker_name)).toEqual(["Sita", "Hari", "Ram"]);
  });

  it("leaves the caller's list alone when sorting", () => {
    // The screen holds this list in state; sorting it in place would reorder
    // what React is rendering from, under it.
    const rows = [
      payroll({ worker_id: "w1", worker_name: "Ram", total_earned: 1500 }),
      payroll({ worker_id: "w2", worker_name: "Sita", total_earned: 3000 }),
    ];
    sortPayroll(rows);

    expect(rows[0].worker_name).toBe("Ram");
  });
});

describe("who and what led the day", () => {
  it("sums a worker's entries and ranks by pairs", () => {
    const rows = [
      work({ worker_id: "w1", worker_name: "Ram", pairs_count: 5, amount_earned: 100 }),
      work({ worker_id: "w1", worker_name: "Ram", pairs_count: 6, amount_earned: 120 }),
      work({ worker_id: "w2", worker_name: "Sita", pairs_count: 9, amount_earned: 180 }),
    ];

    const [first, second] = topWorkers(rows);

    expect(first.name).toBe("Ram");
    expect(first.pairs).toBe(11);
    expect(first.amount).toBe(220);
    expect(second.name).toBe("Sita");
  });

  it("leaves out an entry with nobody's name on it", () => {
    const rows = [work(), work({ worker_id: "", worker_name: "" })];

    expect(topWorkers(rows)).toHaveLength(1);
  });

  it("sums a product across the people who made it", () => {
    const rows = [
      work({ worker_id: "w1", item_id: "i1", item_name: "Kids slipper", pairs_count: 4 }),
      work({ worker_id: "w2", item_id: "i1", item_name: "Kids slipper", pairs_count: 6 }),
      work({ worker_id: "w1", item_id: "i2", item_name: "Ladies sandal", pairs_count: 7 }),
    ];

    const [first, second] = topProducts(rows);

    expect(first.name).toBe("Kids slipper");
    expect(first.pairs).toBe(10);
    expect(second.pairs).toBe(7);
  });

  it("keeps the list short enough to read at a glance", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      work({ worker_id: `w${index}`, worker_name: `Worker ${index}`, pairs_count: index }),
    );

    expect(topWorkers(rows)).toHaveLength(5);
    expect(topWorkers(rows, 3)).toHaveLength(3);
  });
});
