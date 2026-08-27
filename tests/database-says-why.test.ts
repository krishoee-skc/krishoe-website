import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { describeDatabaseRefusal, databaseRefusalDetail, refusalMessage } from "@/lib/postgres/refusal";
import { saveFailureMessage } from "@/lib/postgres/retryable";

/**
 * Every piece-rate work entry was refused for weeks, and the owner was told
 * "Failed to create work entry".
 *
 * The answer was in the error the whole time — a CHECK constraint named
 * factory_monthly_summary_month_check, on a table the message never mentioned.
 * The route caught it, saw it was not one of its own errors, and replaced it
 * with a sentence that named nothing. A database refusing every write for days
 * then looked exactly like a form that would not submit.
 *
 * These use the real error shape node-postgres produces, taken from the failure
 * itself.
 */

/** The rejection that actually stopped the shop, on 27 August. */
const theRealOne = Object.assign(new Error(
  'new row for relation "factory_monthly_summary" violates check constraint "factory_monthly_summary_month_check"',
), {
  code: "23514",
  table: "factory_monthly_summary",
  constraint: "factory_monthly_summary_month_check",
  detail: "Failing row contains (…, 2026-08-17, …).",
  schema: "public",
});

describe("the refusal that stopped the shop", () => {
  it("is explained, not repeated", () => {
    const said = describeDatabaseRefusal(theRealOne);

    expect(said).toBeTruthy();
    // Not the raw sentence: "violates check constraint" tells a shopkeeper
    // nothing about what to do next.
    expect(said).not.toContain("violates check constraint");
    expect(said).toContain("Bikram Sambat");
    expect(said).toContain("migrations");
  });

  it("keeps the constraint and the failing row for the log", () => {
    const detail = databaseRefusalDetail(theRealOne);

    // "Some check failed" is not a diagnosis. "It was the month, and the month
    // was 2026-08-17" is.
    expect(detail).toMatchObject({
      code: "23514",
      table: "factory_monthly_summary",
      constraint: "factory_monthly_summary_month_check",
    });
    expect(detail?.detail).toContain("2026-08-17");
  });
});

describe("refusals nobody has met yet", () => {
  it("still name the rule and the table", () => {
    const said = describeDatabaseRefusal(
      Object.assign(new Error("nope"), {
        code: "23514",
        table: "pos_invoices",
        constraint: "pos_invoices_some_future_check",
      }),
    );

    expect(said).toContain("pos_invoices_some_future_check");
    expect(said).toContain("pos_invoices");
  });

  it("say to run the migrations when a column is missing", () => {
    // The other half of the same failure: the app expecting a change that was
    // never applied, which is how two blocked migrations went unnoticed.
    const said = describeDatabaseRefusal(
      Object.assign(new Error('column "branch_id" does not exist'), { code: "42703" }),
    );

    expect(said).toContain("branch_id");
    expect(said).toContain("migrations");
  });

  it("are recognised by SQLSTATE, not by reading the message", () => {
    const said = describeDatabaseRefusal(
      Object.assign(new Error("something odd"), { code: "22P02", table: "orders" }),
    );

    expect(said).toContain("22P02");
    expect(said).toContain("orders");
  });
});

describe("errors that are not the database's", () => {
  it("are left alone", () => {
    // An ordinary error already says what it means; dressing it as a database
    // refusal would be a second lie on top of the first.
    expect(describeDatabaseRefusal(new Error("Choose a supplier first."))).toBeNull();
    expect(describeDatabaseRefusal("just a string")).toBeNull();
    expect(describeDatabaseRefusal(null)).toBeNull();
    // A code that is not a SQLSTATE — five characters is the whole test.
    expect(describeDatabaseRefusal(Object.assign(new Error("x"), { code: "ENOENT" }))).toBeNull();
  });

  it("keep their own sentence through refusalMessage", () => {
    expect(refusalMessage(new Error("Choose a supplier first."), "fallback")).toBe("fallback");
    expect(refusalMessage(theRealOne, "fallback")).toContain("Bikram Sambat");
  });
});

describe("every screen gets this, not just the one that was broken", () => {
  it("goes through the helper they all already use", async () => {
    // saveFailureMessage is what every server action and page reaches for, so
    // explaining a refusal there explains it everywhere at once.
    expect(saveFailureMessage(theRealOne, "The work was not saved.")).toContain("Bikram Sambat");

    const retryable = await readFile("lib/postgres/retryable.ts", "utf8");
    expect(retryable).toContain("describeDatabaseRefusal");
  });

  it("still puts a dropped connection first", () => {
    // A connection that died is not a refusal, and the advice is different:
    // press Save again.
    const dropped = Object.assign(new Error("Connection terminated unexpectedly"), {
      code: "ECONNRESET",
    });
    expect(saveFailureMessage(dropped, "fallback")).toContain("press Save again");
  });
});

describe("the route that hid it", () => {
  it("no longer replaces the reason with a sentence of its own", async () => {
    const route = await readFile("app/api/factory/work/route.ts", "utf8");

    expect(route).toContain("refusalMessage(error,");
    // The generic sentence survives only as the fallback, never as the answer.
    expect(route).not.toMatch(/error:\s*\n?\s*error instanceof FactoryMutationError/);
  });

  it("writes the constraint into the error log", async () => {
    const route = await readFile("app/api/factory/work/route.ts", "utf8");

    // console.error goes where nobody looks. This goes to monitoring_errors,
    // with the rule and the failing row attached.
    expect(route).toContain("databaseRefusalDetail(error)");
    expect(route).toContain("reportError(");
  });
});
