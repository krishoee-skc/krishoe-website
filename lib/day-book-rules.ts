import { moneyByMethod, readPaymentParts } from "@/lib/pos-payments";

/**
 * The Day Book: every rupee of one Nepal day, in one list (owner, 2026-10-28,
 * the Tally-style "Transactions" namuna).
 *
 * The books already hold every line — a bill, a purchase, a payment on an
 * account, a wage — but in five tables, and some of one event is written in
 * two of them. A counter bill on credit writes the bill and a "Credit sale"
 * line on the customer's account; a purchase paid in cash writes the bill and
 * a "Cash payment" line on the supplier's account. Read naively the same
 * rupee is counted twice. These rules are the one place that says which line
 * speaks for the event:
 *
 *   - a counter bill speaks for itself and for the account lines it wrote
 *     (its credit sale, its return to an account, an old credit cleared on it);
 *   - a purchase bill speaks for the supplier lines it wrote;
 *   - everything else on an account was entered by hand, and is its own line.
 *
 * Money is what changed hands. Credit given or taken, goods returned to an
 * account, and adjustments show on the list but add nothing to "in" or "out".
 * A cheque that bounced shows, crossed, and is not counted. A cancelled test
 * bill does not show at all.
 */

export type DayBookArea = "pos" | "purchase" | "customer" | "supplier" | "wages";
export type DayBookFilter = "sale" | "purchase" | "in" | "out" | "cheque";

export type DayBookRow = {
  id: string;
  at: string;
  area: DayBookArea;
  /** What happened, in the book's words. */
  en: string;
  ne: string;
  ref: string;
  party: string;
  href: string;
  /** How the money moved — "Cash", "QR + Cash", or "" when none did. */
  method: string;
  moneyIn: number;
  moneyOut: number;
  /** Cash alone, for the day's cash figure. */
  cashIn: number;
  cashOut: number;
  /** Credit given or owed on this line — shown, never counted as money. */
  due: number;
  bounced: boolean;
  filters: DayBookFilter[];
};

export type PosBillRow = {
  id: string;
  invoice_number: string;
  created_at: string;
  kind: string;
  status: string;
  customer_name: string;
  payment_method: string;
  total: number | string;
  paid_amount: number | string;
  credit_amount: number | string;
  payments: unknown;
  ledger_transaction_id: string | null;
};

export type PurchaseBillRow = {
  id: string;
  purchase_number: string;
  created_at: string;
  supplier_name: string;
  total: number | string;
  paid_amount: number | string;
  credit_amount: number | string;
  payment_method: string;
  supplier_transaction_ids: string[] | null;
};

export type AccountLineRow = {
  id: string;
  created_at: string;
  account_id: string;
  name: string;
  type: string;
  amount: number | string;
  note: string | null;
};

export type WagePaymentRow = {
  id: string;
  created_at: string;
  employee_id: string;
  employee_name_snapshot: string;
  payment_type: string;
  direction: string;
  amount: number | string;
  payment_method: string | null;
};

export type ChequeStateRow = { source: string; source_id: string; state: string };

export type DayBookSources = {
  bills: PosBillRow[];
  purchases: PurchaseBillRow[];
  customerLines: AccountLineRow[];
  supplierLines: AccountLineRow[];
  wages: WagePaymentRow[];
  cheques: ChequeStateRow[];
  /**
   * Account lines a bill or purchase of ANY day wrote — a line can be read on
   * a day its bill is not (a bill at 23:59, its line a moment past midnight).
   */
  billLedgerLineIds: string[];
  purchaseSupplierLineIds: string[];
};

export type DayBookTotals = {
  moneyIn: number;
  moneyOut: number;
  cashIn: number;
  cashOut: number;
  /** Cash in less cash out today. Not the drawer: the books do not keep the morning's float. */
  cashNet: number;
  due: number;
};

const n = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Lines a counter bill wrote onto an account, read by their own note. */
const BILL_WROTE_IT = /\b(old credit paid at the counter|through POS\.)/i;

const CUSTOMER_LINE: Record<string, { en: string; ne: string; money: boolean }> = {
  "Cash Payment": { en: "Cash taken", ne: "नगद लिएको", money: true },
  "Cheque Payment": { en: "Cheque taken", ne: "चेक लिएको", money: true },
  "Credit Sale": { en: "Credit sale", ne: "उधारो बिक्री", money: false },
  "Return Adjustment": { en: "Goods returned", ne: "सामान फिर्ता", money: false },
  "Manual Adjustment": { en: "Adjustment", ne: "हिसाब मिलान", money: false },
};

const SUPPLIER_LINE: Record<string, { en: string; ne: string; money: boolean; method: string }> = {
  "Cash Payment": { en: "Cash payment", ne: "नगद तिरेको", money: true, method: "Cash" },
  "Cheque Payment": { en: "Cheque payment", ne: "चेकबाट तिरेको", money: true, method: "Cheque" },
  "Bank Payment": { en: "Bank payment", ne: "बैंकबाट तिरेको", money: true, method: "Bank" },
  "QR Payment": { en: "QR payment", ne: "QR बाट तिरेको", money: true, method: "QR" },
  "Return Adjustment": { en: "Goods returned", ne: "सामान फिर्ता", money: false, method: "" },
  "Manual Adjustment": { en: "Adjustment", ne: "हिसाब मिलान", money: false, method: "" },
};

const WAGE_LINE: Record<string, { en: string; ne: string }> = {
  "Saturday Kharcha": { en: "Saturday kharcha", ne: "शनिबारको खर्च" },
  "Midweek Advance": { en: "Advance", ne: "पेस्की" },
  "Final Settlement": { en: "Wages settled", ne: "ज्याला फछ्र्यौट" },
  Bonus: { en: "Bonus", ne: "बोनस" },
};

function row(partial: Omit<DayBookRow, "cashIn" | "cashOut" | "bounced" | "filters" | "due"> & Partial<DayBookRow>): DayBookRow {
  const r: DayBookRow = { cashIn: 0, cashOut: 0, due: 0, bounced: false, filters: [], ...partial };
  const filters = new Set<DayBookFilter>(r.filters);
  if (r.moneyIn > 0) filters.add("in");
  if (r.moneyOut > 0) filters.add("out");
  if (/Cheque/.test(r.method)) filters.add("cheque");
  r.filters = [...filters];
  return r;
}

function posBill(bill: PosBillRow, bounced: boolean): DayBookRow | null {
  if (bill.status === "Voided") return null;
  const isReturn = bill.kind === "Return";
  const byMethod = moneyByMethod({
    kind: isReturn ? "Return" : "Sale",
    paymentMethod: bill.payment_method,
    paidAmount: n(bill.paid_amount),
    payments: readPaymentParts(bill.payments),
  });
  let moneyIn = 0;
  let moneyOut = 0;
  let cashIn = 0;
  let cashOut = 0;
  const methods: string[] = [];
  for (const [method, amount] of byMethod) {
    // An exchange is the returned pair's value set against the new one — no
    // money moves, and the day close counts it apart.
    if (method === "Exchange" || amount === 0) continue;
    methods.push(method);
    // A bounced cheque never came in; the bill's other parts did.
    if (bounced && method === "Cheque") continue;
    if (amount > 0) moneyIn += amount;
    else moneyOut += -amount;
    if (method === "Cash") {
      if (amount > 0) cashIn += amount;
      else cashOut += -amount;
    }
  }
  const credit = isReturn ? 0 : n(bill.credit_amount);
  if (credit > 0) methods.push("Credit");
  return row({
    id: `pos:${bill.id}`,
    at: bill.created_at,
    area: "pos",
    en: isReturn ? "Return bill" : "Sale",
    ne: isReturn ? "फिर्ता बिल" : "बिक्री",
    ref: bill.invoice_number,
    party: bill.customer_name || "",
    href: `/admin/pos/${bill.id}`,
    method: methods.join(" + "),
    moneyIn,
    moneyOut,
    cashIn,
    cashOut,
    due: credit,
    bounced,
    filters: isReturn ? [] : ["sale"],
  });
}

function purchaseBill(bill: PurchaseBillRow, bounced: boolean): DayBookRow {
  const paid = n(bill.paid_amount);
  const credit = n(bill.credit_amount);
  const method = paid > 0 ? bill.payment_method : "";
  return row({
    id: `purchase:${bill.id}`,
    at: bill.created_at,
    area: "purchase",
    en: "Purchase bill",
    ne: "खरिद बिल",
    ref: bill.purchase_number,
    party: bill.supplier_name,
    href: `/admin/purchasing/${bill.id}`,
    method: [method, credit > 0 ? "Credit" : ""].filter(Boolean).join(" + "),
    moneyIn: 0,
    // Only a cheque can bounce; a bill paid in cash with a cheque-book row is not this.
    moneyOut: bounced && method === "Cheque" ? 0 : paid,
    cashOut: method === "Cash" ? paid : 0,
    due: credit,
    bounced,
    filters: ["purchase"],
  });
}

export function buildDayBook(sources: DayBookSources): DayBookRow[] {
  const bounced = new Set(
    sources.cheques.filter((cheque) => cheque.state === "bounced").map((cheque) => `${cheque.source}:${cheque.source_id}`),
  );
  const billLines = new Set(sources.billLedgerLineIds.filter(Boolean));
  const purchaseLines = new Set(sources.purchaseSupplierLineIds.filter(Boolean));
  const rows: DayBookRow[] = [];

  for (const bill of sources.bills) {
    const built = posBill(bill, bounced.has(`bill:${bill.id}`));
    if (built) rows.push(built);
  }

  for (const bill of sources.purchases) {
    rows.push(purchaseBill(bill, bounced.has(`purchase:${bill.id}`)));
  }

  for (const line of sources.customerLines) {
    if (billLines.has(line.id) || BILL_WROTE_IT.test(line.note ?? "")) continue;
    const words = CUSTOMER_LINE[line.type];
    if (!words) continue;
    const amount = n(line.amount);
    const method = words.money ? (line.type === "Cash Payment" ? "Cash" : "Cheque") : "";
    rows.push(
      row({
        id: `customer:${line.id}`,
        at: line.created_at,
        area: "customer",
        en: words.en,
        ne: words.ne,
        ref: (line.note ?? "").slice(0, 60),
        party: line.name,
        href: `/admin/operations/ledger/${line.account_id}`,
        method,
        moneyIn: words.money ? amount : 0,
        moneyOut: 0,
        cashIn: method === "Cash" ? amount : 0,
        due: line.type === "Credit Sale" || line.type === "Manual Adjustment" ? amount : 0,
      }),
    );
  }

  for (const line of sources.supplierLines) {
    if (purchaseLines.has(line.id)) continue;
    const words = SUPPLIER_LINE[line.type];
    if (!words) continue;
    const amount = n(line.amount);
    rows.push(
      row({
        id: `supplier:${line.id}`,
        at: line.created_at,
        area: "supplier",
        en: words.en,
        ne: words.ne,
        ref: (line.note ?? "").slice(0, 60),
        party: line.name,
        href: `/admin/purchasing/supplier/${line.account_id}`,
        method: words.method,
        moneyIn: 0,
        moneyOut: words.money ? amount : 0,
        cashOut: words.method === "Cash" ? amount : 0,
        due: line.type === "Manual Adjustment" ? amount : 0,
      }),
    );
  }

  for (const wage of sources.wages) {
    // Only money handed over. "Added" and "Recovered" move a worker's balance,
    // not the cash box.
    if (wage.direction !== "Paid") continue;
    const words = WAGE_LINE[wage.payment_type] ?? { en: wage.payment_type, ne: wage.payment_type };
    const amount = n(wage.amount);
    const method = wage.payment_method || "Cash";
    rows.push(
      row({
        id: `wages:${wage.id}`,
        at: wage.created_at,
        area: "wages",
        en: words.en,
        ne: words.ne,
        ref: "",
        party: wage.employee_name_snapshot,
        href: `/admin/operations/production-accounts/worker/${wage.employee_id}`,
        method,
        moneyIn: 0,
        moneyOut: amount,
        cashOut: method === "Cash" ? amount : 0,
      }),
    );
  }

  return rows.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || a.id.localeCompare(b.id));
}

export function dayBookTotals(rows: DayBookRow[]): DayBookTotals {
  const totals = rows.reduce(
    (sum, r) => ({
      moneyIn: sum.moneyIn + r.moneyIn,
      moneyOut: sum.moneyOut + r.moneyOut,
      cashIn: sum.cashIn + r.cashIn,
      cashOut: sum.cashOut + r.cashOut,
      due: sum.due + r.due,
    }),
    { moneyIn: 0, moneyOut: 0, cashIn: 0, cashOut: 0, due: 0 },
  );
  return { ...totals, cashNet: totals.cashIn - totals.cashOut };
}

/** The day before or after a YYYY-MM-DD, by the calendar alone. */
export function shiftDay(day: string, by: number) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + by));
  return date.toISOString().slice(0, 10);
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
