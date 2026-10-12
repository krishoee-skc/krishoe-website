import { NEPAL_TIME_ZONE, bikramMonthStartAdKey, bikramYearMonth } from "@/lib/bikram-sambat";
import { designKey } from "@/lib/design-name";

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

export type ShoeStockLine = {
  name: string;
  /** On the website (Active) or not yet (Draft). */
  web: boolean;
  /** Pairs in stock (the books). */
  total: number;
  /** Placed at the factory and at the shop, within the stock. */
  factory: number;
  shop: number;
  /** Placed beyond the stock: "where" says more than "how many". */
  over: number;
};

export type StockOverview = {
  lines: ShoeStockLine[];
  all: number;
  web: number;
  draft: number;
  draftShoes: number;
  factory: number;
  shop: number;
  over: number;
  /** Pairs in stock with no place said. */
  noPlace: number;
  /** Shoes whose places do not match their stock. */
  mismatched: Array<{ name: string; over: number; noPlace: number }>;
  /** Website shoes with pairs, none of them at the shop. */
  noneAtShop: Array<{ name: string; factory: number }>;
  /** Shoes with pairs but no selling price, so no value. */
  noPrice: number;
  /** Every pair at its selling price, in rupees. */
  value: number;
};

/**
 * Every shoe's stock and where it is, for the dashboard (owner, 2026-10-11).
 * "Shop stock" listed the website shoes' whole stock (three of the four were
 * all at the factory) and "181 pairs" left out the 399 in draft. Pure: the
 * products and the stock page's places in, the figures out.
 *
 * The books (finished_stock) say how many; the places say where. Placed pairs
 * beyond the books are "over", taken off the shop first, so the factory and
 * the shop add up to no more than the stock.
 */
export function stockByShoe(
  products: Array<{ name: string; status: string; stock: number; priceValue: number }>,
  places: Array<{ design: string; factory: number; shop: number; total: number }>,
): StockOverview {
  const byKey = new Map<string, { factory: number; shop: number; total: number }>();
  for (const row of places) {
    const key = designKey(row.design);
    const entry = byKey.get(key) ?? { factory: 0, shop: 0, total: 0 };
    entry.factory += Math.max(0, row.factory);
    entry.shop += Math.max(0, row.shop);
    entry.total += Math.max(0, row.total);
    byKey.set(key, entry);
  }
  const lines: ShoeStockLine[] = [];
  let noPrice = 0;
  let value = 0;
  for (const product of products) {
    const placed = byKey.get(designKey(product.name));
    const total = placed ? placed.total : Math.max(0, Number(product.stock) || 0);
    const factory = placed?.factory ?? 0;
    const shop = placed?.shop ?? 0;
    const over = Math.max(0, factory + shop - total);
    const overShop = Math.min(over, shop);
    const web = product.status === "Active";
    // A draft with nothing is not stock; a website shoe sold out still is news.
    if (total <= 0 && !web) continue;
    lines.push({ name: product.name, web, total, factory: factory - (over - overShop), shop: shop - overShop, over });
    if (total > 0 && !(Number(product.priceValue) > 0)) noPrice += 1;
    value += ((Number(product.priceValue) || 0) / 100) * total;
  }
  lines.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const sum = (pick: (line: ShoeStockLine) => number) => lines.reduce((total, line) => total + pick(line), 0);
  const all = sum((line) => line.total);
  const web = sum((line) => (line.web ? line.total : 0));
  return {
    lines,
    all,
    web,
    draft: all - web,
    draftShoes: lines.filter((line) => !line.web && line.total > 0).length,
    factory: sum((line) => line.factory),
    shop: sum((line) => line.shop),
    over: sum((line) => line.over),
    noPlace: sum((line) => Math.max(0, line.total - line.factory - line.shop)),
    mismatched: lines
      .map((line) => ({ name: line.name, over: line.over, noPlace: Math.max(0, line.total - line.factory - line.shop) }))
      .filter((line) => line.over > 0 || line.noPlace > 0),
    noneAtShop: lines.filter((line) => line.web && line.total > 0 && line.shop === 0).map((line) => ({ name: line.name, factory: line.factory })),
    noPrice,
    value,
  };
}
