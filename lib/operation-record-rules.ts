import type { OperationRecordKind } from "@/lib/operations";

/**
 * The Operations records removed only by the Owner, with a reason and a full
 * copy kept in the audit log (owner, 2026-10-20, audit 5). Kept apart from
 * lib/operation-record-proof.ts so a form can read it without the database.
 */
export const PROOF_KINDS: OperationRecordKind[] = ["stockMovement", "productionBatch"];
export const REASON_MIN = 5;
