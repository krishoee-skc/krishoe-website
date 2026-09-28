/**
 * Why an online order was cancelled, or is coming back — the reasons the
 * order desk offers.
 *
 * Saved as the English words whichever language the desk is read in, and
 * shown in the reader's language. Saving whatever was on the button split one
 * reason in two: "फोन उठाएन" on the days the desk was read in Nepali, "Did not
 * answer the phone" on the others, and a count of cancel reasons counted each
 * half separately.
 */
export const CANCEL_REASONS = [
  { en: "Did not answer the phone", ne: "फोन उठाएन" },
  { en: "Size did not fit", ne: "साइज मिलेन" },
  { en: "Customer cancelled", ne: "ग्राहक आफैँले रद्द गरे" },
  { en: "Not a real order", ne: "नक्कली अर्डर" },
  { en: "Refused at the door", ne: "ढोकामा लिएनन्" },
] as const;

function findReason(value: string) {
  const clean = value.trim();
  return CANCEL_REASONS.find((reason) => reason.en === clean || reason.ne === clean);
}

/**
 * The one form a reason is saved in: a known reason in either language becomes
 * its English words. Anything else is kept as it was typed, so a reason saved
 * before this list, or outside it, is never lost.
 */
export function cancelReasonToSave(value: string) {
  return findReason(value)?.en ?? value.trim();
}

/** A saved reason in the reader's language; one not on the list, as it was saved. */
export function cancelReasonLabel(saved: string, text: (en: string, ne: string) => string) {
  const reason = findReason(saved);
  return reason ? text(reason.en, reason.ne) : saved.trim();
}

/**
 * A sent order on its way back: still Contacted, so its pairs stay held while
 * they are with the courier, with the reason written beside it. Only "Back in
 * the shop" cancels it and lets the pairs go (lib/order-dispatch.ts).
 */
export function isOrderComingBack(
  status: string,
  dispatch: { dispatchedAt: string; cancelReason: string } | undefined,
) {
  return status === "Contacted" && Boolean(dispatch?.dispatchedAt) && Boolean(dispatch?.cancelReason);
}
