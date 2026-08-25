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
const productionOrWages = ["production:entry", "wages:write"] as const;
const wagesOnly = ["wages:write"] as const;

const factoryApiPolicies: Record<string, Partial<Record<string, FactoryApiPolicy>>> = {
  "/api/factory/items": {
    GET: { permissions: productionEntry },
    POST: { permissions: ["operations:write"], ownerOnly: true },
    PATCH: { permissions: ["operations:write"], ownerOnly: true },
  },
  "/api/factory/ledger": {
    GET: { permissions: wagesOnly },
    POST: { permissions: ["wages:write"], ownerOnly: true },
  },
  "/api/factory/monthly-summary": {
    GET: { permissions: wagesOnly },
    POST: { permissions: ["wages:write"], ownerOnly: true },
  },
  "/api/factory/rates": {
    GET: { permissions: productionEntry },
    POST: { permissions: ["costing:write"], ownerOnly: true },
  },
  // Reading what is made but not yet on the shelf is part of entering work.
  // Putting pairs on the shelf is a stock decision, held to the same bar as
  // every other door into stock: the owner, and operations:write.
  "/api/factory/ready": {
    GET: { permissions: productionEntry },
    POST: { permissions: ["operations:write"], ownerOnly: true },
  },
  "/api/factory/salary": {
    GET: { permissions: wagesOnly },
  },
  "/api/factory/salary-advance": {
    POST: { permissions: ["wages:write"], ownerOnly: true },
  },
  "/api/factory/salary-payment": {
    POST: { permissions: ["wages:write"], ownerOnly: true },
  },
  "/api/factory/work": {
    GET: { permissions: productionEntry },
    POST: { permissions: productionEntry },
  },
  "/api/factory/workers": {
    GET: { permissions: productionOrWages },
    POST: { permissions: ["wages:write"], ownerOnly: true },
    PATCH: { permissions: ["wages:write"], ownerOnly: true },
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
