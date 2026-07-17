// How a supplier bill's money is shared out across its lines.
//
// A real bill from Nobel Shoe runs from one line to twenty-five, mixes leather
// with ready-made chappals, and carries one discount and one VAT figure for the
// whole thing. The lines have to add back up to that figure exactly: this is
// what the supplier is owed, what the ledger posts, and what costing charges a
// pair at. A rupee lost to rounding here is a bill that never reconciles.
//
// Nothing in this module reads a file or a database, so both backends and the
// tests share it.

export type BillLineInput = {
  quantity: number;
  rate: number;
};

export type BillLineShare = {
  lineSubtotal: number;
  lineTotal: number;
};

export type BillTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clean(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function lineSubtotal(line: BillLineInput) {
  return round(clean(line.quantity) * clean(line.rate));
}

/**
 * The bill's totals. Discount is capped at the subtotal — a supplier cannot
 * discount more than they charged, and a negative total would post a negative
 * debt.
 */
export function billTotals(
  lines: BillLineInput[],
  input: { discount: number; tax: number },
): BillTotals {
  const subtotal = round(lines.reduce((sum, line) => sum + lineSubtotal(line), 0));
  const discount = round(Math.min(clean(input.discount), subtotal));
  const tax = round(clean(input.tax));

  return { subtotal, discount, tax, total: round(Math.max(0, subtotal - discount + tax)) };
}

/**
 * Share the bill's discount and tax across its lines, by what each line is
 * worth.
 *
 * The last line takes whatever is left rather than its own rounded share. Three
 * lines splitting a 10.00 discount are 3.33 each by the percentage, which is
 * 9.99 — and the bill would be a paisa out forever. Giving the remainder to the
 * last line keeps the sum exact, and the error it absorbs is at most a paisa
 * per line.
 */
export function shareBillAcrossLines(
  lines: BillLineInput[],
  input: { discount: number; tax: number },
): BillLineShare[] {
  const subtotals = lines.map(lineSubtotal);
  const totals = billTotals(lines, input);
  const netAdjustment = totals.tax - totals.discount;

  if (subtotals.length === 0) {
    return [];
  }

  // Every line is worth nothing (all rates zero), so there is no value to share
  // by. Put the whole adjustment on the first line rather than divide by zero.
  if (totals.subtotal <= 0) {
    return subtotals.map((subtotal, index) => ({
      lineSubtotal: subtotal,
      lineTotal: index === 0 ? Math.max(0, round(netAdjustment)) : 0,
    }));
  }

  let shared = 0;

  return subtotals.map((subtotal, index) => {
    const isLast = index === subtotals.length - 1;
    const share = isLast
      ? round(netAdjustment - shared)
      : round(netAdjustment * (subtotal / totals.subtotal));

    shared = round(shared + share);

    return {
      lineSubtotal: subtotal,
      // A discount bigger than the line cannot drive it negative: the line cost
      // nothing, not less than nothing.
      lineTotal: Math.max(0, round(subtotal + share)),
    };
  });
}

/**
 * What a whole bill is, from what its lines are. A bill carrying both kinds is
 * "Mixed" — normal for a supplier who sells material and finished pairs.
 */
export function billKindFromLines<T extends { kind: "Raw Material" | "Trading Goods" }>(
  lines: T[],
): "Raw Material" | "Trading Goods" | "Mixed" {
  const hasRaw = lines.some((line) => line.kind === "Raw Material");
  const hasTrading = lines.some((line) => line.kind === "Trading Goods");

  if (hasRaw && hasTrading) {
    return "Mixed";
  }

  return hasTrading ? "Trading Goods" : "Raw Material";
}
