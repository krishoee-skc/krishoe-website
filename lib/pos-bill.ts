// The bill total the counter pays against: the items, less a whole-bill
// discount, plus tax. Never below zero.
export function posBillTotal(itemsSubtotal: number, billDiscount: number, tax: number) {
  return Math.max(0, itemsSubtotal - billDiscount + tax);
}

// What the paid amount fills itself to. Every pay-now method — cash, QR, eSewa,
// Khalti, cheque, bank — starts at the full bill total, the way a POS "amount
// tendered" defaults to the total, so the cashier is not keying it on every
// sale. Only Credit stays at zero, because a credit bill is the due itself.
//
// Editing it down for a part payment stays safe: a paid amount below the total
// makes the bill partial, and a partial bill is refused unless it is linked to a
// customer ledger — so a half payment can never be quietly recorded as full and
// lose the shop the difference. The convenience does not cost the books.
export function autoPaidAmount(paymentMethod: string, billTotal: number) {
  return paymentMethod === "Credit" ? 0 : billTotal;
}
