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

export async function isAdminBootstrapLoginAllowed() {
  const explicitRecoveryOverride = process.env.ADMIN_BOOTSTRAP_LOGIN_ENABLED === "true";
  if (explicitRecoveryOverride) return true;

  try {
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
