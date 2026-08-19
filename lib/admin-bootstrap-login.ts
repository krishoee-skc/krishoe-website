import { unstable_cache } from "next/cache";
import { getAdminSettings } from "@/lib/admin-settings";
import { queryPostgres } from "@/lib/postgres/client";

export function shouldAllowAdminBootstrapLogin(input: {
  activeOwnerCount: number;
  explicitRecoveryOverride: boolean;
}) {
  return input.explicitRecoveryOverride || input.activeOwnerCount === 0;
}

/**
 * Counts active Owners, cheaply.
 *
 * This runs on every render of the sign-in page — the first page anyone reaches
 * on a phone — and it needs one number. It used to get that by loading the
 * entire admin settings snapshot: every staff account, every branch, every
 * preference, parsed and shaped, to then filter and take a length. On a Nepali
 * mobile connection that was most of the second and a half the login screen
 * took to appear.
 *
 * Falls back to the full read if the direct count fails, so a schema this does
 * not expect degrades to the slower path rather than to a locked door.
 */
async function activeOwnerCount() {
  try {
    const rows = await queryPostgres<{ owners: number | string }>(
      "admin settings",
      `SELECT count(*)::int AS owners
         FROM admin_staff_accounts
        WHERE status = 'Active' AND role = 'Owner'`,
    );
    return Number(rows[0]?.owners ?? 0);
  } catch {
    const settings = await getAdminSettings();
    return settings.staff.filter(
      (staff) => staff.status === "Active" && staff.role === "Owner",
    ).length;
  }
}

/**
 * Remembers only that the recovery login is closed.
 *
 * Even counting is a database round trip, and on a cold serverless function
 * against Neon that is most of the second the sign-in page still took. The
 * answer changes only when an Owner account is created or removed, which
 * happens perhaps twice in the life of a shop.
 *
 * Deliberately one-sided. Caching "closed" costs, at worst, a few minutes of
 * waiting before the recovery password works during first-time setup. Caching
 * "open" would leave a shared environment password accepted for minutes after
 * the first real Owner exists, which is exactly the window this check was
 * written to shut. So only the closed answer is remembered.
 */
const rememberBootstrapClosed = unstable_cache(
  async () => (await activeOwnerCount()) > 0,
  ["admin-bootstrap-owner-exists"],
  { revalidate: 300 },
);

export async function isAdminBootstrapLoginAllowed() {
  const explicitRecoveryOverride = process.env.ADMIN_BOOTSTRAP_LOGIN_ENABLED === "true";
  if (explicitRecoveryOverride) return true;

  try {
    if (await rememberBootstrapClosed()) return false;

    // No Owner according to the cache, which is the answer that must not be
    // stale in the permissive direction — so it is confirmed against the
    // database before the recovery password is offered.
    return shouldAllowAdminBootstrapLogin({
      activeOwnerCount: await activeOwnerCount(),
      explicitRecoveryOverride,
    });
  } catch {
    // Once production setup exists, a database/read failure must not silently
    // reopen the shared environment-password login.
    return process.env.NODE_ENV !== "production";
  }
}
