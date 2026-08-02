import { AsyncLocalStorage } from "node:async_hooks";

export type AdminBranchContext = {
  branchId: string;
  bypass: boolean;
  staffId: string;
};

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
