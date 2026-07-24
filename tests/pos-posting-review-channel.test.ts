import { describe, expect, it } from "vitest";
import { buildPosPostingReviewRows } from "@/lib/pos";
import type { PosInvoice } from "@/lib/pos";
import type { OperationsData, StockMovement } from "@/lib/operations";

// A cash retail sale of a design whose pairs sit in the wholesale pool. The sale
// draws from that pool, so its Sale Out movement is recorded on Wholesale while
// the bill is reported on Retail. The posting review must still see the movement
// as posted — matching on channel here was the bug that flagged a false "stock
// movement missing" and then made Repair try to re-post pairs that were fine.
function invoice(overrides: Partial<PosInvoice> = {}): PosInvoice {
  return {
    id: "POS-1",
    invoiceNumber: "KR-BILL-1",
    createdAt: "2026-07-22T04:00:00.000Z",
    channel: "Retail",
    kind: "Sale",
    customerName: "saroj",
    phone: "",
    cashier: "",
    paymentMethod: "Cash",
    paymentReference: "",
    ledgerId: "",
    subtotal: 4990,
    discount: 0,
    tax: 0,
    total: 4990,
    paidAmount: 4990,
    creditAmount: 0,
    status: "Paid",
    postingStatus: "Posted",
    items: [
      { id: "IT-1", sku: "skc-06", design: "Bachha Rubber (Kids)", sizeRun: "Mixed", quantity: 10, rate: 499, discount: 0, lineTotal: 4990 },
    ],
    stockMovementIds: [],
    ledgerTransactionId: "",
    barcodeValue: "",
    qrPayload: "",
    note: "",
    ...overrides,
  };
}

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: "SM-1",
    createdAt: "2026-07-22T04:00:00.000Z",
    design: "Bachha Rubber (Kids)",
    channel: "Wholesale",
    sizeRun: "Mixed",
    type: "Sale Out",
    pairs: 10,
    note: "KR-BILL-1 sale skc-06",
    ...overrides,
  } as StockMovement;
}

function operations(stockMovements: StockMovement[]): OperationsData {
  return { stockMovements, customerLedgers: [], ledgerTransactions: [] } as unknown as OperationsData;
}

describe("posting review reads stock as one pool", () => {
  it("counts a retail bill's movement even when it sits on the wholesale pool", () => {
    const [row] = buildPosPostingReviewRows([invoice()], operations([movement()]));

    expect(row.signal).toBe("Posted");
    expect(row.issues).toBe("");
  });

  it("still flags a bill whose pairs were never posted", () => {
    // Only 4 of the 10 sold pairs have a movement — genuinely short.
    const [row] = buildPosPostingReviewRows([invoice()], operations([movement({ pairs: 4 })]));

    expect(row.signal).toBe("Needs Review");
    expect(row.issues).toContain("stock movement missing");
  });

  it("still flags a bill that was never marked posted", () => {
    const [row] = buildPosPostingReviewRows(
      [invoice({ postingStatus: "Needs Review" })],
      operations([movement()]),
    );

    expect(row.signal).toBe("Needs Review");
    expect(row.issues).toContain("invoice not posted");
  });
});
