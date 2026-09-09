import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Undoing a piece of work undoes it everywhere.
 *
 * Saving work writes three rows in one transaction: factory_daily_work, the
 * worker ledger, and production_work_entries. Reversing it used to mark only
 * the production row — so the wages screen said the work was undone while the
 * factory screen and the worker's running balance said it still counted, and
 * the month the wage is actually paid from still included it.
 *
 * That is the same one-sided drift that had one worker reading Rs. 4,920
 * against Rs. 9,720, except reachable from a button rather than a missed sync.
 */
const ACCOUNTING = "lib/production-accounting.ts";
const ACTIONS = "app/admin/operations/production-accounts/actions.ts";

async function reversal() {
  const source = await readFile(ACCOUNTING, "utf8");
  return source.slice(
    source.indexOf("export async function reverseProductionWorkEntry"),
    source.indexOf("export async function addWorkerPayment"),
  );
}

describe("reversing a work entry", () => {
  it("reverses the factory work row as well", async () => {
    const guard = await reversal();

    expect(guard).toContain("UPDATE factory_daily_work");
    expect(guard).toContain("SET status = 'reversed'");
  });

  it("reverses the worker ledger row, so the balance stops counting it", async () => {
    const guard = await reversal();

    // The running balance is what the worker is told they are owed.
    expect(guard).toContain("UPDATE factory_worker_ledger");
  });

  it("finds those rows by the key the save carried into all three", async () => {
    const guard = await reversal();

    // Not by worker and date, which would sweep up a second entry made the
    // same morning. The submission key belongs to exactly one save.
    expect(guard).toContain("source_submission_key");
    expect(guard).toContain("WHERE submission_key = $1");
  });

  it("does the whole thing in one transaction", async () => {
    const guard = await reversal();

    // A reversal that stops halfway leaves precisely the disagreement it was
    // meant to correct.
    expect(guard).toContain("transactionPostgres");
  });

  it("does not reverse an already reversed row twice", async () => {
    const guard = await reversal();

    expect(guard).toContain("status <> 'reversed'");
  });

  it("rebuilds the month the wage is paid from", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const action = source.slice(
      source.indexOf("export async function reverseProductionWorkEntryAction"),
    );

    // factory_monthly_summary sums completed work. Without this the reversal
    // looks done on every screen except the one the money comes from.
    expect(action).toContain("refreshFactoryMonthlySummary");
    expect(action).toContain("bikramMonthKeyOf");
  });

  it("rebuilds it outside the reversal's own transaction", async () => {
    const guard = await reversal();

    // refreshFactoryMonthlySummary opens its own transaction and takes the
    // worker lock this one holds — calling it inside would deadlock.
    expect(guard).not.toContain("refreshFactoryMonthlySummary");
  });
});

describe("what a work reversal must not touch", () => {
  it("leaves cash already handed to the worker alone", async () => {
    const source = await readFile(ACCOUNTING, "utf8");
    const guard = source.slice(
      source.indexOf("export async function reverseProductionWorkEntry"),
      source.indexOf("export async function addWorkerPayment"),
    );

    // Undoing a piece of work does not un-hand the money. The ledger holds
    // work rows and payment rows side by side; only the work row is reversed.
    expect(guard).toContain("entry_type = 'work'");
    expect(guard).not.toContain("UPDATE worker_payments");
  });
});
