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
 * So this file does not switch the wall on. That is a decision about the
 * connecting role, made in Neon, and it belongs to the owner of the shop.
 *
 * What the app has settled is the door: the Owner role reads past its branch.
 * Without it, the day the wall starts standing is the day the Owner opens an
 * empty shop — his staff account sits in the office branch and every row in the
 * shop belongs to the factory branch. The exemption costs nothing today, since
 * neondb_owner already lets everybody through, and it is the difference between
 * isolation arriving as a feature and arriving as an outage.
 *
 * The risk it brings is that the wall can look switched on while the person
 * most likely to test it walks through. That is a reporting problem, so it is
 * answered by reporting: the exemption is stated beside the role on the
 * monitoring screen, in the summary sentence, from the same constant that
 * grants it. This file holds the design intact for the day it is wanted, and
 * holds the app to describing a wall with a door as a wall with a door.
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

  it("lets the Owner read every branch, so switching it on is not an outage", async () => {
    const auth = await readFile("lib/admin-auth.ts", "utf8");

    // The Owner owns every branch and is the one person who has to add them up.
    // Without this, the day the connecting role stops bypassing RLS is the day
    // he opens a shop with zero orders, zero stock and zero workers in it.
    //
    // Asserted on the entitlement rather than one spelling of the line: the
    // branch switcher named this `seesEveryBranch` so the cookie read could be
    // gated on it too. The rule is what matters — the bootstrap login and the
    // Owner, nobody else.
    expect(auth).toContain("!session.staffId || session.role === allBranchAdminRole");

    // And the bypass must still follow that entitlement. It is now also turned
    // off while the Owner has narrowed to a single branch, which only ever
    // narrows — it can never grant the bypass to someone without it.
    expect(auth).toMatch(/bypass:\s*seesEveryBranch(\s*&&\s*!viewingBranchId)?/);
  });

  it("grants and reports the exemption from one constant", async () => {
    const context = await readFile("lib/admin-branch-context.ts", "utf8");
    const status = await readFile("lib/branch-isolation-status.ts", "utf8");

    // Two copies of "Owner" would drift, and the screen would keep describing an
    // exemption the app had stopped granting — the confident wrong answer this
    // whole file exists to prevent.
    expect(context).toContain('export const allBranchAdminRole = "Owner" as const');
    expect(status).toContain("allBranchAdminRole");
  });

  it("says the wall has a door in it, not that it has no door", async () => {
    const status = await readFile("lib/branch-isolation-status.ts", "utf8");

    // An exemption is invisible from the database side: Postgres can report the
    // policies are on and still every Owner request arrives carrying permission
    // to read past them. So the sentence a person reads has to carry it.
    expect(status).toContain("ownerExempt");
    expect(status).toContain("are exempt by design and still see every branch");
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

    // The API had been sending this since the day it was written and the
    // dashboard never read it, so "shown where somebody opens it" was false for
    // weeks and this test passed anyway — it only ever asked the sender. An
    // answer nobody renders is not an answer.
    const dashboard = await readFile("components/admin/MonitoringDashboard.tsx", "utf8");

    expect(dashboard).toContain("monitoring.branchIsolation");
    expect(dashboard).toContain("ownerExempt");
  });

  it("says it does not know rather than guessing", async () => {
    const status = await readFile("lib/branch-isolation-status.ts", "utf8");
    expect(status).toContain("Could not read whether branch isolation is enforced.");
  });
});
