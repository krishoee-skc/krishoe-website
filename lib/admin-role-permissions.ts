export const adminRoles = [
  "Owner",
  "Manager",
  "Accountant",
  "HR",
  "Inventory",
  "Sales",
  "Viewer",
] as const;

export type AdminRole = (typeof adminRoles)[number];

export const adminPermissions = [
  "activity:read",
  "backup:export",
  "costing:write",
  "exports:read",
  "hr:write",
  "messages:write",
  "notifications:write",
  "operations:write",
  "orders:write",
  "payments:write",
  "pos:write",
  "products:write",
  "purchasing:write",
  "readiness:read",
  "reviews:write",
  "settings:write",
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

const permissionsByRole: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  Owner: new Set(adminPermissions),
  Manager: new Set(
    adminPermissions.filter(
      (permission) => permission !== "backup:export" && permission !== "settings:write",
    ),
  ),
  Accountant: new Set([
    "activity:read",
    "costing:write",
    "exports:read",
    "orders:write",
    "payments:write",
    "pos:write",
    "purchasing:write",
    "readiness:read",
  ]),
  HR: new Set(["activity:read", "exports:read", "hr:write", "readiness:read"]),
  Inventory: new Set([
    "activity:read",
    "costing:write",
    "exports:read",
    "operations:write",
    "products:write",
    "purchasing:write",
    "readiness:read",
  ]),
  Sales: new Set([
    "activity:read",
    "exports:read",
    "messages:write",
    "orders:write",
    "payments:write",
    "pos:write",
    "readiness:read",
    "reviews:write",
  ]),
  Viewer: new Set(["activity:read", "exports:read", "readiness:read"]),
};

export function getConfiguredAdminRole(): AdminRole {
  const configuredRole = process.env.ADMIN_ROLE?.trim();
  return adminRoles.includes(configuredRole as AdminRole) ? (configuredRole as AdminRole) : "Owner";
}

export function getSessionAdminRole(session?: { role?: string } | null): AdminRole {
  return adminRoles.includes(session?.role as AdminRole)
    ? (session?.role as AdminRole)
    : getConfiguredAdminRole();
}

export function canAdmin(role: AdminRole, permission: AdminPermission) {
  return permissionsByRole[role].has(permission);
}

export function getAdminPermissionSummary(role = getConfiguredAdminRole()) {
  return {
    role,
    permissions: adminPermissions.map((permission) => ({
      permission,
      allowed: canAdmin(role, permission),
    })),
  };
}
