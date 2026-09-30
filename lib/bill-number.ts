import type { PosInvoiceKind } from "@/lib/pos";

/**
 * Short counter bill numbers: KRB001, KRB002, … for sales and KRR001, … for
 * returns (owner, 2026-09-30). The old ones read KR-BILL-20260930-0001-C8EA72,
 * too long to say over the phone or write in a ledger.
 *
 * Not "KR001": the counter reads "KR205" as the shoe KR-205, so a bill named
 * KR205 would be a shoe code as well. One running count for every branch, so a
 * number names one bill. Old bills keep their old numbers.
 */
export const BILL_PREFIX = { Sale: "KRB", Return: "KRR" } as const satisfies Record<PosInvoiceKind, string>;

export function formatBillNumber(kind: PosInvoiceKind, count: number) {
  return `${BILL_PREFIX[kind]}${String(count).padStart(3, "0")}`;
}

/** The next number after the highest of its kind; old-style numbers do not count. */
export function nextBillNumber(kind: PosInvoiceKind, existing: Iterable<string>) {
  const pattern = new RegExp(`^${BILL_PREFIX[kind]}(\\d+)$`);
  let highest = 0;
  for (const number of existing) {
    const match = pattern.exec(String(number ?? "").trim());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return formatBillNumber(kind, highest + 1);
}

/**
 * Whether a stock or ledger note was written for this bill. Matched as a whole
 * word: "KRB100" is inside "KRB1000 sale …", which is another bill.
 */
export function noteNamesBill(note: string, billNumber: string) {
  if (!billNumber) return false;
  const escaped = billNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9-])${escaped}($|[^A-Za-z0-9-])`).test(String(note ?? ""));
}

/** Two bills saved at the same moment took the same number; the later one tries the next. */
export function isBillNumberTaken(error: unknown) {
  const failure = error as { code?: string; constraint?: string; message?: string } | null;
  if (failure?.code !== "23505") return false;
  return String(failure.constraint ?? failure.message ?? "").includes("invoice_number");
}
