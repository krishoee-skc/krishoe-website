import { describe, expect, it } from "vitest";
import { checkPurchaseInvoicePosting, type PurchaseInvoice, type SupplierTransaction } from "@/lib/purchasing";

function invoice(overrides: Partial<PurchaseInvoice> = {}): PurchaseInvoice {
  return {
    id: "PUR-1",
    purchaseNumber: "KR-PUR-20260719-0001",
    createdAt: "2026-07-19T08:19:00.000Z",
    supplierLedgerId: "SUP-1",
    supplierName: "nobel shoe",
    kind: "Trading Goods",
    items: [],
    materialId: "",
    materialName: "Ladies Heel",
    design: "Ladies Heel",
    channel: "Wholesale",
    sizeRun: "Mixed",
    unit: "pair",
    quantity: 15,
    rate: 950,
    discount: 0,
    tax: 0,
    total: 14250,
    paidAmount: 0,
    creditAmount: 14250,
    paymentMethod: "Credit",
    paymentReference: "",
    status: "Credit",
    postingStatus: "Posted",
    supplierTransactionIds: ["TXN-1"],
    note: "",
    ...overrides,
  };
}

function billTransaction(amount: number): SupplierTransaction {
  return {
    id: "TXN-1",
    createdAt: "2026-07-19T08:19:00.000Z",
    supplierLedgerId: "SUP-1",
    supplierName: "nobel shoe",
    type: "Purchase Bill",
    amount,
    note: "",
  };
}

const suppliers = new Set(["SUP-1"]);
const materials = new Set(["RAW-1"]);

// The false alarm the owner saw: a Trading Goods bill (ready-made pairs bought
// to resell) was flagged "raw material missing" and stuck on Needs Review, even
// though it was posted perfectly. Resale pairs never touch the raw material
// store, so they must not be asked for one.
describe("posting health of a purchase bill", () => {
  it("does not ask a trading goods bill for a raw material", () => {
    const check = checkPurchaseInvoicePosting(invoice(), [billTransaction(14250)], suppliers, materials);

    expect(check.materialExists).toBe(true);
    expect(check.issues).not.toContain("raw material missing");
    expect(check.issues).toHaveLength(0);
  });

  it("still flags a raw material bill whose material was deleted", () => {
    const check = checkPurchaseInvoicePosting(
      invoice({ kind: "Raw Material", materialId: "RAW-GONE", design: "", channel: "" }),
      [billTransaction(14250)],
      suppliers,
      materials,
    );

    expect(check.materialExists).toBe(false);
    expect(check.issues).toContain("raw material missing");
  });

  it("passes a raw material bill whose material exists", () => {
    const check = checkPurchaseInvoicePosting(
      invoice({ kind: "Raw Material", materialId: "RAW-1", design: "", channel: "" }),
      [billTransaction(14250)],
      suppliers,
      materials,
    );

    expect(check.materialExists).toBe(true);
    expect(check.issues).toHaveLength(0);
  });

  it("flags a bill whose purchase transaction never posted", () => {
    const check = checkPurchaseInvoicePosting(invoice(), [], suppliers, materials);

    expect(check.billPosted).toBe(false);
    expect(check.issues).toContain("purchase bill transaction missing");
  });

  it("flags a bill whose supplier is gone", () => {
    const check = checkPurchaseInvoicePosting(
      invoice({ supplierLedgerId: "SUP-GONE" }),
      [billTransaction(14250)],
      suppliers,
      materials,
    );

    expect(check.supplierExists).toBe(false);
    expect(check.issues).toContain("supplier missing");
  });

  it("wants the payment posted when the bill was paid by cash", () => {
    const paid = invoice({ paymentMethod: "Cash", paidAmount: 14250, creditAmount: 0, status: "Paid" });

    const withoutPayment = checkPurchaseInvoicePosting(paid, [billTransaction(14250)], suppliers, materials);
    expect(withoutPayment.paymentPosted).toBe(false);
    expect(withoutPayment.issues).toContain("payment transaction missing");

    const withPayment = checkPurchaseInvoicePosting(
      paid,
      [
        billTransaction(14250),
        { ...billTransaction(14250), id: "TXN-2", type: "Cash Payment", amount: 14250 },
      ],
      suppliers,
      materials,
    );
    expect(withPayment.paymentPosted).toBe(true);
    expect(withPayment.issues).toHaveLength(0);
  });
});
