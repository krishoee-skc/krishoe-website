import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The last gap before the branch wall is switched on.
 *
 * The 32 policies written in 20260802_branch_access_v1.sql have never actually
 * run: the app connects as neondb_owner, which has rolbypassrls, so Postgres
 * skips them before reading. Moving to a NOBYPASSRLS role turns all 32 on in
 * one step, and every table they do not cover becomes either readable from the
 * wrong branch or unreadable from any of them.
 *
 * An audit of all 87 tables found two carrying branch_id with no policy, and
 * they are opposite problems. customer_voice holds the shop's ten published
 * reviews, all with an empty branch_id — the wall would make them unreachable
 * and the public product pages would lose them. admin_staff_accounts is read by
 * the login path before a branch context exists, so a policy there could refuse
 * every sign-in, with no way back in through the app.
 *
 * One gets the wall. The other is deliberately left open, and the reason is
 * written where the next person will find it.
 */
const MIGRATION = "scripts/migrations/20260916_branch_wall_preflight.sql";

describe("the review table joins the wall", () => {
  it("backfills the rows that have no branch", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    // Empty string, not only NULL: these rows predate the column and carry ''.
    expect(sql).toMatch(/UPDATE customer_voice[\s\S]*?btrim\(branch_id\)\s*=\s*''/);
    expect(sql).toContain("krishoe_effective_branch_id()");
  });

  it("turns row security on and adds the same policy as its neighbours", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain("ALTER TABLE customer_voice ENABLE ROW LEVEL SECURITY");
    // FORCE, or the table owner still reads past it — which is the exact way
    // the other 32 policies have been silently inert all along.
    expect(sql).toContain("ALTER TABLE customer_voice FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("CREATE POLICY krishoe_branch_isolation ON customer_voice");
    expect(sql).toContain("krishoe_can_access_branch(branch_id)");
  });

  it("checks its own work instead of assuming it", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    // A migration that quietly did nothing would leave the wall holed in the
    // one place this file exists to close.
    expect(sql).toMatch(/RAISE EXCEPTION[\s\S]*?rows with no branch/);
    expect(sql).toMatch(/RAISE EXCEPTION[\s\S]*?no branch policy/);
  });
});

describe("the staff table is deliberately left open", () => {
  it("is never given a policy by this migration", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    // Walling this table can lock every account out of the app permanently,
    // including the Owner's. A visible staff list is recoverable; a lockout is
    // not.
    expect(sql).not.toMatch(/CREATE POLICY[^\n]*admin_staff_accounts/);
    expect(sql).not.toMatch(/ALTER TABLE admin_staff_accounts ENABLE ROW LEVEL SECURITY/);
  });

  it("records why, in the database itself", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    // Not only in a comment in this file: the reason has to survive where the
    // next person looks, which is the table.
    expect(sql).toContain("COMMENT ON TABLE admin_staff_accounts");
    expect(sql).toMatch(/before any[\s\S]*?branch context exists/);
  });
});
