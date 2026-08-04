import { getAdminSettings } from "@/lib/admin-settings";

export function shouldAllowAdminBootstrapLogin(input: {
  activeOwnerCount: number;
  explicitRecoveryOverride: boolean;
}) {
  return input.explicitRecoveryOverride || input.activeOwnerCount === 0;
}

export async function isAdminBootstrapLoginAllowed() {
  const explicitRecoveryOverride = process.env.ADMIN_BOOTSTRAP_LOGIN_ENABLED === "true";
  if (explicitRecoveryOverride) return true;

  try {
    const settings = await getAdminSettings();
    const activeOwnerCount = settings.staff.filter(
      (staff) => staff.status === "Active" && staff.role === "Owner",
    ).length;
    return shouldAllowAdminBootstrapLogin({ activeOwnerCount, explicitRecoveryOverride });
  } catch {
    // Once production setup exists, a database/read failure must not silently
    // reopen the shared environment-password login.
    return process.env.NODE_ENV !== "production";
  }
}
