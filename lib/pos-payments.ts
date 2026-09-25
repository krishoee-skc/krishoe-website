/**
 * How a counter bill was paid, when one word is not enough.
 *
 * A bill used to carry one payment method and one paid amount. That cannot say
 * "Rs 1,000 in cash and the rest by QR", or "the old pair came back and paid
 * for most of the new one", or "and the customer cleared what they owed from
 * last month". Each of those is a part:
 *
 *   bill    money in, for this bill
 *   due     money in, for the customer's older credit — posted to their account
 *   refund  money handed back, when a returned pair was worth more than the new
 *
 * "Exchange" is a method, not money: the value of a returned pair set against
 * the new one. It never reaches the drawer, and the day close counts it apart.
 *
 * Kept in pos_invoices.payments. A bill saved before that column existed has
 * none, and reads exactly as it always did — its one method, its paid amount.
 */

export type PosPaymentPartMethod = "Cash" | "Cheque" | "QR" | "eSewa" | "Khalti" | "Bank" | "Exchange";
export type PosPaymentPurpose = "bill" | "due" | "refund";

export type PosPaymentPart = {
  method: PosPaymentPartMethod;
  /** Whole rupees, always above zero; `purpose` says which way it went. */
  amount: number;
  purpose: PosPaymentPurpose;
  reference?: string;
  /** The other bill of an exchange, by its number. */
  against?: string;
};

export const PAYMENT_PART_METHODS: PosPaymentPartMethod[] = ["Cash", "Cheque", "QR", "eSewa", "Khalti", "Bank", "Exchange"];
const PURPOSES: PosPaymentPurpose[] = ["bill", "due", "refund"];

/** Methods a transaction number is asked for, the same as a one-method bill. */
export function needsReference(method: PosPaymentPartMethod) {
  return method !== "Cash" && method !== "Exchange";
}

function whole(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

/** Whatever the column holds, as clean parts — anything malformed is dropped. */
export function readPaymentParts(raw: unknown): PosPaymentPart[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): PosPaymentPart[] => {
    if (!entry || typeof entry !== "object") return [];
    const part = entry as Record<string, unknown>;
    const method = PAYMENT_PART_METHODS.find((option) => option === part.method);
    const purpose = PURPOSES.find((option) => option === part.purpose) ?? "bill";
    const amount = whole(part.amount);
    if (!method || amount <= 0) return [];
    const reference = typeof part.reference === "string" ? part.reference.trim().slice(0, 80) : "";
    const against = typeof part.against === "string" ? part.against.trim().slice(0, 80) : "";
    return [
      {
        method,
        amount,
        purpose,
        ...(reference ? { reference } : {}),
        ...(against ? { against } : {}),
      },
    ];
  });
}

/** What the parts put toward this bill itself. */
export function paidTowardBill(parts: PosPaymentPart[]) {
  return parts.filter((part) => part.purpose === "bill").reduce((sum, part) => sum + part.amount, 0);
}

/** What the parts paid toward the customer's older credit. */
export function paidTowardDue(parts: PosPaymentPart[]) {
  return parts.filter((part) => part.purpose === "due").reduce((sum, part) => sum + part.amount, 0);
}

/**
 * Why a set of parts cannot settle a bill, or "" when it can.
 *
 * The bill's parts may not come to more than the bill — change is handed back
 * at the counter, not recorded as income. Every non-cash part carries its
 * transaction number, as a one-method bill must.
 */
export function paymentPartsProblem(parts: PosPaymentPart[], billTotal: number) {
  for (const part of parts) {
    if (needsReference(part.method) && !part.reference) {
      return `${part.method} needs its transaction number.`;
    }
  }
  if (paidTowardBill(parts) > billTotal) {
    return "The payments come to more than the bill.";
  }
  return "";
}

/** The minimum an invoice needs for its money to be read. */
export type PaidInvoice = {
  kind: "Sale" | "Return";
  paymentMethod: string;
  paidAmount: number;
  payments?: PosPaymentPart[];
};

/**
 * Money by method for one bill: in, minus anything handed back.
 *
 * A bill with parts is read part by part — cash in, QR in, a refund out. A bill
 * without them is read the old way: its whole paid amount under its one
 * method, so every day close before this change adds up exactly as it did.
 */
export function moneyByMethod(invoice: PaidInvoice): Map<string, number> {
  const byMethod = new Map<string, number>();
  const add = (method: string, amount: number) => byMethod.set(method, (byMethod.get(method) ?? 0) + amount);

  const parts = invoice.payments ?? [];
  if (parts.length === 0) {
    if (invoice.paidAmount > 0) add(invoice.paymentMethod, invoice.paidAmount);
    return byMethod;
  }
  for (const part of parts) {
    add(part.method, part.purpose === "refund" ? -part.amount : part.amount);
  }
  return byMethod;
}

/** Whether a return was settled against a new pair instead of an account. */
export function settledByExchange(invoice: Pick<PaidInvoice, "payments">) {
  return (invoice.payments ?? []).some((part) => part.method === "Exchange");
}

export type ExchangeSettlement = {
  /** The returned pairs' value set against the new ones. */
  exchanged: number;
  /** Still to pay for the new pairs, after the exchange. */
  toPay: number;
  /** To hand back, when the returned pairs were worth more. */
  toRefund: number;
};

/**
 * What an exchange comes to: the pair that came back pays for the new one as
 * far as it goes. Whatever is left is paid for, or handed back.
 */
export function settleExchange(returnedValue: number, newValue: number): ExchangeSettlement {
  const back = whole(returnedValue);
  const out = whole(newValue);
  const exchanged = Math.min(back, out);
  return { exchanged, toPay: out - exchanged, toRefund: back - exchanged };
}
