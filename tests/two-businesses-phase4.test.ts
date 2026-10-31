import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildDayBook,
  cashInByBusiness,
  dayBookTotals,
  fifoFactoryShares,
  linesOfBusiness,
  purchaseFactoryShare,
  type DayBookSources,
} from "@/lib/day-book-rules";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/**
 * The factory and the shop as two businesses, part four (owner, 2026-10-31,
 * "1 ko ka 2 ko ka 3 ko pani ka"): the Day Book and the Report each say whose.
 * Purchases by their lines (raw material the factory's), a customer's payment
 * by the bills it paid oldest first, one drawer shown in two parts.
 */
const empty: DayBookSources = {
  bills: [],
  purchases: [],
  customerLines: [],
  supplierLines: [],
  wages: [],
  cheques: [],
  billLedgerLineIds: [],
  purchaseSupplierLineIds: [],
};

describe("two businesses: whose each line is", () => {
  it("gives a purchase to the factory by its raw material, to the shop by its trading goods", () => {
    expect(purchaseFactoryShare(8000, 0)).toBe(1);
    expect(purchaseFactoryShare(0, 3000)).toBe(0);
    expect(purchaseFactoryShare(3000, 1000)).toBe(0.75);
    expect(purchaseFactoryShare(0, 0)).toBe(1);
  });

  it("pays the oldest credit first, each rupee to the business whose bill it paid", () => {
    const shares = fifoFactoryShares(
      [
        { at: "2026-10-01T10:00:00Z", factory: true, amount: 1000 },
        { at: "2026-10-05T10:00:00Z", factory: false, amount: 500 },
      ],
      [
        { id: "p1", at: "2026-10-10T10:00:00Z", amount: 600 },
        { id: "p2", at: "2026-10-12T10:00:00Z", amount: 800 },
        { id: "p3", at: "2026-10-14T10:00:00Z", amount: 300 },
      ],
    );
    expect(shares.p1).toBe(1);
    expect(shares.p2).toBe(0.5);
    // The shop's last 100, then beyond every bill the books know: the shop's too.
    expect(shares.p3).toBe(0);
  });

  it("splits the day by business, counts a transfer on neither, and keeps one drawer", () => {
    const rows = buildDayBook({
      ...empty,
      bills: [
        { id: "b1", invoice_number: "KRF001", created_at: "2026-10-31T04:00:00Z", kind: "Sale", status: "Paid", customer_name: "", payment_method: "Cash", total: 4500, paid_amount: 4500, credit_amount: 0, payments: [], ledger_transaction_id: null, business: "factory" },
        { id: "b2", invoice_number: "KRB215", created_at: "2026-10-31T05:00:00Z", kind: "Sale", status: "Paid", customer_name: "", payment_method: "Cash", total: 650, paid_amount: 650, credit_amount: 0, payments: [], ledger_transaction_id: null, business: "shop" },
      ],
      purchases: [
        { id: "u1", purchase_number: "P1", created_at: "2026-10-31T06:00:00Z", supplier_name: "Sita", total: 4000, paid_amount: 4000, credit_amount: 0, payment_method: "Cash", supplier_transaction_ids: [], raw_value: 3000, trading_value: 1000 },
      ],
      wages: [
        { id: "w1", created_at: "2026-10-31T07:00:00Z", employee_id: "e1", employee_name_snapshot: "Hari", payment_type: "Saturday Kharcha", direction: "Paid", amount: 3200, payment_method: "Cash" },
      ],
      shopPayments: [{ id: "s1", created_at: "2026-10-31T08:00:00Z", amount: 2000, method: "Cash", note: "" }],
    });
    const transfer = rows.find((r) => r.area === "transfer")!;
    expect(transfer.moved).toBe(2000);
    expect(transfer.moneyIn + transfer.moneyOut + transfer.cashIn + transfer.cashOut).toBe(0);

    const factory = dayBookTotals(linesOfBusiness(rows, "factory"));
    const shop = dayBookTotals(linesOfBusiness(rows, "shop"));
    expect(factory.moneyIn).toBe(4500);
    expect(factory.moneyOut).toBe(3000 + 3200);
    expect(shop.moneyIn).toBe(650);
    expect(shop.moneyOut).toBe(1000);
    // The two add up to the whole.
    const whole = dayBookTotals(rows);
    expect(factory.moneyIn + shop.moneyIn).toBe(whole.moneyIn);
    expect(factory.moneyOut + shop.moneyOut).toBe(whole.moneyOut);
    expect(cashInByBusiness(rows)).toEqual({ factory: 4500, shop: 650 });
  });

  it("shows the filter, the tags and the drawer's two parts only once the businesses are set up", () => {
    const hub = read("app/admin/transactions/_components/TransactionsHub.tsx");
    expect(hub).toContain('{ key: "factory", en: "🏭 Factory", ne: "🏭 कारखाना" }');
    expect(hub).toContain("{twoBusiness ? <BusinessTag r={r} /> : null}");
    expect(hub).toContain("{twoBusiness && cashIn > 0 ? (");
    expect(read("app/admin/transactions/page.tsx")).toContain("const twoBusiness = await twoBusinessReady().catch(() => false);");
  });

  it("puts each business's profit and the factory's price list on the Report", () => {
    expect(read("app/admin/reports/page.tsx")).toContain("{twoBusinesses ? <TwoBusinessReport report={twoBusinesses} /> : null}");
    const lib = read("lib/two-business-report.ts");
    expect(lib).toContain("side.profit = side.sales + side.toShop - side.cost;");
    expect(lib).toContain("const each = side === factory ? cost(item.design) : made(item.design) ? priceOf(item.design) : cost(item.design);");
  });
});
