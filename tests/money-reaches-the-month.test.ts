import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A thing entered in one place has to arrive everywhere it belongs.
 *
 * Saving work rebuilt factory_monthly_summary in the same transaction. Saving a
 * payment did not — nor did a staff advance, nor the cash form on the wages
 * screen. So the owner paid santosh Rs. 6,300, his ledger went to nil, and the
 * monthly summary still read "paid 9,720, balance 6,300": two screens, two
 * answers, about a worker who was square.
 *
 * The monthly summary is not a display. It is the figure Saturday's payment is
 * read from, so a payment that does not reach it is money the shop cannot see.
 *
 * The owner's rule, in their words: what is entered here has to reach there,
 * without being asked twice.
 */
const MUTATIONS = "lib/factory-mutations.ts";
const ACTIONS = "app/admin/operations/production-accounts/actions.ts";

/** One exported mutation's body, cut at both ends so a slice cannot run away. */
async function body(name: string, until: string) {
  const source = await readFile(MUTATIONS, "utf8");
  const start = source.indexOf(`export async function ${name}`);
  const end = source.indexOf(until, start);
  expect(start, `${name} is missing`).toBeGreaterThan(-1);
  expect(end, `no end found after ${name}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("every path that moves money rebuilds the month", () => {
  it("does when work is saved", async () => {
    const source = await body("createFactoryWork", "export async function editFactoryWork");

    expect(source).toContain("writeMonthlySummary");
  });

  it("does when work is corrected", async () => {
    const source = await body("editFactoryWork", "export async function deleteFactoryWork");

    expect(source).toContain("writeMonthlySummary");
  });

  it("does when work is deleted", async () => {
    const source = await body("deleteFactoryWork", "interface LedgerRow");

    expect(source).toContain("writeMonthlySummary");
  });

  it("does when a piece wage is paid", async () => {
    const source = await body("createFactoryLedgerEntry", "export async function createFactoryAdvance");

    // This is the one that was missing. The ledger went to nil while the month
    // still showed the old balance.
    expect(source).toContain("writeMonthlySummary");
  });

  it("leaves monthly staff out of the piece summary when their salary is paid", async () => {
    const source = await body("createFactoryLedgerEntry", "export async function createFactoryAdvance");

    // The salary screen pays through this same function, and its worker is
    // monthly_staff. factory_monthly_summary counts pairs and piece wages, so
    // a row there for a salaried person reads "0 pairs, Rs. 0 earned,
    // Rs. 12,000 paid" — the Reports payroll would show her owing the shop a
    // month's salary. Checked against live data before the guard went in:
    // neither staff member had a summary row yet, so nothing was wrong; the
    // first salary payment would have done it.
    const guard = 'if (worker.worker_type === "piece_rate") {';
    expect(source).toContain(guard);
    expect(
      source.indexOf(guard),
      "the guard has to come before the rebuild, not after it",
    ).toBeLessThan(source.indexOf("await writeMonthlySummary"));
  });

  it("does not rebuild a piece summary for a staff advance, which has none", async () => {
    const source = await body("createFactoryAdvance", "interface SummaryRow");

    // An advance is monthly staff only — the function refuses anyone else a
    // few lines in — so a piece summary here would have been built exclusively
    // for the case that cannot reach it.
    expect(source).toContain('worker.worker_type !== "monthly_staff"');
    expect(source).not.toContain("writeMonthlySummary");
  });

  it("does when cash is approved on the wages screen", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const action = source.slice(
      source.indexOf("export async function createWorkerPaymentAction"),
      source.indexOf("export async function reverseWorkerPaymentAction"),
    );

    // Rebuilt in the action rather than inside addWorkerPayment, which holds
    // the worker lock refreshFactoryMonthlySummary would try to take again.
    expect(action).toContain("refreshFactoryMonthlySummary");
  });

  it("skips monthly staff there, who have no piece summary", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const action = source.slice(
      source.indexOf("export async function createWorkerPaymentAction"),
      source.indexOf("export async function reverseWorkerPaymentAction"),
    );

    expect(action).toContain(`employee.department !== "Staff"`);
  });
});

describe("which month a payment belongs to", () => {
  it("is the salary period when one was chosen, otherwise the payment's own month", async () => {
    const source = await body("createFactoryLedgerEntry", "export async function createFactoryAdvance");

    // A wage for last month, handed over this month, belongs to last month.
    expect(source).toContain("input.salaryPeriodMonth ?? bikramMonthKeyOf(input.date)");
  });

  it("is the advance's own period, read on the screen that uses it", async () => {
    const salary = await readFile("app/api/factory/salary/route.ts", "utf8");

    // Not through factory_monthly_summary. The salary screen sums the period's
    // advances itself and subtracts them from what is left to pay, so an
    // advance already arrives where it belongs.
    expect(salary).toContain("factory_weekly_advance");
    expect(salary).toContain("advance_amount");
  });
});
