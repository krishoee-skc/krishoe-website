import { NEPAL_TIME_ZONE, bikramMonthStartAdKey, bikramYearMonth } from "@/lib/bikram-sambat";

/**
 * The owner's dashboard figures that the POS snapshot does not already carry:
 * the last seven days day by day, and the Bikram Sambat month so far. Pure —
 * invoices in, numbers out — so it is tested without a database.
 *
 * Days are Nepal days. The POS snapshot's "this month" is the A.D. month, but
 * the owner's month (and their goal, saved as "2083-06") is Asoj, which began
 * on 17 September.
 */
export type SaleLike = { createdAt: string; kind: string; status: string; total: number };

const WEEKDAYS = [
  { en: "Sun", ne: "आइत" },
  { en: "Mon", ne: "सोम" },
  { en: "Tue", ne: "मंगल" },
  { en: "Wed", ne: "बुध" },
  { en: "Thu", ne: "बिही" },
  { en: "Fri", ne: "शुक्र" },
  { en: "Sat", ne: "शनि" },
];

export function nepalDayKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NEPAL_TIME_ZONE }).format(new Date(value));
}

function addDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A sale adds, a return takes away, a voided bill is neither. */
function netOf(invoice: SaleLike) {
  if (invoice.status === "Voided") return 0;
  if (invoice.kind === "Sale") return Number(invoice.total) || 0;
  if (invoice.kind === "Return") return -(Number(invoice.total) || 0);
  return 0;
}

/** Net sales for Nepal days in [startKey, endKey). */
export function netSalesBetween(invoices: SaleLike[], startKey: string, endKey: string) {
  let total = 0;
  for (const invoice of invoices) {
    const key = nepalDayKey(invoice.createdAt);
    if (key >= startKey && key < endKey) total += netOf(invoice);
  }
  return total;
}

/** The last `days` Nepal days, oldest first, today last. */
export function salesByDay(invoices: SaleLike[], days = 7, now: Date = new Date()) {
  const today = nepalDayKey(now);
  const byDay = new Map<string, number>();
  for (const invoice of invoices) {
    const key = nepalDayKey(invoice.createdAt);
    byDay.set(key, (byDay.get(key) ?? 0) + netOf(invoice));
  }
  return Array.from({ length: days }, (_, index) => {
    const key = addDays(today, index - (days - 1));
    const weekday = WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
    return { key, en: weekday.en, ne: weekday.ne, net: byDay.get(key) ?? 0, today: key === today };
  });
}

/** The Bikram Sambat month so far: where it began, and how many days it runs. */
export function bsMonthSoFar(now: Date = new Date()) {
  const today = nepalDayKey(now);
  const bs = bikramYearMonth(today);
  if (!bs) return null;
  const startKey = bikramMonthStartAdKey(bs.year, bs.monthIndex);
  const nextYear = bs.monthIndex === 11 ? bs.year + 1 : bs.year;
  const nextIndex = (bs.monthIndex + 1) % 12;
  const nextKey = bikramMonthStartAdKey(nextYear, nextIndex);
  if (!startKey || !nextKey) return null;
  const length = Math.round((Date.parse(`${nextKey}T00:00:00Z`) - Date.parse(`${startKey}T00:00:00Z`)) / 86_400_000);
  const dayOfMonth = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startKey}T00:00:00Z`)) / 86_400_000) + 1;
  return { startKey, endKey: addDays(today, 1), daysInMonth: length, dayOfMonth, year: bs.year, monthIndex: bs.monthIndex };
}

/**
 * The catalogue's pairs at their selling price, in rupees. price_value is kept
 * in paisa; the dashboard used to add it up as rupees and showed a hundred times
 * the stock (Rs. 99,80,000 for about Rs. 99,800) — the owner's sample, 2026-09-28.
 */
export function stockAtSellingPrice(products: Array<{ priceValue: number; stock: number }>) {
  return products.reduce(
    (total, product) => total + ((Number(product.priceValue) || 0) / 100) * Math.max(0, Number(product.stock) || 0),
    0,
  );
}
