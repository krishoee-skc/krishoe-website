import { requireAdminSession } from "@/lib/admin-auth";
import {
  canAdmin,
  getSessionAdminRole,
  type AdminPermission,
} from "@/lib/admin-role-permissions";

export {
  adminPermissions,
  adminRoles,
  canAdmin,
  getAdminPermissionSummary,
  getConfiguredAdminRole,
  getSessionAdminRole,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-role-permissions";

export async function requireAdminPermission(permission: AdminPermission) {
  const session = await requireAdminSession();
  const role = getSessionAdminRole(session);

  if (!canAdmin(role, permission)) {
    throw new Error(`Admin role ${role} is not allowed to perform ${permission}.`);
  }

  return { session, role };
}
