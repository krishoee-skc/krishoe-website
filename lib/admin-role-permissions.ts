export const adminRoles = [
  "Owner",
  "Manager",
  "Accountant",
  "HR",
  "Inventory",
  "Sales",
  "Factory",
  "Worker",
  "Viewer",
] as const;

export type AdminRole = (typeof adminRoles)[number];

export const adminPermissions = [
  "activity:read",
  "backup:export",
  "costing:read",
  "costing:write",
  "customers:read",
  "dashboard:read",
  "devices:read",
  "dues:read",
  "exports:read",
  "feedback:read",
  "feedback:write",
  "hr:read",
  "hr:write",
  "insights:read",
  "messages:write",
  "messages:read",
  "notifications:read",
  "notifications:write",
  "operations:read",
  "operations:write",
  "orders:read",
  "orders:write",
  "payments:read",
  "payments:write",
  "pos:read",
  "pos:write",
  "production:entry",
  "products:read",
  "products:write",
  "purchasing:read",
  "purchasing:write",
  "readiness:read",
  "reviews:read",
  "reviews:write",
  "search:read",
  "security:read",
  "stock:read",
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
    "costing:read",
    "costing:write",
    "customers:read",
    "dashboard:read",
    "devices:read",
    "dues:read",
    "exports:read",
    "orders:read",
    "orders:write",
    "payments:read",
    "payments:write",
    "pos:read",
    "pos:write",
    "purchasing:read",
    "purchasing:write",
    "readiness:read",
    "search:read",
    "security:read",
    "stock:read",
  ]),
  HR: new Set([
    "activity:read",
    "dashboard:read",
    "devices:read",
    "exports:read",
    "hr:read",
    "hr:write",
    "readiness:read",
    "search:read",
    "security:read",
  ]),
  Inventory: new Set([
    "activity:read",
    "costing:read",
    "costing:write",
    "dashboard:read",
    "devices:read",
    "exports:read",
    "operations:read",
    "operations:write",
    "products:read",
    "products:write",
    "purchasing:read",
    "purchasing:write",
    "readiness:read",
    "search:read",
    "security:read",
    "stock:read",
  ]),
  Sales: new Set([
    "activity:read",
    "customers:read",
    "dashboard:read",
    "devices:read",
    "dues:read",
    "exports:read",
    "feedback:read",
    "feedback:write",
    "insights:read",
    "messages:read",
    "messages:write",
    "notifications:read",
    "orders:read",
    "orders:write",
    "payments:read",
    "payments:write",
    "pos:read",
    "pos:write",
    "products:read",
    "readiness:read",
    "reviews:read",
    "reviews:write",
    "search:read",
    "security:read",
    "stock:read",
  ]),
  Factory: new Set([
    "activity:read",
    "devices:read",
    "production:entry",
    "readiness:read",
    "security:read",
  ]),
  Worker: new Set(),
  Viewer: new Set(
    adminPermissions.filter(
      (permission) => permission.endsWith(":read") && permission !== "settings:write",
    ),
  ),
};

const adminPagePermissionPrefixes: ReadonlyArray<readonly [string, AdminPermission]> = [
  ["/admin/factory", "production:entry"],
  ["/admin/alerts", "notifications:read"],
  ["/admin/analytics", "insights:read"],
  ["/admin/feedback", "feedback:read"],
  ["/admin/monitoring", "security:read"],
  ["/admin/sms", "notifications:read"],
  ["/admin/search", "search:read"],
  ["/admin/stock", "stock:read"],
  ["/admin/pos", "pos:read"],
  ["/admin/dues", "dues:read"],
  ["/admin/purchasing", "purchasing:read"],
  ["/admin/costing", "costing:read"],
  ["/admin/hr", "hr:read"],
  ["/admin/operations", "operations:read"],
  ["/admin/orders", "orders:read"],
  ["/admin/customers", "customers:read"],
  ["/admin/payments", "payments:read"],
  ["/admin/notifications", "notifications:read"],
  ["/admin/reviews", "reviews:read"],
  ["/admin/insights", "insights:read"],
  ["/admin/activity", "activity:read"],
  ["/admin/security", "security:read"],
  ["/admin/settings", "settings:write"],
  ["/admin/products", "products:read"],
  ["/admin/messages", "messages:read"],
  ["/admin/devices", "devices:read"],
];

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

export function getAdminPagePermission(pathname: string): AdminPermission | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/admin";
  if (normalizedPath === "/admin") return "dashboard:read";

  return adminPagePermissionPrefixes.find(
    ([prefix]) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  )?.[1] ?? null;
}

export function canAccessAdminPath(role: AdminRole, pathname: string) {
  const permission = getAdminPagePermission(pathname);
  return permission ? canAdmin(role, permission) : true;
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
