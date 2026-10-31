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

// transfer: the shop paying the factory (two businesses, owner 2026-10-31).
export type DayBookArea = "pos" | "purchase" | "customer" | "supplier" | "wages" | "transfer";
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
  /**
   * How much of the line is the factory's (owner, 2026-10-31, two
   * businesses): 1 the factory's, 0 the shop's, between for a purchase of
   * both kinds or a payment on bills of both. A transfer is both sides'.
   */
  factoryShare: number;
  /** Money moved from the shop to the factory — shown, never counted as in or out. */
  moved: number;
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
  /** Whose bill, once the two businesses are set up. */
  business?: string | null;
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
  /** Its lines by kind: raw material is the factory's, trading goods the shop's (choice 1(क)). */
  raw_value?: number | string | null;
  trading_value?: number | string | null;
};

export type ShopPaymentRow = {
  id: string;
  created_at: string;
  amount: number | string;
  method: string;
  note: string | null;
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
  /** The factory's share of each customer payment line, by line id (choice 2(क)). */
  customerShares?: Record<string, number>;
  /** The factory's share of each supplier's buying, by supplier account id. */
  supplierShares?: Record<string, number>;
  /** What the shop paid the factory this day. */
  shopPayments?: ShopPaymentRow[];
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

function row(
  partial: Omit<DayBookRow, "cashIn" | "cashOut" | "bounced" | "filters" | "due" | "factoryShare" | "moved"> & Partial<DayBookRow>,
): DayBookRow {
  const r: DayBookRow = { cashIn: 0, cashOut: 0, due: 0, bounced: false, filters: [], factoryShare: 0, moved: 0, ...partial };
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
    factoryShare: bill.business === "factory" ? 1 : 0,
  });
}

/** A purchase's factory share by its lines' worth: raw material the factory's, trading goods the shop's. */
export function purchaseFactoryShare(raw: number, trading: number) {
  const whole = raw + trading;
  return whole > 0 ? raw / whole : 1;
}

/**
 * Whose money a customer's payment is (owner, 2026-10-31, choice 2(क)): it
 * pays the oldest unpaid credit first, and each rupee belongs to the business
 * whose bill it paid. Credit the books cannot place (an opening balance, a
 * hand adjustment) and anything paid beyond the bills are the shop's.
 * Returns each payment's factory share, 0 to 1.
 */
export function fifoFactoryShares(
  credits: Array<{ at: string; factory: boolean; amount: number }>,
  payments: Array<{ id: string; at: string; amount: number }>,
): Record<string, number> {
  const queue = credits
    .filter((credit) => credit.amount > 0)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((credit) => ({ ...credit }));
  const shares: Record<string, number> = {};
  for (const payment of [...payments].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))) {
    let left = Math.max(0, payment.amount);
    let factory = 0;
    while (left > 0 && queue.length > 0) {
      const head = queue[0];
      const take = Math.min(left, head.amount);
      if (head.factory) factory += take;
      head.amount -= take;
      left -= take;
      if (head.amount <= 0) queue.shift();
    }
    shares[payment.id] = payment.amount > 0 ? factory / payment.amount : 0;
  }
  return shares;
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
    factoryShare: purchaseFactoryShare(n(bill.raw_value), n(bill.trading_value)),
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
    // A cheque taken on the account sits in the cheque book under this line.
    const lineBounced = method === "Cheque" && bounced.has(`manual:${line.id}`);
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
        moneyIn: words.money && !lineBounced ? amount : 0,
        moneyOut: 0,
        cashIn: method === "Cash" ? amount : 0,
        due: line.type === "Credit Sale" || line.type === "Manual Adjustment" ? amount : 0,
        bounced: lineBounced,
        factoryShare: sources.customerShares?.[line.id] ?? 0,
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
        factoryShare: sources.supplierShares?.[line.account_id] ?? 1,
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
        // Wages are the factory's, always.
        factoryShare: 1,
      }),
    );
  }

  // The shop paying the factory: money moved between the two, from one drawer
  // (choice 3(क)) — neither in nor out for the business as a whole.
  for (const payment of sources.shopPayments ?? []) {
    rows.push(
      row({
        id: `transfer:${payment.id}`,
        at: payment.created_at,
        area: "transfer",
        en: "Shop paid the factory",
        ne: "पसलले कारखानालाई तिरेको",
        ref: (payment.note ?? "").slice(0, 60),
        party: "",
        href: "/admin/stock#shop-factory-account",
        method: payment.method,
        moneyIn: 0,
        moneyOut: 0,
        moved: n(payment.amount),
        factoryShare: 0.5,
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

export type DayBookBusiness = "factory" | "shop";

/** Whether a line belongs, in whole or part, to one business; a transfer belongs to both. */
export function inBusiness(r: DayBookRow, business: DayBookBusiness) {
  if (r.area === "transfer") return true;
  return business === "factory" ? r.factoryShare > 0 : r.factoryShare < 1;
}

/**
 * One business's lines, each at its share of the money (a purchase of both
 * kinds, a payment on bills of both). A transfer stays whole: it is shown on
 * both sides and counted on neither.
 */
export function linesOfBusiness(rows: DayBookRow[], business: DayBookBusiness): DayBookRow[] {
  return rows
    .filter((r) => inBusiness(r, business))
    .map((r) => {
      if (r.area === "transfer") return r;
      const share = business === "factory" ? r.factoryShare : 1 - r.factoryShare;
      if (share === 1) return r;
      const part = (value: number) => Math.round(value * share);
      return { ...r, moneyIn: part(r.moneyIn), moneyOut: part(r.moneyOut), cashIn: part(r.cashIn), cashOut: part(r.cashOut), due: part(r.due) };
    });
}

/** The day's cash in, by business, for the one drawer (choice 3(क)). */
export function cashInByBusiness(rows: DayBookRow[]) {
  return {
    factory: dayBookTotals(linesOfBusiness(rows, "factory")).cashIn,
    shop: dayBookTotals(linesOfBusiness(rows, "shop")).cashIn,
  };
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
