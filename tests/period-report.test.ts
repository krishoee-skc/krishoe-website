import { describe, expect, it } from "vitest";
import type { PosInvoice, PosInvoiceItem } from "@/lib/pos";
import type { PurchaseInvoice } from "@/lib/purchasing";
import {
  buildPeriodReport,
  monthlyRanges,
  weeklyRanges,
} from "@/lib/period-report";

// A sale/return bill trimmed to the fields the report reads. Everything else is
// filled with harmless defaults so the whole PosInvoice type is satisfied.
function pos(overrides: {
  createdAt: string;
  total: number;
  kind?: PosInvoice["kind"];
  status?: PosInvoice["status"];
  paidAmount?: number;
  items?: Array<{ design: string; quantity: number }>;
}): PosInvoice {
  const items: PosInvoiceItem[] = (overrides.items ?? []).map((item, index) => ({
    id: `item-${index}`,
    sku: "",
    design: item.design,
    sizeRun: "",
    quantity: item.quantity,
    rate: 0,
    discount: 0,
    lineTotal: 0,
  }));

  return {
    id: `pos-${overrides.createdAt}-${overrides.total}`,
    invoiceNumber: "POS-1",
    createdAt: overrides.createdAt,
    channel: "Retail",
    kind: overrides.kind ?? "Sale",
    customerName: "",
    phone: "",
    cashier: "",
    paymentMethod: "Cash",
    paymentReference: "",
    ledgerId: "",
    subtotal: overrides.total,
    discount: 0,
    tax: 0,
    total: overrides.total,
    paidAmount: overrides.paidAmount ?? overrides.total,
    creditAmount: 0,
    status: overrides.status ?? "Paid",
    postingStatus: "Posted",
    items,
    stockMovementIds: [],
    ledgerTransactionId: "",
    barcodeValue: "",
    qrPayload: "",
    note: "",
  } as PosInvoice;
}

function purchase(createdAt: string, total: number): PurchaseInvoice {
  return { createdAt, total } as PurchaseInvoice;
}

describe("the weekly / monthly digest", () => {
  it("nets returns out of sales and estimates profit against purchases", () => {
    const report = buildPeriodReport({
      kind: "weekly",
      label: "गएको ७ दिन",
      posInvoices: [
        pos({ createdAt: "2026-07-20T04:00:00.000Z", total: 10_000 }),
        pos({ createdAt: "2026-07-21T04:00:00.000Z", total: 4_000 }),
        pos({ createdAt: "2026-07-22T04:00:00.000Z", total: 1_000, kind: "Return" }),
      ],
      purchaseInvoices: [purchase("2026-07-20T04:00:00.000Z", 5_000)],
      current: { startKey: "2026-07-19", endKey: "2026-07-26" },
      previous: { startKey: "2026-07-12", endKey: "2026-07-19" },
    });

    expect(report.netSales).toBe(13_000);
    expect(report.purchase).toBe(5_000);
    expect(report.netProfitEstimate).toBe(8_000);
  });

  it("keeps a voided bill out of every total", () => {
    const report = buildPeriodReport({
      kind: "weekly",
      label: "गएको ७ दिन",
      posInvoices: [
        pos({ createdAt: "2026-07-20T04:00:00.000Z", total: 10_000 }),
        pos({ createdAt: "2026-07-21T04:00:00.000Z", total: 9_999, status: "Voided" }),
      ],
      purchaseInvoices: [],
      current: { startKey: "2026-07-19", endKey: "2026-07-26" },
      previous: { startKey: "2026-07-12", endKey: "2026-07-19" },
    });

    expect(report.netSales).toBe(10_000);
    expect(report.billCount).toBe(1);
  });

  it("counts only invoices inside the current range", () => {
    const report = buildPeriodReport({
      kind: "weekly",
      label: "गएको ७ दिन",
      posInvoices: [
        pos({ createdAt: "2026-07-18T04:00:00.000Z", total: 5_000 }), // before range
        pos({ createdAt: "2026-07-20T04:00:00.000Z", total: 7_000 }), // inside
        pos({ createdAt: "2026-07-26T04:00:00.000Z", total: 6_000 }), // on exclusive end
      ],
      purchaseInvoices: [],
      current: { startKey: "2026-07-19", endKey: "2026-07-26" },
      previous: { startKey: "2026-07-12", endKey: "2026-07-19" },
    });

    expect(report.netSales).toBe(7_000);
  });

  it("finds the top design by net pairs and the best day", () => {
    const report = buildPeriodReport({
      kind: "weekly",
      label: "गएको ७ दिन",
      posInvoices: [
        pos({
          createdAt: "2026-07-20T04:00:00.000Z",
          total: 8_000,
          items: [
            { design: "Sagarmatha", quantity: 5 },
            { design: "Annapurna", quantity: 2 },
          ],
        }),
        pos({
          createdAt: "2026-07-22T04:00:00.000Z",
          total: 12_000,
          items: [{ design: "Annapurna", quantity: 4 }],
        }),
      ],
      purchaseInvoices: [],
      current: { startKey: "2026-07-19", endKey: "2026-07-26" },
      previous: { startKey: "2026-07-12", endKey: "2026-07-19" },
    });

    expect(report.topDesign).toEqual({ design: "Annapurna", pairs: 6 });
    expect(report.bestDay?.dateKey).toBe("2026-07-22");
    expect(report.bestDay?.netSales).toBe(12_000);
    expect(report.pairsSold).toBe(11);
  });

  it("computes the change against the previous stretch", () => {
    const report = buildPeriodReport({
      kind: "weekly",
      label: "गएको ७ दिन",
      posInvoices: [
        pos({ createdAt: "2026-07-20T04:00:00.000Z", total: 12_000 }), // current
        pos({ createdAt: "2026-07-14T04:00:00.000Z", total: 10_000 }), // previous
      ],
      purchaseInvoices: [],
      current: { startKey: "2026-07-19", endKey: "2026-07-26" },
      previous: { startKey: "2026-07-12", endKey: "2026-07-19" },
    });

    expect(report.previousNetSales).toBe(10_000);
    expect(report.changePercent).toBe(20);
  });

  it("reports no change percent when the previous stretch sold nothing", () => {
    const report = buildPeriodReport({
      kind: "weekly",
      label: "गएको ७ दिन",
      posInvoices: [pos({ createdAt: "2026-07-20T04:00:00.000Z", total: 12_000 })],
      purchaseInvoices: [],
      current: { startKey: "2026-07-19", endKey: "2026-07-26" },
      previous: { startKey: "2026-07-12", endKey: "2026-07-19" },
    });

    expect(report.changePercent).toBeNull();
    // No line items were recorded, so there is no top design — but the bill's
    // total still makes its day the best one.
    expect(report.topDesign).toBeNull();
    expect(report.bestDay?.dateKey).toBe("2026-07-20");
  });

  it("labels the stretch with both English and Bikram Sambat dates", () => {
    const report = buildPeriodReport({
      kind: "weekly",
      label: "गएको ७ दिन",
      posInvoices: [],
      purchaseInvoices: [],
      current: { startKey: "2026-07-19", endKey: "2026-07-26" },
      previous: { startKey: "2026-07-12", endKey: "2026-07-19" },
    });

    // The inclusive last day is the 25th, not the exclusive end (26th).
    expect(report.rangeLabel).toContain("19 Jul 2026 – 25 Jul 2026");
    expect(report.rangeLabel).toContain("B.S");
  });
});

describe("the digest date ranges", () => {
  it("weekly reaches back seven days, with the seven before to compare", () => {
    const { current, previous } = weeklyRanges(new Date("2026-07-26T02:00:00.000Z"));
    expect(current).toEqual({ startKey: "2026-07-19", endKey: "2026-07-26" });
    expect(previous).toEqual({ startKey: "2026-07-12", endKey: "2026-07-19" });
  });

  // A Nepali shop closes its books on the Bikram Sambat month, whose boundaries
  // fall mid-English-month. Run on gate 1 of Shrawan 2083 (2026-07-17), "last
  // month" is Asar (2026-06-15 – 2026-07-17) and the one before is Jestha.
  it("monthly covers the previous Bikram Sambat month, not the English one", () => {
    const { current, previous } = monthlyRanges(new Date("2026-07-17T06:00:00.000Z"));
    expect(current).toEqual({ startKey: "2026-06-15", endKey: "2026-07-17" });
    expect(previous).toEqual({ startKey: "2026-05-15", endKey: "2026-06-15" });
  });

  // Run on gate 1 of Baisakh 2083 (2026-04-14), the previous BS month is Chaitra
  // of 2082 — the digest must carry the month index back into the prior BS year.
  it("monthly carries Baisakh back into the previous Bikram Sambat year", () => {
    const { current, previous } = monthlyRanges(new Date("2026-04-14T06:00:00.000Z"));
    expect(current).toEqual({ startKey: "2026-03-15", endKey: "2026-04-14" });
    expect(previous).toEqual({ startKey: "2026-02-13", endKey: "2026-03-15" });
  });
});
