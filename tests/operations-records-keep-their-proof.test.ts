import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PROOF_KINDS, REASON_MIN } from "@/lib/operation-record-rules";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/** Owner, 2026-10-20 (audit 5): Operations records keep their proof. */
describe("removing an Operations record", () => {
  it("never takes a customer's account away with its lines", async () => {
    const actions = await read("app/admin/operations/actions.ts");
    const proof = await read("lib/operation-record-proof.ts");
    expect(actions).toContain('if (kind === "customerLedger") {');
    expect(actions).toContain("const lines = await customerLedgerLineCount(id);");
    expect(proof).toContain("FROM ledger_transactions WHERE ledger_id = $1");
  });

  it("removes a stock movement or batch only for the Owner, with a reason, after a full copy is kept", async () => {
    expect(PROOF_KINDS).toEqual(["stockMovement", "productionBatch"]);
    expect(REASON_MIN).toBe(5);
    const actions = await read("app/admin/operations/actions.ts");
    const copy = actions.indexOf("const snapshot = await operationRecordSnapshot(kind, id);");
    const kept = actions.indexOf("await appendAdminAuditEvent(", copy);
    const removed = actions.indexOf("await deleteOperationRecord(kind, id);");
    expect(copy).toBeGreaterThan(0);
    // The copy is written (and may fail, stopping everything) before the record goes.
    expect(kept).toBeGreaterThan(copy);
    expect(removed).toBeGreaterThan(kept);
    expect(actions).toContain('if (role !== "Owner") {');
    expect(actions).toContain("if (reason.length < REASON_MIN) {");
    const form = await read("app/admin/operations/_components/operations-ui.tsx");
    expect(form).toContain('<input name="reason" required minLength={REASON_MIN} className={compactInputClass} />');
  });
});
