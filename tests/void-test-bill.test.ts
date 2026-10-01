import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { voidRefusal } from "@/lib/pos-void";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The Owner cancels a test bill (owner, 2026-10-01): a Rs. 10,500 "cheque"
 * from a walk-in nobody, "sample 2", "costomer 3". A return would have left a
 * made-up customer owed the money and the bill still Paid.
 */
const plain = { kind: "Sale", status: "Paid", creditAmount: 0, ledgerTransactionId: "", payments: [] };

describe("which bills can be cancelled as a test", () => {
  it("a plain paid sale, cash or cheque", () => {
    expect(voidRefusal(plain)).toBeNull();
    expect(voidRefusal({ ...plain, payments: [{ method: "Cheque", purpose: "bill" }] })).toBeNull();
  });

  it("not a return, a cancelled or returned bill, credit, an exchange or old credit", () => {
    expect(voidRefusal({ ...plain, kind: "Return" })?.en).toMatch(/Only a sale/);
    expect(voidRefusal({ ...plain, status: "Voided" })?.en).toMatch(/already cancelled/);
    expect(voidRefusal({ ...plain, status: "Returned" })?.en).toMatch(/returned/);
    expect(voidRefusal({ ...plain, creditAmount: 500 })?.en).toMatch(/customer's account/);
    expect(voidRefusal({ ...plain, ledgerTransactionId: "LTX-1" })?.en).toMatch(/customer's account/);
    expect(voidRefusal({ ...plain, payments: [{ method: "Exchange", purpose: "bill" }] })?.en).toMatch(/exchange/);
    expect(voidRefusal({ ...plain, payments: [{ method: "Cash", purpose: "due" }] })?.en).toMatch(/old credit/);
  });
});

describe("how it cancels", () => {
  it("mirrors the bill's own Sale Out movements back in, and marks it Voided, in one transaction", async () => {
    const code = await read("lib/pos-void.ts");
    expect(code).toContain("SELECT * FROM pos_invoices WHERE id = $1 FOR UPDATE");
    expect(code).toContain('if (moves.length !== ids.length || moves.some((move) => move.type !== "Sale Out")) {');
    expect(code).toContain('type: "Return In" as StockMovementType,');
    expect(code).toContain("UPDATE pos_invoices SET status = 'Voided'");
    expect(code).not.toMatch(/DELETE FROM/);
  });

  it("is the Owner's alone, asks a reason and a tick, and takes the cheque out of the book", async () => {
    const action = await read("app/admin/pos/actions.ts");
    expect(action).toContain('const { session } = await requireAdminPermission("settings:write");');
    expect(action).toContain('if (textValue(formData, "confirm") !== "yes")');
    expect(action).toContain("cancelBillCheque(id, session.name ?? \"\")");
    const page = await read("app/admin/pos/[id]/page.tsx");
    expect(page).toContain('canAdmin(role, "settings:write") &&');
    expect(page).toContain("data-bill-voided");
  });

  it("is left out wherever sales are counted", async () => {
    expect(await read("lib/dashboard-figures.ts")).toContain('if (invoice.status === "Voided") return 0;');
    expect(await read("lib/period-report.ts")).toContain('return invoice.status !== "Voided" && invoice.kind === "Sale";');
    expect(await read("lib/cheques.ts")).toContain('if (invoice.kind !== "Sale" || invoice.status === "Voided") return 0;');
  });
});
