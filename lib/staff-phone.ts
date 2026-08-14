/**
 * Mobile numbers as a sign-in identity.
 *
 * A factory worker has a phone, not an inbox. Everything stored and compared is
 * the bare national number — digits only, no country code, no separators — so
 * that `+977 984-111 2222`, `977 9841112222` and `9841112222` are one worker and
 * not three.
 */

const NEPAL_COUNTRY_CODE = "977";

/**
 * Reduces anything a person might type to the digits that identify them.
 * Returns "" when the input cannot be a phone number, so callers can treat an
 * unusable value and an absent one the same way.
 */
export function normalizeStaffPhone(value: string) {
  const digits = (value ?? "").replace(/\D+/g, "");
  if (!digits) return "";

  // `+977…` and `00977…` both reach here as a leading country code. It is
  // stripped only when the remainder is a full ten-digit national number, so a
  // local number that merely begins with 977 is left alone.
  const cleaned = digits.startsWith(`00${NEPAL_COUNTRY_CODE}`) && digits.length === 15
    ? digits.slice(5)
    : digits.startsWith(NEPAL_COUNTRY_CODE) && digits.length === 13
      ? digits.slice(3)
      : digits;

  return cleaned.length >= 7 && cleaned.length <= 15 ? cleaned : "";
}

/**
 * Whether what was typed into the sign-in box is meant to be a phone rather
 * than an email. An address always carries "@"; nothing else here does.
 */
export function looksLikePhone(value: string) {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed.includes("@")) return false;
  return normalizeStaffPhone(trimmed).length > 0;
}

/** Nepali mobiles are ten digits starting with 9. Advisory, not enforced. */
export function isNepaliMobile(value: string) {
  const digits = normalizeStaffPhone(value);
  return digits.length === 10 && digits.startsWith("9");
}

/** 9841112222 → 984-111-2222, for reading back on screen. */
export function formatStaffPhone(value: string) {
  const digits = normalizeStaffPhone(value);
  if (digits.length !== 10) return digits || value.trim();
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * What to show as the account's sign-in name. An account may hold an email, a
 * phone, or both; the email is the more familiar of the two when present.
 */
export function staffSignInLabel(account: { email?: string; phone?: string }) {
  const email = account.email?.trim() ?? "";
  if (email) return email;
  const phone = account.phone?.trim() ?? "";
  return phone ? formatStaffPhone(phone) : "";
}
