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

  it("does when a wage is paid", async () => {
    const source = await body("createFactoryLedgerEntry", "export async function createFactoryAdvance");

    // This is the one that was missing. The ledger went to nil while the month
    // still showed the old balance.
    expect(source).toContain("writeMonthlySummary");
  });

  it("does when a staff advance is given", async () => {
    const source = await body("createFactoryAdvance", "interface SummaryRow");

    // An advance reduces what is left to pay for the month.
    expect(source).toContain("writeMonthlySummary");
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

  it("is the advance's own period", async () => {
    const source = await body("createFactoryAdvance", "interface SummaryRow");

    expect(source).toContain("writeMonthlySummary(db, worker.id, input.periodMonth)");
  });
});
