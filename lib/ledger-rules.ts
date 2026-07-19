// How a transaction changes a customer ledger. Nothing here reads a file or a
// database, so both backends can share it — the same reason lib/stock-rules.ts
// exists, and for the same failure: these rules were written out twice, once in
// lib/operations.ts for local-json and again in lib/operations-postgres.ts for
// Postgres. The copies were identical, tests only reached the local-json one,
// and production only runs the other.
//
// The types are defined here rather than in lib/operations.ts so the dependency
// only ever points this way. operations imports rules; the other direction would
// put this module inside the cycle it exists to avoid.

export type LedgerTransactionType =
  | "Cash Payment"
  | "Cheque Payment"
  | "Credit Sale"
  | "Return Adjustment"
  | "Manual Adjustment";

// Only what the rules need. The stored rows carry more (id, phone, channel),
// and the callers keep those.
export type LedgerBalances = {
  customerName: string;
  cashPaid: number;
  chequePaid: number;
  creditGiven: number;
  balanceDue: number;
};

export type LedgerTransactionEffect = {
  type: LedgerTransactionType;
  amount: number;
};

/** Transactions that pay down what the customer owes. */
export function isLedgerPaymentType(type: LedgerTransactionType) {
  return type === "Cash Payment" || type === "Cheque Payment";
}

function reducesBalanceDue(type: LedgerTransactionType) {
  return isLedgerPaymentType(type) || type === "Return Adjustment";
}

/**
 * Refuse a transaction the ledger cannot carry, before anything is written.
 *
 * Posting more than a customer owes used to be allowed, and the balance simply
 * clamped at zero. Undoing that entry then added the *full* amount back, so the
 * clamped rupees appeared out of nowhere: a customer owing Rs. 100 who was
 * recorded as paying Rs. 500, then had that entry deleted, ended up owing
 * Rs. 500 the shop had never been owed.
 *
 * Refusing up front is what makes apply and reverse exact inverses, and it is
 * the rule the supplier side of the books has always used.
 */
export function assertLedgerTransactionAllowed(
  ledger: LedgerBalances,
  transaction: LedgerTransactionEffect,
) {
  if (transaction.amount <= 0) {
    throw new Error("Ledger transaction amount must be greater than zero.");
  }

  if (reducesBalanceDue(transaction.type) && transaction.amount > ledger.balanceDue) {
    throw new Error(
      `${ledger.customerName} has only Rs. ${ledger.balanceDue} due. Cannot post Rs. ${transaction.amount}.`,
    );
  }
}

// Apply and reverse are deliberately written as mirror images, with no clamping
// on balanceDue in either direction. The clamps are what broke this: apply used
// Math.max(0, ...) and reverse did not, so the pair stopped being an inverse the
// moment a transaction was larger than the balance. assertLedgerTransactionAllowed
// now rules that case out, so no clamp is needed and none is wanted — a clamp
// here would silently lose money again.
export function applyLedgerTransactionToBalances<T extends LedgerBalances>(
  ledger: T,
  transaction: LedgerTransactionEffect,
): T {
  const next = { ...ledger };

  if (transaction.type === "Cash Payment") {
    next.cashPaid += transaction.amount;
    next.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Cheque Payment") {
    next.chequePaid += transaction.amount;
    next.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Credit Sale") {
    next.creditGiven += transaction.amount;
    next.balanceDue += transaction.amount;
  }

  if (transaction.type === "Return Adjustment") {
    next.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Manual Adjustment") {
    next.balanceDue += transaction.amount;
  }

  return next;
}

export function reverseLedgerTransactionFromBalances<T extends LedgerBalances>(
  ledger: T,
  transaction: LedgerTransactionEffect,
): T {
  const next = { ...ledger };

  if (transaction.type === "Cash Payment") {
    next.cashPaid -= transaction.amount;
    next.balanceDue += transaction.amount;
  }

  if (transaction.type === "Cheque Payment") {
    next.chequePaid -= transaction.amount;
    next.balanceDue += transaction.amount;
  }

  if (transaction.type === "Credit Sale") {
    next.creditGiven -= transaction.amount;
    next.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Return Adjustment") {
    next.balanceDue += transaction.amount;
  }

  if (transaction.type === "Manual Adjustment") {
    next.balanceDue -= transaction.amount;
  }

  return next;
}
