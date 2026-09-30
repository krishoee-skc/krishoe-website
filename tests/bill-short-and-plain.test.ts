import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isBillNumberTaken, nextBillNumber, noteNamesBill } from "@/lib/bill-number";
import { sameCode } from "@/lib/shoe-code";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The bill, made short and plain (owner, 2026-09-30): KRB001 for
 * KR-BILL-20260930-0001-C8EA72, the pairs added up, no figure or dash printed
 * for nothing, and the HS Code column left empty.
 */
describe("short bill numbers", () => {
  it("counts on from the highest, old numbers aside", () => {
    expect(nextBillNumber("Sale", [])).toBe("KRB001");
    expect(nextBillNumber("Sale", ["KR-BILL-20260930-0001-C8EA72", "KRB001", "KRB007", "KRR009"])).toBe("KRB008");
    expect(nextBillNumber("Return", ["KRB004", "KR-RT-20260930-0001-AB12CD"])).toBe("KRR001");
    expect(nextBillNumber("Sale", ["KRB999"])).toBe("KRB1000");
  });

  it("is never read as a shoe code at the counter", () => {
    expect(sameCode("KR-205", "KRB205")).toBe(false);
    expect(sameCode("KR-205", "KRR205")).toBe(false);
  });

  it("finds a bill's own notes, not a longer number's", () => {
    expect(noteNamesBill("KRB100 sale KR-205", "KRB100")).toBe(true);
    expect(noteNamesBill("KRB1000 sale KR-205", "KRB100")).toBe(false);
    expect(noteNamesBill("KR-BILL-20260930-0001-C8EA72 sale KR-205", "KR-BILL-20260930-0001-C8EA72")).toBe(true);
    expect(noteNamesBill("Exchange with KRB012.", "KRB012")).toBe(true);
  });

  it("tries the next number when two bills take one at once", async () => {
    expect(isBillNumberTaken({ code: "23505", constraint: "pos_invoices_invoice_number_key" })).toBe(true);
    expect(isBillNumberTaken({ code: "23505", constraint: "pos_invoices_submission_key_idx" })).toBe(false);
    const pos = await read("lib/pos.ts");
    expect(pos).toContain("if (isBillNumberTaken(error) && attempt < BILL_NUMBER_TRIES) return createPosInvoice(input, attempt + 1);");
    expect(pos).toContain("if (isBillNumberTaken(error) && attempt < BILL_NUMBER_TRIES) return createPosExchange(input, attempt + 1);");
    expect(pos).not.toContain("randomUUID().slice(0, 6)");
  });
});

describe("the printed bill", () => {
  it("adds up the pairs, and prints Basic Total and Remarks only when they say something", async () => {
    const page = await read("app/admin/pos/[id]/page.tsx");
    expect(page).toContain(">Total Pairs</td>");
    expect(page).toContain("{invoice.discount > 0 || invoice.tax > 0 ? (");
    expect(page).not.toContain('Remarks: {invoice.note || "—"}');
    expect(page).toContain("{invoice.note ? (");
  });

  it("keeps the HS Code column, empty", async () => {
    const page = await read("app/admin/pos/[id]/page.tsx");
    expect(page).toContain('const HS_CODE = "";');
    expect(page).toContain(">HS Code</th>");
  });
});
