import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

/**
 * Branch isolation is written, and it does not run.
 *
 * Every table that holds one branch's records carries a branch_id, a default of
 * krishoe_effective_branch_id(), FORCE ROW LEVEL SECURITY and a
 * krishoe_branch_isolation policy. All of it is correct, and none of it takes
 * effect: the app connects to Neon as neondb_owner, and that role has
 * rolbypassrls, so every policy is skipped before it is read.
 *
 * That is the state of the shop today, and it is not an emergency — one shop,
 * one owner, one set of books. It is only dangerous if somebody believes in it.
 * A wall that is drawn but not built is worse than an open room: people put
 * valuables against it.
 *
 * So this file does not switch the wall on. Turning it on today would show the
 * Owner zero orders, zero invoices, zero workers and zero stock, because his
 * staff account sits in the office branch and every row in the shop belongs to
 * the factory branch. It holds the two things that keep the situation honest:
 * the design stays intact for the day it is wanted, and nothing in the app
 * claims a protection that is not there.
 */

describe("the wall is still drawn, correctly", () => {
  it("scopes every branch table the same way", async () => {
    const migration = await readFile(
      "scripts/migrations/20260802_branch_access_v1.sql",
      "utf8",
    );

    // Kept so the day this is wanted, it is a switch and not a rebuild.
    expect(migration).toContain("krishoe_branch_isolation");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("krishoe_can_access_branch");
  });

  it("has no table left outside it", async () => {
    // vehicle_dispatches and vehicle_dispatch_items were on the original list
    // and never got the column — the only finding the access audit had, for
    // weeks. Fixed while both were still empty, which is the only moment it
    // costs nothing: later, somebody would have to decide which branch each
    // historical dispatch belonged to.
    const migration = await readFile(
      "scripts/migrations/20260827_dispatch_branch_scope.sql",
      "utf8",
    );

    for (const table of ["vehicle_dispatches", "vehicle_dispatch_items"]) {
      expect(migration, table).toContain(table);
    }
    expect(migration).toContain("krishoe_effective_branch_id()");
    expect(migration).toContain("krishoe_branch_isolation");
  });

  it("is checked by a script that finishes", async () => {
    const audit = await readFile("scripts/audit-admin-access-branch.mjs", "utf8");

    // It used to die on its first query and report nothing about any table.
    expect(audit).toContain("has_branch_column");
    expect(audit).toContain("no branch_id column");
  });
});

describe("nothing claims the wall is standing", () => {
  it("does not promise branch separation in the admin", async () => {
    // If a screen ever tells the owner that staff are separated by branch, this
    // is where that claim has to be checked against reality first.
    const settings = await readFile("app/admin/settings/page.tsx", "utf8");

    expect(settings).not.toMatch(/only see their (own )?branch/i);
    expect(settings).not.toMatch(/cannot see other branches/i);
  });

  it("gives Owners no bypass, so switching it on stays a real decision", async () => {
    const auth = await readFile("lib/admin-auth.ts", "utf8");

    // bypass is for the environment-password recovery account and nothing else.
    // An Owner exemption would make the wall look switched on while the person
    // most likely to test it walked through — the worst of both.
    expect(auth).toContain("bypass: !session.staffId");
  });
});

describe("and the shop can ask whether it is standing", () => {
  it("reads the role, not just the policies", async () => {
    const status = await readFile("lib/branch-isolation-status.ts", "utf8");

    // Counting policies alone would answer "32 tables protected" and be wrong.
    // rolbypassrls on the connecting role is what decides it, and it is the
    // part nobody thinks to look at.
    expect(status).toContain("rolbypassrls");
    expect(status).toContain("bypassed");
  });

  it("says plainly that everyone sees every branch", async () => {
    const status = await readFile("lib/branch-isolation-status.ts", "utf8");

    // Not "partially configured" or "review recommended". The sentence has to
    // be one a person acts on.
    expect(status).toContain("NOT enforced");
    expect(status).toContain("sees every branch");
  });

  it("is shown on the screen somebody opens", async () => {
    const route = await readFile("app/api/admin/monitoring/route.ts", "utf8");

    expect(route).toContain("getBranchIsolationStatus");
    expect(route).toContain("branchIsolation");
  });

  it("says it does not know rather than guessing", async () => {
    const status = await readFile("lib/branch-isolation-status.ts", "utf8");
    expect(status).toContain("Could not read whether branch isolation is enforced.");
  });
});
