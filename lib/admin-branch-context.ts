import { AsyncLocalStorage } from "node:async_hooks";

export type AdminBranchContext = {
  branchId: string;
  bypass: boolean;
  staffId: string;
};

/**
 * The staff role the app lets read past its own branch.
 *
 * It lives here, beside the context it sets, so that the monitoring screen
 * reports the exemption from the same constant that grants it. A screen that
 * described this from a second copy would keep saying "Owner" on the day
 * somebody changed the first one.
 */
export const allBranchAdminRole = "Owner" as const;

declare global {
  var krishoeAdminBranchContext: AsyncLocalStorage<AdminBranchContext> | undefined;
}

function storage() {
  if (!globalThis.krishoeAdminBranchContext) {
    globalThis.krishoeAdminBranchContext = new AsyncLocalStorage<AdminBranchContext>();
  }
  return globalThis.krishoeAdminBranchContext;
}

// Called after the signed admin session and device session have both been
// verified. AsyncLocalStorage keeps this branch identity isolated to the
// current request, including its downstream database calls.
export function activateAdminBranchContext(context: AdminBranchContext) {
  storage().enterWith({
    branchId: context.branchId.trim(),
    bypass: context.bypass,
    staffId: context.staffId.trim(),
  });
}

export function getAdminBranchContext() {
  return storage().getStore() ?? null;
}
