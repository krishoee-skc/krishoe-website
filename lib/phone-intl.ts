/**
 * Phone numbers from more than Nepal (owner, 2026-10-03: "Indian and other
 * countries' WhatsApp too").
 *
 * The shop kept every number as ten digits and six places each added +977 to
 * anything ten digits long when opening WhatsApp — so an Indian customer's
 * 98765 43210 went to a Nepali number that does not exist, two places dropped
 * the button for a "+91…" number, and the wholesale page added no code at all,
 * Nepali numbers included. One rule now, here:
 *
 *   "+91 98765 43210", "0091…"   the code that was typed wins
 *   "9779841234567"               already has Nepal's code
 *   "9841234567"                  ten digits from 9 — Nepal, as before
 *   "919876543210" (11–15)        a number that carries its own code
 *   anything else                 no WhatsApp, rather than a wrong one
 *
 * A Nepali number is still stored as its ten digits, as before; a number from
 * elsewhere is stored with its code, "+91 9876543210", so it can never be
 * mistaken for a Nepali one.
 */

export const NEPAL_CODE = "977";

/** Where the shop's customers and families are — Nepal first, then the neighbours and the work abroad. */
export const PHONE_COUNTRIES = [
  { code: "977", flag: "🇳🇵", en: "Nepal", ne: "नेपाल" },
  { code: "91", flag: "🇮🇳", en: "India", ne: "भारत" },
  { code: "971", flag: "🇦🇪", en: "UAE", ne: "दुबई (UAE)" },
  { code: "974", flag: "🇶🇦", en: "Qatar", ne: "कतार" },
  { code: "966", flag: "🇸🇦", en: "Saudi Arabia", ne: "साउदी" },
  { code: "965", flag: "🇰🇼", en: "Kuwait", ne: "कुवेत" },
  { code: "973", flag: "🇧🇭", en: "Bahrain", ne: "बहराइन" },
  { code: "968", flag: "🇴🇲", en: "Oman", ne: "ओमान" },
  { code: "60", flag: "🇲🇾", en: "Malaysia", ne: "मलेसिया" },
  { code: "81", flag: "🇯🇵", en: "Japan", ne: "जापान" },
  { code: "82", flag: "🇰🇷", en: "South Korea", ne: "दक्षिण कोरिया" },
  { code: "61", flag: "🇦🇺", en: "Australia", ne: "अस्ट्रेलिया" },
  { code: "44", flag: "🇬🇧", en: "UK", ne: "बेलायत" },
  { code: "1", flag: "🇺🇸", en: "USA / Canada", ne: "अमेरिका / क्यानडा" },
] as const;

const digitsOf = (value: string) => String(value ?? "").replace(/\D/g, "");

/** The country code at the start of a full number, longest match first. */
function codeAtStart(digits: string): string | null {
  const codes = PHONE_COUNTRIES.map((country) => country.code).sort((a, b) => b.length - a.length);
  return codes.find((code) => digits.startsWith(code)) ?? null;
}

/**
 * The number as wa.me wants it — digits, with the country code — or "" when it
 * cannot be told which number is meant.
 */
export function whatsappNumber(phone: string): string {
  const raw = String(phone ?? "").trim();
  let digits = digitsOf(raw);
  if (!digits) return "";
  if (/^\s*(\+|00)/.test(raw)) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    return digits.length >= 8 && digits.length <= 15 ? digits : "";
  }
  if (digits.length === 13 && digits.startsWith(NEPAL_CODE)) return digits;
  if (digits.length === 10 && digits.startsWith("9")) return `${NEPAL_CODE}${digits}`;
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith("0")) return digits;
  return "";
}

/** A stored number split for the country box: its code, and the rest. */
export function splitPhone(phone: string): { code: string; national: string } {
  const raw = String(phone ?? "").trim();
  const digits = digitsOf(raw);
  if (!digits) return { code: NEPAL_CODE, national: "" };
  if (/^\s*(\+|00)/.test(raw)) {
    const full = digits.startsWith("00") ? digits.slice(2) : digits;
    const code = codeAtStart(full);
    if (code) return { code, national: full.slice(code.length) };
  }
  if (digits.length === 13 && digits.startsWith(NEPAL_CODE)) return { code: NEPAL_CODE, national: digits.slice(3) };
  return { code: NEPAL_CODE, national: raw };
}

/**
 * What is kept: a Nepali number as the shop has always kept it (as typed, ten
 * digits), any other with its code in front — "+91 9876543210".
 */
export function joinPhone(code: string, national: string): string {
  const typed = String(national ?? "").trim();
  if (!typed) return "";
  // A code typed into the number itself wins over the box.
  if (/^(\+|00)/.test(typed)) return typed;
  if (code === NEPAL_CODE) return typed;
  return `+${code} ${digitsOf(typed).replace(/^0+/, "")}`;
}

/** Whether a stored number is from outside Nepal. */
export function isForeignPhone(phone: string) {
  const { code } = splitPhone(phone);
  return code !== NEPAL_CODE;
}
