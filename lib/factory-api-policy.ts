import {
  canAdmin,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-role-permissions";

export type FactoryApiPolicy = {
  permissions: readonly AdminPermission[];
  ownerOnly?: boolean;
};

const productionEntry = ["production:entry"] as const;
const productionOrHr = ["production:entry", "hr:write"] as const;
const hrRead = ["hr:write"] as const;

const factoryApiPolicies: Record<string, Partial<Record<string, FactoryApiPolicy>>> = {
  "/api/factory/items": {
    GET: { permissions: productionEntry },
    POST: { permissions: ["operations:write"], ownerOnly: true },
  },
  "/api/factory/ledger": {
    GET: { permissions: hrRead },
    POST: { permissions: ["hr:write"], ownerOnly: true },
  },
  "/api/factory/monthly-summary": {
    GET: { permissions: hrRead },
    POST: { permissions: ["hr:write"], ownerOnly: true },
  },
  "/api/factory/rates": {
    GET: { permissions: productionEntry },
    POST: { permissions: ["costing:write"], ownerOnly: true },
  },
  "/api/factory/salary": {
    GET: { permissions: hrRead },
  },
  "/api/factory/salary-advance": {
    POST: { permissions: ["hr:write"], ownerOnly: true },
  },
  "/api/factory/salary-payment": {
    POST: { permissions: ["hr:write"], ownerOnly: true },
  },
  "/api/factory/work": {
    GET: { permissions: productionEntry },
    POST: { permissions: productionEntry },
  },
  "/api/factory/workers": {
    GET: { permissions: productionOrHr },
    POST: { permissions: ["hr:write"], ownerOnly: true },
    PATCH: { permissions: ["hr:write"], ownerOnly: true },
  },
};

function normalizeFactoryApiPath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

export function getFactoryApiPolicy(pathname: string, method: string) {
  return factoryApiPolicies[normalizeFactoryApiPath(pathname)]?.[method.toUpperCase()] ?? null;
}

export function canAccessFactoryApi(role: AdminRole, policy: FactoryApiPolicy) {
  if (policy.ownerOnly && role !== "Owner") {
    return false;
  }

  return policy.permissions.some((permission) => canAdmin(role, permission));
}
