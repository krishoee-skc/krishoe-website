/**
 * Alt + 1–4: the four doors of the Transactions page from anywhere in the
 * admin, the way Tally's function keys open a voucher (owner, 2026-10-28:
 * "yo rakhne garau").
 *
 * Not Tally's own keys: in a browser F5 reloads the page and loses a half-filled
 * form, F6 jumps to the address bar, and F9 already saves the counter bill.
 * Alt with a number is free in Chrome and Edge on Windows.
 */
export const VOUCHER_EVENT = "krishoe:voucher";

export type VoucherKey = "sale" | "buy" | "in" | "out";

const BY_DIGIT: Record<string, VoucherKey> = { "1": "sale", "2": "buy", "3": "in", "4": "out" };

export const VOUCHER_HREF: Record<VoucherKey, string> = {
  sale: "/admin/pos?from=transactions",
  buy: "/admin/purchasing?from=transactions",
  in: "/admin/transactions?v=in",
  out: "/admin/transactions?v=out",
};

/** The voucher an Alt + digit asks for, or null for any other key. */
export function voucherForKey(event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "code" | "key">): VoucherKey | null {
  // AltGr reads as Ctrl + Alt on Windows; it types characters and is not ours.
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  // The number row only: Alt with the number pad types a character on Windows
  // (Alt + 0169 is ©), and that must stay typing.
  const digit = /^Digit([1-4])$/.exec(event.code)?.[1] ?? (!event.code && /^[1-4]$/.test(event.key) ? event.key : "");
  return BY_DIGIT[digit] ?? null;
}
