import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * What the command box is allowed to read, and what it must never do.
 *
 * readAdminFacts (lib/admin-facts.ts) is the one true-number source the command
 * box is handed, shared by the facts API and the assistant so the two can never
 * disagree. It carries a promise: it reads the shop's own snapshots and returns
 * plain numbers, and it never writes, never runs arithmetic of its own that
 * could drift from the dashboard. The route that exposes it never answers a
 * stranger. This is the owner's allow-list rule made into a test — risky work
 * stays shut, safe reading stays open — so a later edit cannot quietly turn a
 * read into a write.
 */

const READER = "lib/admin-facts.ts";
const ROUTE = "app/api/admin/facts/route.ts";

describe("the admin facts reader is read-only", () => {
  it("only reads — snapshot readers, no save/insert/update", async () => {
    const source = await readFile(READER, "utf8");

    // The figures come from snapshot readers, not from any save/insert/update.
    expect(source).toContain("getPosSnapshot");
    expect(source).toContain("getProductionControlSummary");
    expect(source).toContain("getPurchasingSnapshot");

    // No writing verbs anywhere. If a future edit reaches for one, this fails
    // rather than shipping a box that can change the shop.
    for (const forbidden of ["INSERT", "UPDATE", "DELETE", "savePos", "writeDb", "queryPostgres"]) {
      expect(source, `facts reader must not ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("hands over the shop's numbers, not numbers of its own", async () => {
    const source = await readFile(READER, "utf8");

    // Every figure is passed straight from a snapshot field — never recomputed.
    // Money math stays in pos.ts where it is tested.
    expect(source).toContain("summary.todayNetSales");
    expect(source).toContain("summary.totalCredit");
    expect(source).toContain("summary.monthProfitEstimate");
    expect(source).toContain("workerBalanceDue");
  });

  it("says 'could not read' rather than guessing when a source is down", async () => {
    const source = await readFile(READER, "utf8");

    // A failed snapshot becomes null, and null is sent through — never
    // backfilled with a zero that would read as a real, wrong answer.
    expect(source).toContain("null");
    expect(source).toContain("could not read");
  });
});

describe("the facts API that exposes the reader is guarded and read-only", () => {
  it("is login-guarded like every other admin route", async () => {
    const source = await readFile(ROUTE, "utf8");
    expect(source).toContain("requireAdminPermission");
    // Refuses when the guard returns no user.
    expect(source).toContain("status: 401");
  });

  it("delegates to the shared reader and adds no logic of its own", async () => {
    const source = await readFile(ROUTE, "utf8");
    expect(source).toContain("readAdminFacts");
    // The route itself never writes.
    for (const forbidden of ["INSERT", "UPDATE", "DELETE", "queryPostgres"]) {
      expect(source, `facts route must not ${forbidden}`).not.toContain(forbidden);
    }
  });
});
