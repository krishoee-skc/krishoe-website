import { requireAdminSession } from "@/lib/admin-auth";
import {
  canAdmin,
  getAdminPagePermission,
  getSessionAdminRole,
  type AdminPermission,
} from "@/lib/admin-role-permissions";

export {
  adminPermissions,
  adminRoles,
  canAccessAdminPath,
  canAdmin,
  getAdminPagePermission,
  getAdminPermissionSummary,
  getConfiguredAdminRole,
  getSessionAdminRole,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-role-permissions";

export async function requireAdminPermission(permission: AdminPermission) {
  const session = await requireAdminSession();

  if (session.mustChangePassword) {
    throw new Error("Change the temporary staff password before using admin tools.");
  }
  const role = getSessionAdminRole(session);

  if (!canAdmin(role, permission)) {
    throw new Error(`Admin role ${role} is not allowed to perform ${permission}.`);
  }

  return { session, role };
}

export async function requireAdminPageAccess(pathname: string) {
  const permission = getAdminPagePermission(pathname);

  if (!permission) {
    return requireAdminSession();
  }

  return requireAdminPermission(permission);
}
