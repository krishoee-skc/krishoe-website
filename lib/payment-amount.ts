// Parse the numeric rupee amount out of an order's stored total string.
//
// Order totals are stored as their display label (e.g. "Rs. 1,999"), so the
// currency label and thousands separators must be stripped before comparing a
// payment amount against the order.
//
// IMPORTANT: a naive `total.replace(/[^\d.]/g, "")` is WRONG here — it keeps the
// "." in "Rs.", turning "Rs. 1,999" into ".1999" which rounds to 0. A zero
// "expected amount" then silently DISABLES payment amount verification, letting
// a callback claim any amount for the order. Parse carefully instead.
export function parseOrderTotalRupees(total: string): number {
  const numeric = total
    .replace(/[a-z]+\.?/gi, "") // drop a currency label like "Rs." or "NPR"
    .replace(/,/g, "") // drop thousands separators
    .trim();

  const value = Number(numeric);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
