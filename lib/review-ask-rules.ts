import { noteNamesBill } from "@/lib/bill-number";
import { whatsappNumber } from "@/lib/phone-intl";

/**
 * Who to ask for a review (owner, 2026-10-01): counter customers whose bill
 * carries a phone. They leave no email, so the week-later mail never reaches
 * them, and the owner had to find each number in WhatsApp himself.
 */

type BillLike = {
  invoiceNumber: string;
  createdAt: string;
  kind: string;
  status: string;
  customerName: string;
  phone: string;
  note: string;
  items: Array<{ design: string }>;
};

export type CustomerToAsk = {
  phone: string;
  name: string;
  billNumber: string;
  createdAt: string;
  shoe: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ten digits, the way the shop keeps a Nepali mobile; anything else is not dialled. */
export function mobileDigits(phone: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const local = digits.length === 13 && digits.startsWith("977") ? digits.slice(3) : digits;
  return /^9\d{9}$/.test(local) ? local : "";
}

/** wa.me wants the country code. */
export function whatsappTo(phone: string) {
  // Any country now (lib/phone-intl.ts), not Nepal alone.
  return whatsappNumber(phone);
}

/**
 * Sale bills of the last `days` days with a mobile number, newest first, one
 * row a customer. A bill voided or returned is left out — the pair came back,
 * or it was a test — and so is anyone who has already said something to the
 * shop, so nobody is asked twice.
 */
export function customersToAsk(
  bills: BillLike[],
  alreadyHeard: string[],
  now: Date,
  days = 30,
  limit = 8,
): CustomerToAsk[] {
  const heard = new Set(alreadyHeard.map(mobileDigits).filter(Boolean));
  const returns = bills.filter((bill) => bill.kind === "Return");
  const since = now.getTime() - days * DAY_MS;
  const seen = new Set<string>();
  const out: CustomerToAsk[] = [];

  const sales = bills
    .filter((bill) => bill.kind === "Sale" && bill.status !== "Voided" && bill.status !== "Returned")
    .filter((bill) => new Date(bill.createdAt).getTime() >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  for (const bill of sales) {
    const phone = mobileDigits(bill.phone);
    if (!phone || heard.has(phone) || seen.has(phone)) continue;
    if (returns.some((back) => noteNamesBill(back.note, bill.invoiceNumber))) continue;
    seen.add(phone);
    const first = bill.items[0];
    const more = bill.items.length > 1 ? ` +${bill.items.length - 1}` : "";
    out.push({
      phone,
      name: bill.customerName.trim(),
      billNumber: bill.invoiceNumber,
      createdAt: bill.createdAt,
      shoe: first ? `${first.design}${more}`.trim() : "",
    });
    if (out.length >= limit) break;
  }
  return out;
}

export type ReviewStats = { reviews: number; average: number; live: number };

/** For the local store; the database counts its own. */
export function reviewStats(voices: Array<{ kind: string; rating: number; published: boolean }>): ReviewStats {
  const reviews = voices.filter((voice) => voice.kind === "review");
  const rated = reviews.filter((voice) => voice.rating > 0);
  return {
    reviews: reviews.length,
    average: rated.length ? rated.reduce((total, voice) => total + voice.rating, 0) / rated.length : 0,
    live: reviews.filter((voice) => voice.published).length,
  };
}
