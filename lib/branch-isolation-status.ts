import { queryPostgres } from "@/lib/postgres/client";
import { allBranchAdminRole } from "@/lib/admin-branch-context";

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
  /**
   * True while the app exempts the Owner role from branch scoping. Reported
   * because an exemption is invisible from the database side: Postgres can say
   * the policies are on, and still every Owner request arrives carrying
   * permission to read past them.
   */
  ownerExempt: boolean;
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
 * Switching it on is deliberately not what this does. That stays a decision
 * about the connecting role, made in Neon, not a flag in here.
 *
 * What the app decides is who is exempt. The Owner is: he owns every branch and
 * is the one person who has to be able to add them up, and without that
 * exemption the day isolation starts working is the day he opens an empty shop.
 * The exemption is reported alongside the role for a reason — it is the half
 * the database cannot see, and a wall with a door in it should be described as
 * a wall with a door, not as a wall.
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
      ownerExempt: true,
      effective,
      summary: effective
        ? `Branch isolation is enforced on ${policies} table(s). ${allBranchAdminRole} accounts are exempt by design and still see every branch.`
        : bypassed
          ? `Branch isolation is written on ${policies} table(s) but NOT enforced: the app connects as ${who?.role ?? "this role"}, which bypasses row-level security. Everyone signed in sees every branch. Separately, ${allBranchAdminRole} accounts are exempt in the app, so they would still see every branch on the day the connecting role stops bypassing.`
          : "No branch isolation policies are installed.",
    };
  } catch {
    return {
      policies: 0,
      forced: 0,
      role: "unknown",
      bypassed: false,
      // The exemption is the app's own rule, not something the failed query was
      // going to tell us, so it stays true even when the database is unreachable.
      ownerExempt: true,
      effective: false,
      // Not knowing is its own answer, and a better one than a confident guess.
      summary: "Could not read whether branch isolation is enforced.",
    };
  }
}
