import { queryPostgres } from "@/lib/postgres/client";

const STORE = "branch isolation";

export type BranchIsolationStatus = {
  /** Tables carrying the krishoe_branch_isolation policy. */
  policies: number;
  /** Of those, how many also force it for the table owner. */
  forced: number;
  /** The database role the app connects as. */
  role: string;
  /**
   * True when that role skips row-level security entirely — which makes every
   * policy above decoration, however correctly it is written.
   */
  bypassed: boolean;
  effective: boolean;
  summary: string;
};

/**
 * Whether branch isolation is actually doing anything.
 *
 * Every branch table has a policy, FORCE ROW LEVEL SECURITY, and a branch_id
 * that defaults to the signed-in staff member's branch. All of it is correct.
 * None of it runs: the app connects to Neon as neondb_owner, and that role has
 * rolbypassrls, so Postgres skips every policy before reading it.
 *
 * That is survivable — one shop, one owner — and it is not survivable to
 * believe otherwise. A wall that is drawn but not built is worse than an open
 * room, because people put valuables against it. So the shop can ask, and the
 * monitoring screen shows the answer beside the things that are working.
 *
 * Switching it on is deliberately not what this does. Today it would show the
 * Owner zero orders, zero invoices, zero workers and zero stock: his staff
 * account sits in the office branch and every row in the shop belongs to the
 * factory branch. That is a decision with a data move attached, not a flag.
 */
export async function getBranchIsolationStatus(): Promise<BranchIsolationStatus> {
  try {
    const [tables] = await queryPostgres<{ policies: number | string; forced: number | string }>(
      STORE,
      `SELECT
         count(*)::int AS policies,
         count(*) FILTER (WHERE c.relforcerowsecurity)::int AS forced
       FROM pg_policies p
       JOIN pg_class c ON c.relname = p.tablename
       JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
       WHERE p.schemaname = 'public' AND p.policyname = 'krishoe_branch_isolation'`,
    );

    const [who] = await queryPostgres<{ role: string; bypass: boolean }>(
      STORE,
      `SELECT current_user AS role,
              (rolsuper OR rolbypassrls) AS bypass
       FROM pg_roles WHERE rolname = current_user`,
    );

    const policies = Number(tables?.policies ?? 0);
    const forced = Number(tables?.forced ?? 0);
    const bypassed = Boolean(who?.bypass);
    const effective = policies > 0 && !bypassed;

    return {
      policies,
      forced,
      role: who?.role ?? "unknown",
      bypassed,
      effective,
      summary: effective
        ? `Branch isolation is enforced on ${policies} table(s).`
        : bypassed
          ? `Branch isolation is written on ${policies} table(s) but NOT enforced: the app connects as ${who?.role ?? "this role"}, which bypasses row-level security. Everyone signed in sees every branch.`
          : "No branch isolation policies are installed.",
    };
  } catch {
    return {
      policies: 0,
      forced: 0,
      role: "unknown",
      bypassed: false,
      effective: false,
      // Not knowing is its own answer, and a better one than a confident guess.
      summary: "Could not read whether branch isolation is enforced.",
    };
  }
}
