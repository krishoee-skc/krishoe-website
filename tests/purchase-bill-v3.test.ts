import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  exactSupplier,
  searchSuppliers,
  similarSuppliers,
  supplierKey,
} from "@/app/admin/purchasing/_components/purchase-invoice-rules";
import { billHasKind, purchaseKindTotals, purchaseLinesOf } from "@/lib/purchase-kinds";
import { purchaseMemory } from "@/lib/purchase-memory";
import type { PurchaseInvoice, PurchaseInvoiceItem } from "@/lib/purchasing";

/**
 * The purchase bill, third pass — the owner's sample 3.
 *
 * One supplier box instead of three; the bill form first on the page; ready-
 * made shoes and raw material counted apart, with every line of a bill shown;
 * and "paid" that starts at the total for a supplier always paid in full.
 */

const suppliers = [
  { id: "SUP-1", supplierName: "Shirti collection", phone: "9801234567", balanceDue: 0 },
  { id: "SUP-2", supplierName: "new ananda", phone: "", balanceDue: 4500 },
  { id: "SUP-3", supplierName: "Sagar Traders", phone: "9812000000", balanceDue: 12000 },
];

describe("one supplier box", () => {
  it("finds a supplier by the start of the name first, then anywhere in it", () => {
    expect(searchSuppliers(suppliers, "shir").map((row) => row.id)).toEqual(["SUP-1"]);
    expect(searchSuppliers(suppliers, "ANANDA").map((row) => row.id)).toEqual(["SUP-2"]);
    // "Shirti collection" has no "a" in it, so it is not offered.
    expect(searchSuppliers(suppliers, "a").map((row) => row.id)).toEqual(["SUP-2", "SUP-3"]);
  });

  it("finds a supplier by phone digits", () => {
    expect(searchSuppliers(suppliers, "9812").map((row) => row.id)).toEqual(["SUP-3"]);
  });

  it("lists those owed money first when nothing is typed", () => {
    expect(searchSuppliers(suppliers, "").map((row) => row.id)).toEqual(["SUP-3", "SUP-2", "SUP-1"]);
  });

  it("takes a name typed another way as the same supplier", () => {
    expect(supplierKey("  Shirti   Collection. ")).toBe("shirti collection");
    expect(exactSupplier(suppliers, "shirti COLLECTION")?.id).toBe("SUP-1");
    expect(exactSupplier(suppliers, "Shirti Col")).toBeUndefined();
  });

  it("asks before a look-alike becomes a second supplier", () => {
    expect(similarSuppliers(suppliers, "shirti").map((row) => row.id)).toEqual(["SUP-1"]);
    expect(similarSuppliers(suppliers, "Sagar Footwear").map((row) => row.id)).toEqual(["SUP-3"]);
    expect(similarSuppliers(suppliers, "Himal Store")).toEqual([]);
    // Two letters is not enough to ask about.
    expect(similarSuppliers(suppliers, "ne")).toEqual([]);
  });
});

function line(overrides: Partial<PurchaseInvoiceItem>): PurchaseInvoiceItem {
  return {
    id: "L",
    lineNo: 1,
    kind: "Raw Material",
    materialId: "",
    itemName: "",
    design: "",
    channel: "",
    sizeRun: "Mixed",
    unit: "piece",
    quantity: 0,
    rate: 0,
    lineSubtotal: 0,
    lineTotal: 0,
    note: "",
    ...overrides,
  };
}

function bill(overrides: Partial<PurchaseInvoice>): PurchaseInvoice {
  return {
    id: "PUR-1",
    purchaseNumber: "KR-PUR-1",
    createdAt: "2026-09-26T04:00:00.000Z",
    supplierLedgerId: "SUP-1",
    supplierName: "Shirti collection",
    kind: "Raw Material",
    items: [],
    materialId: "",
    materialName: "",
    design: "",
    channel: "",
    sizeRun: "Mixed",
    unit: "piece",
    quantity: 0,
    rate: 0,
    discount: 0,
    tax: 0,
    total: 0,
    paidAmount: 0,
    creditAmount: 0,
    paymentMethod: "Cash",
    paymentReference: "",
    status: "Paid",
    postingStatus: "Posted",
    supplierTransactionIds: [],
    supplierBillNo: "",
    note: "",
    ...overrides,
  };
}

const mixedBill = bill({
  kind: "Mixed",
  total: 23040 + 1200,
  items: [
    line({ kind: "Trading Goods", design: "eva slipers efm 029", itemName: "eva slipers efm 029", quantity: 36, unit: "pair", lineTotal: 23040 }),
    line({ kind: "Raw Material", itemName: "Rexine", quantity: 4, unit: "meter", lineTotal: 800 }),
    line({ kind: "Raw Material", itemName: "Buckle", quantity: 100, unit: "piece", lineTotal: 400 }),
  ],
});
const shoeBill = bill({
  id: "PUR-2",
  kind: "Trading Goods",
  total: 17250,
  items: [line({ kind: "Trading Goods", design: "Doctor Chappal", itemName: "Doctor Chappal", quantity: 30, unit: "pair", lineTotal: 17250 })],
});

describe("ready-made shoes and raw material, apart", () => {
  it("shows every line of a bill, each with its kind", () => {
    expect(purchaseLinesOf(mixedBill).map((row) => [row.kind, row.name, row.quantity, row.unit])).toEqual([
      ["Trading Goods", "eva slipers efm 029", 36, "pair"],
      ["Raw Material", "Rexine", 4, "meter"],
      ["Raw Material", "Buckle", 100, "piece"],
    ]);
  });

  it("reads a bill from before lines as its one summary line", () => {
    const old = bill({ kind: "Trading Goods", design: "Doctor Chappal", materialName: "Doctor Chappal", quantity: 12, total: 6900 });
    expect(purchaseLinesOf(old)).toEqual([{ kind: "Trading Goods", name: "Doctor Chappal", quantity: 12, unit: "pair", total: 6900 }]);
  });

  it("adds up each kind with its pairs and bills, a mixed bill counted under both", () => {
    const totals = purchaseKindTotals([mixedBill, shoeBill]);
    expect(totals.ready).toMatchObject({ total: 40290, pairs: 66, bills: 2 });
    expect(totals.raw).toMatchObject({ total: 1200, bills: 1 });
    expect(totals.ready.top[0]).toMatchObject({ name: "eva slipers efm 029", quantity: 36, total: 23040 });
    expect(totals.raw.top.map((row) => row.name)).toEqual(["Rexine", "Buckle"]);
  });

  it("filters the bill list by what a bill carried", () => {
    expect(billHasKind(mixedBill, "Raw Material")).toBe(true);
    expect(billHasKind(shoeBill, "Raw Material")).toBe(false);
    expect(billHasKind(shoeBill, "Trading Goods")).toBe(true);
  });
});

describe("paid in full, remembered", () => {
  it("starts a supplier at the total when their last bills were all paid on the spot", () => {
    const memory = purchaseMemory([
      bill({ id: "A", createdAt: "2026-09-26T04:00:00.000Z", total: 100, paidAmount: 100 }),
      bill({ id: "B", createdAt: "2026-09-25T04:00:00.000Z", total: 100, paidAmount: 100 }),
    ]);
    expect(memory.suppliers["SUP-1"].paysInFull).toBe(true);
  });

  it("does not when one of the last three was left on credit", () => {
    const memory = purchaseMemory([
      bill({ id: "A", createdAt: "2026-09-26T04:00:00.000Z", total: 100, paidAmount: 100 }),
      bill({ id: "B", createdAt: "2026-09-25T04:00:00.000Z", total: 100, paidAmount: 40, creditAmount: 60, status: "Partial" }),
    ]);
    expect(memory.suppliers["SUP-1"].paysInFull).toBe(false);
  });

  it("looks only at the last three bills", () => {
    const memory = purchaseMemory([
      bill({ id: "A", createdAt: "2026-09-26T04:00:00.000Z", total: 100, paidAmount: 100 }),
      bill({ id: "B", createdAt: "2026-09-25T04:00:00.000Z", total: 100, paidAmount: 100 }),
      bill({ id: "C", createdAt: "2026-09-24T04:00:00.000Z", total: 100, paidAmount: 100 }),
      bill({ id: "D", createdAt: "2026-01-01T04:00:00.000Z", total: 100, paidAmount: 0, creditAmount: 100, paymentMethod: "Credit", status: "Credit" }),
    ]);
    expect(memory.suppliers["SUP-1"].paysInFull).toBe(true);
  });
});

describe("the page, in the order it is used", () => {
  it("opens on the bill form, with the figures after it", async () => {
    const page = await readFile("app/admin/purchasing/page.tsx", "utf8");
    expect(page.indexOf("<PurchaseInvoiceForm")).toBeLessThan(page.indexOf('label={<T en="Today purchase"'));
    // Three figures in view, the rest under "More".
    expect(page).toContain('<T en="▾ More figures" ne="▾ थप हिसाब" />');
  });

  it("no longer calls sales less purchases a profit", async () => {
    const page = await readFile("app/admin/purchasing/page.tsx", "utf8");
    expect(page).not.toContain('ne="महिनाको नाफाको सङ्केत"');
    expect(page).toContain("नाफा होइन");
  });

  it("puts the cursor in the supplier box on a computer, not on a phone", async () => {
    const form = await readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8");
    expect(form).toContain('window.matchMedia?.("(pointer: fine)").matches');
  });

  it("asks the new supplier's phone only once a new name is typed", async () => {
    const form = await readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8");
    const phone = form.slice(form.indexOf("{supplierIsNew ? ("), form.indexOf('name="phone"'));
    expect(phone.length).toBeGreaterThan(0);
  });
});
