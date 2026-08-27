// What a supplier transaction means, and how a bill's payment is named.
// Nothing here reads a file or a database, so both backends can share it.
//
// These rules existed twice, once in lib/purchasing.ts for local-json and again
// in lib/purchasing-postgres.ts for Postgres. The copies were identical, which
// is exactly the problem: the tests reach the local-json copy and production
// runs the Postgres one, so a fix to one looks tested and ships untested. Adding
// QR proved it — six separate places had to be edited by hand, and TypeScript
// could not see a single one of them, because they are all string comparisons.
//
// Same shape as lib/stock-rules.ts, and for the same reason. Neither purchasing
// module can import the other, so the rules live here on their own and both
// sides call in.

// The union types live here, not in lib/purchasing.ts, so the dependency only
// ever points this way: purchasing imports rules. The other direction would put
// this module back inside the cycle it exists to avoid.
//
// QR sits beside cash because that is where it sits at the counter: money that
// arrived now, through eSewa, Khalti or Fonepay, against a bill being written.
export type SupplierPaymentMethod = "Cash" | "Cheque" | "Bank" | "Credit" | "QR";

export type SupplierTransactionType =
  | "Purchase Bill"
  | "Cash Payment"
  | "Cheque Payment"
  | "Bank Payment"
  | "QR Payment"
  | "Return Adjustment"
  | "Manual Adjustment";

export type PurchaseInvoiceStatus = "Paid" | "Partial" | "Credit";

/**
 * Every way a bill can be paid, and every transaction type, as lists.
 *
 * Exported so a form's allow-list, a dropdown and a test can all be built FROM
 * the rule rather than beside it. A list written out a second time is the same
 * bug in a different costume.
 */
export const supplierPaymentMethods: SupplierPaymentMethod[] = [
  "Cash",
  "Cheque",
  "Bank",
  "Credit",
  "QR",
];

export const supplierTransactionTypes: SupplierTransactionType[] = [
  "Purchase Bill",
  "Cash Payment",
  "Cheque Payment",
  "Bank Payment",
  "QR Payment",
  "Return Adjustment",
  "Manual Adjustment",
];

/** Only what the rules need. Stored ledgers carry more; callers keep the rest. */
export type SupplierBalances = {
  supplierName: string;
  totalPurchase: number;
  paidAmount: number;
  balanceDue: number;
  lastTransaction: string;
};

export type SupplierTransactionEffect = {
  type: SupplierTransactionType;
  amount: number;
};

/**
 * Money going OUT to the supplier, as opposed to a bill or an adjustment.
 *
 * Derived from the type's name rather than listed, so a payment method added
 * later cannot be forgotten here: "QR Payment" satisfies this the moment it
 * exists, without anyone remembering to come back.
 */
export function isSupplierPaymentType(type: SupplierTransactionType) {
  return type.endsWith(" Payment");
}

/**
 * Which ledger line a bill's payment becomes.
 *
 * Credit is deliberately absent from the mapping: a credit bill hands nothing
 * over, so it writes no payment line at all, and the caller checks the paid
 * amount before asking.
 */
export function paymentTransactionType(
  paymentMethod: SupplierPaymentMethod,
): SupplierTransactionType {
  if (paymentMethod === "Cheque") return "Cheque Payment";
  if (paymentMethod === "Bank") return "Bank Payment";
  if (paymentMethod === "QR") return "QR Payment";
  return "Cash Payment";
}

/**
 * Which payments need a reference before they can be believed.
 *
 * A cheque is traceable only by its number and a transfer by its reference; a
 * QR payment by which wallet it came through. Cash needs none of it — it was
 * counted.
 */
export function paymentNeedsReference(paymentMethod: SupplierPaymentMethod) {
  return paymentMethod === "Cheque" || paymentMethod === "Bank" || paymentMethod === "QR";
}

/** What to say when a reference is missing, in the terms of the method used. */
export function missingReferenceMessage(paymentMethod: SupplierPaymentMethod) {
  return paymentMethod === "QR"
    ? "Say which wallet the QR payment came through — eSewa, Khalti, Fonepay."
    : "Cheque or bank payment reference is required when paid amount is entered.";
}

/** What a bill is, once you know its total and what was handed over. */
export function purchaseStatus(total: number, paidAmount: number): PurchaseInvoiceStatus {
  const creditAmount = Math.max(0, total - paidAmount);

  if (creditAmount > 0 && paidAmount > 0) return "Partial";
  if (creditAmount > 0) return "Credit";
  return "Paid";
}

/** Refuse a transaction that cannot be true before any of it is written. */
export function assertSupplierTransactionAllowed(
  ledger: SupplierBalances,
  transaction: SupplierTransactionEffect,
) {
  if (transaction.amount <= 0) {
    throw new Error("Supplier transaction amount must be greater than zero.");
  }

  // Paying more than is owed, or returning more than was bought, leaves the
  // supplier owing the shop money through a door meant for the other direction.
  if (
    (isSupplierPaymentType(transaction.type) || transaction.type === "Return Adjustment") &&
    transaction.amount > ledger.balanceDue
  ) {
    throw new Error(
      `${ledger.supplierName} has only Rs. ${ledger.balanceDue} supplier due. Cannot post Rs. ${transaction.amount}.`,
    );
  }
}

/** Apply a transaction in place. */
export function applySupplierTransactionToLedger(
  ledger: SupplierBalances,
  transaction: SupplierTransactionEffect,
  transactionDay: string,
) {
  assertSupplierTransactionAllowed(ledger, transaction);

  if (transaction.type === "Purchase Bill") {
    ledger.totalPurchase += transaction.amount;
    ledger.balanceDue += transaction.amount;
  }

  if (isSupplierPaymentType(transaction.type)) {
    ledger.paidAmount += transaction.amount;
    ledger.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Return Adjustment") {
    ledger.totalPurchase -= transaction.amount;
    ledger.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Manual Adjustment") {
    ledger.balanceDue += transaction.amount;
  }

  ledger.lastTransaction = transactionDay;
}

/** Apply a transaction to a copy, for callers that must not mutate their input. */
export function withSupplierTransactionApplied<T extends SupplierBalances>(
  ledger: T,
  transaction: SupplierTransactionEffect,
  transactionDay: string,
): T {
  const next = { ...ledger };
  applySupplierTransactionToLedger(next, transaction, transactionDay);
  return next;
}
