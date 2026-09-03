import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * What the command box is allowed to read, and what it must never do.
 *
 * The facts route is the one true-number source the assistant is handed, so it
 * carries a promise: it reads the shop's own snapshots and returns plain
 * numbers, and it never writes, never runs arithmetic of its own that could
 * drift from the dashboard, and never answers a stranger. This is the owner's
 * allow-list rule made into a test — risky work stays shut, safe reading stays
 * open — so a later edit cannot quietly turn a read into a write.
 */

const ROUTE = "app/api/admin/facts/route.ts";

describe("the admin facts API is read-only and guarded", () => {
  it("is login-guarded like every other admin route", async () => {
    const source = await readFile(ROUTE, "utf8");
    expect(source).toContain("requireAdminPermission");
    // Refuses when the guard returns no user.
    expect(source).toContain('status: 401');
  });

  it("only reads — it imports no writer and issues no mutation", async () => {
    const source = await readFile(ROUTE, "utf8");

    // The figures come from snapshot readers, not from any save/insert/update.
    expect(source).toContain("getPosSnapshot");
    expect(source).toContain("getProductionControlSummary");
    expect(source).toContain("getPurchasingSnapshot");

    // No writing verbs anywhere in the route. If a future edit reaches for one,
    // this fails rather than shipping a box that can change the shop.
    for (const forbidden of ["INSERT", "UPDATE", "DELETE", "savePos", "writeDb", "queryPostgres"]) {
      expect(source, `facts route must not ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("hands the assistant the shop's numbers, not numbers of its own", async () => {
    const source = await readFile(ROUTE, "utf8");

    // Every figure is passed straight from a snapshot field. The route may add,
    // filter or count a returned list (the low-stock names), but must not
    // compute money — that stays in pos.ts where it is tested. Guard the money
    // fields specifically: they are read from summary, never recomputed here.
    expect(source).toContain("summary.todayNetSales");
    expect(source).toContain("summary.totalCredit");
    expect(source).toContain("summary.monthProfitEstimate");
    expect(source).toContain("workerBalanceDue");
  });

  it("says 'could not read' rather than guessing when a source is down", async () => {
    const source = await readFile(ROUTE, "utf8");

    // A failed snapshot becomes null, and null is sent through — never
    // backfilled with a zero that would read as a real, wrong answer.
    expect(source).toContain("null");
    expect(source).toContain("could not read");
  });
});
