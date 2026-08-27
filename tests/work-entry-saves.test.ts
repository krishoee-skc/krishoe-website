import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { bikramMonthKeyOf, bikramMonthRange } from "@/lib/bikram-sambat";

/**
 * Every piece-rate work entry was being refused, and the owner was told only
 * "Failed to create work entry".
 *
 * The wage was written, the ledger was written, and then the month failed a
 * database CHECK that said a month begins on the first — which had been true
 * while the summary was kept in Gregorian months, and stopped being true when
 * the shop's months became Bikram Sambat ones. Bhadra 2083 begins on 17 August
 * 2026. The whole transaction rolled back, and because the refusal was a plain
 * database error rather than a FactoryMutationError, the route replaced it with
 * its own generic sentence and the real reason never reached anybody.
 */

describe("a Bikram Sambat month does not begin on the first", () => {
  it("is what the summary stores", () => {
    // The exact value that was refused, from the day it was refused on.
    const range = bikramMonthRange(bikramMonthKeyOf("2026-08-27"));

    expect(range?.startKey).toBe("2026-08-17");
    expect(range?.startKey.endsWith("-01")).toBe(false);
  });

  it("has no month-start CHECK left to refuse it", async () => {
    const schema = await readFile("docs/schema.sql", "utf8");

    // CHECK (month = date_trunc('month', month)::date) and its two siblings on
    // salary_period_month. Any of them turns a work entry or a salary payment
    // into a 500 the moment a BS month is written.
    expect(schema).not.toMatch(/CHECK \([^)]*date_trunc\('month'/);
  });

  it("ships a migration to drop them from a database that already exists", async () => {
    const migration = await readFile(
      "scripts/migrations/20260827_monthly_summary_bikram_month.sql",
      "utf8",
    );

    for (const constraint of [
      "factory_monthly_summary_month_check",
      "factory_worker_ledger_salary_period_check",
      "factory_weekly_advance_salary_period_check",
    ]) {
      expect(migration, constraint).toContain(constraint);
    }
    // Run twice, on a database where it has already run, without failing.
    expect((migration.match(/DROP CONSTRAINT IF EXISTS/g) ?? []).length).toBe(3);
  });
});

describe("a date read back is the day it was saved on", () => {
  it("does not go through UTC", async () => {
    const source = await readFile("lib/factory-mutations.ts", "utf8");
    const reader = source.slice(source.indexOf("function dbDate"), source.indexOf("function sameText"));

    // node-postgres parses a DATE into a Date at LOCAL midnight, so 2026-08-27
    // in Kathmandu is 2026-08-26T18:15Z and toISOString() reports the 26th — a
    // day's wages read back under the day before, anywhere but UTC.
    expect(reader).not.toContain("toISOString()");
    expect(reader).toContain("getFullYear()");
  });
});

describe("what the owner is told when a work entry fails", () => {
  it("is not only that it failed", async () => {
    const route = await readFile("app/api/factory/work/route.ts", "utf8");

    // A FactoryMutationError carries a sentence worth reading. Anything else
    // was replaced by "Failed to create work entry" and logged where only a
    // developer would find it — which is how a database refusing every entry
    // for days looked exactly like a form that would not submit.
    expect(route).toContain("FactoryMutationError");
    expect(route).toContain("Failed to create work entry");
  });
});
