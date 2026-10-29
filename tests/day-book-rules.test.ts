import { describe, expect, it } from "vitest";
import { buildDayBook, dayBookTotals, isDayKey, shiftDay, type DayBookSources } from "@/lib/day-book-rules";
import { voucherForKey } from "@/app/admin/transactions/voucher-keys";

const AT = "2026-10-28T05:00:00.000Z";

function sources(partial: Partial<DayBookSources>): DayBookSources {
  return {
    bills: [],
    purchases: [],
    customerLines: [],
    supplierLines: [],
    wages: [],
    cheques: [],
    billLedgerLineIds: [],
    purchaseSupplierLineIds: [],
    ...partial,
  };
}

const bill = (over: Partial<DayBookSources["bills"][number]>) => ({
  id: "b1",
  invoice_number: "KRB001",
  created_at: AT,
  kind: "Sale",
  status: "Paid",
  customer_name: "",
  payment_method: "Cash",
  total: 1500,
  paid_amount: 1500,
  credit_amount: 0,
  payments: [],
  ledger_transaction_id: null,
  ...over,
});

describe("day book", () => {
  it("counts a cash sale once, as cash in", () => {
    const rows = buildDayBook(sources({ bills: [bill({})] }));
    expect(rows).toHaveLength(1);
    expect(dayBookTotals(rows)).toMatchObject({ moneyIn: 1500, cashIn: 1500, cashNet: 1500, moneyOut: 0 });
  });

  it("shows a credit sale's due but counts no money, and drops the account line the bill wrote", () => {
    const rows = buildDayBook(
      sources({
        bills: [bill({ status: "Credit", payment_method: "Credit", paid_amount: 0, credit_amount: 800, ledger_transaction_id: "T1" })],
        customerLines: [
          { id: "T1", created_at: AT, account_id: "L1", name: "Hari", type: "Credit Sale", amount: 800, note: "KRB001 sale through POS." },
        ],
        billLedgerLineIds: ["T1"],
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ due: 800, moneyIn: 0, method: "Credit" });
    expect(dayBookTotals(rows).moneyIn).toBe(0);
  });

  it("counts an old credit cleared at the counter on the bill, not again from the account", () => {
    const rows = buildDayBook(
      sources({
        bills: [bill({ payments: [{ method: "Cash", amount: 1500, purpose: "bill" }, { method: "Cash", amount: 500, purpose: "due" }] })],
        customerLines: [
          { id: "T2", created_at: AT, account_id: "L1", name: "Hari", type: "Cash Payment", amount: 500, note: "KRB001 old credit paid at the counter (Cash)." },
        ],
      }),
    );
    expect(rows).toHaveLength(1);
    expect(dayBookTotals(rows)).toMatchObject({ moneyIn: 2000, cashIn: 2000 });
  });

  it("counts a cash return handed back as money out, and an exchange as no money", () => {
    const rows = buildDayBook(
      sources({
        bills: [
          bill({ id: "r1", invoice_number: "KRR001", kind: "Return", status: "Returned", paid_amount: 0, payments: [{ method: "Cash", amount: 700, purpose: "refund" }] }),
          bill({ id: "r2", invoice_number: "KRR002", kind: "Return", status: "Returned", paid_amount: 0, payments: [{ method: "Exchange", amount: 900, purpose: "refund" }] }),
        ],
      }),
    );
    expect(dayBookTotals(rows)).toMatchObject({ moneyIn: 0, moneyOut: 700, cashOut: 700, cashNet: -700 });
    expect(rows.find((r) => r.ref === "KRR002")).toMatchObject({ moneyIn: 0, moneyOut: 0, method: "" });
  });

  it("leaves out a cancelled test bill", () => {
    expect(buildDayBook(sources({ bills: [bill({ status: "Voided" })] }))).toHaveLength(0);
  });

  it("does not count a bounced cheque, but keeps the bill's cash part", () => {
    const rows = buildDayBook(
      sources({
        bills: [bill({ payments: [{ method: "Cash", amount: 500, purpose: "bill" }, { method: "Cheque", amount: 1000, purpose: "bill" }] })],
        cheques: [{ source: "bill", source_id: "b1", state: "bounced" }],
      }),
    );
    expect(rows[0]).toMatchObject({ bounced: true, moneyIn: 500 });
    expect(rows[0].filters).toContain("cheque");
  });

  it("counts a purchase once: the bill speaks for the supplier lines it wrote", () => {
    const rows = buildDayBook(
      sources({
        purchases: [
          { id: "p1", purchase_number: "KR-PUR-1", created_at: AT, supplier_name: "Sita", total: 900, paid_amount: 400, credit_amount: 500, payment_method: "Cash", supplier_transaction_ids: ["S1", "S2"] },
        ],
        supplierLines: [
          { id: "S1", created_at: AT, account_id: "SL1", name: "Sita", type: "Purchase Bill", amount: 900, note: "" },
          { id: "S2", created_at: AT, account_id: "SL1", name: "Sita", type: "Cash Payment", amount: 400, note: "KR-PUR-1 payment" },
          { id: "S3", created_at: AT, account_id: "SL1", name: "Sita", type: "Bank Payment", amount: 300, note: "by hand" },
        ],
        purchaseSupplierLineIds: ["S1", "S2"],
      }),
    );
    expect(rows).toHaveLength(2);
    expect(dayBookTotals(rows)).toMatchObject({ moneyOut: 700, cashOut: 400, due: 500 });
  });

  it("counts wages handed over, not wages earned or recovered", () => {
    const rows = buildDayBook(
      sources({
        wages: [
          { id: "w1", created_at: AT, employee_id: "E1", employee_name_snapshot: "Ram", payment_type: "Saturday Kharcha", direction: "Paid", amount: 2000, payment_method: "Cash" },
          { id: "w2", created_at: AT, employee_id: "E1", employee_name_snapshot: "Ram", payment_type: "Bonus", direction: "Added", amount: 500, payment_method: null },
          { id: "w3", created_at: AT, employee_id: "E1", employee_name_snapshot: "Ram", payment_type: "Deduction", direction: "Recovered", amount: 100, payment_method: null },
        ],
      }),
    );
    expect(rows).toHaveLength(1);
    expect(dayBookTotals(rows)).toMatchObject({ moneyOut: 2000, cashOut: 2000 });
  });

  it("counts a cheque taken by hand on an account as money in, not cash", () => {
    const rows = buildDayBook(
      sources({
        customerLines: [{ id: "T9", created_at: AT, account_id: "L1", name: "Ram Traders", type: "Cheque Payment", amount: 15000, note: "NIC 00421" }],
      }),
    );
    expect(dayBookTotals(rows)).toMatchObject({ moneyIn: 15000, cashIn: 0 });
    expect(rows[0].filters).toEqual(expect.arrayContaining(["in", "cheque"]));
  });
});

describe("days", () => {
  it("steps across a month end", () => {
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("takes only a real day", () => {
    expect(isDayKey("2026-10-28")).toBe(true);
    expect(isDayKey("2026-1-28")).toBe(false);
    expect(isDayKey("x")).toBe(false);
  });
});

describe("Alt + 1–4", () => {
  const key = (code: string, extra: Partial<KeyboardEvent> = {}) =>
    voucherForKey({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code, key: code.slice(-1), ...extra } as KeyboardEvent);
  it("opens the four doors", () => {
    expect([key("Digit1"), key("Digit2"), key("Digit3"), key("Digit4")]).toEqual(["sale", "buy", "in", "out"]);
  });
  it("leaves Alt with the number pad to type its characters", () => {
    expect(key("Numpad1")).toBeNull();
  });
  it("leaves AltGr, other digits and plain digits alone", () => {
    expect(key("Digit1", { ctrlKey: true })).toBeNull();
    expect(key("Digit5")).toBeNull();
    expect(key("Digit1", { altKey: false })).toBeNull();
  });
});
