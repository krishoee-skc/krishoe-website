import {
  bikramMonthStartAdKey,
  bikramYearMonth,
  toBikramSambatNumeric,
} from "@/lib/bikram-sambat";
import type { PosInvoice } from "@/lib/pos";
import type { PurchaseInvoice } from "@/lib/purchasing";

// The weekly and monthly digests. Where the daily email answers "how was
// today", these answer "how was the stretch, and was it better or worse than
// the one before" — the comparison is the point, so a period always carries the
// period before it. Everything here is pure: it takes the invoice lists and the
// date boundaries and returns numbers, so the whole thing is unit-tested without
// a database and the cron route only has to load the snapshots and hand them in.

export type PeriodKind = "weekly" | "monthly";

// A half-open range of ISO date keys, [startKey, endKey). Keys are the first ten
// characters of an invoice's createdAt ("2026-07-24"), compared as strings —
// which orders ISO dates correctly — matching how the rest of the app slices its
// day, month and year buckets.
export type PeriodRange = {
  startKey: string;
  endKey: string;
};

export type PeriodReport = {
  kind: PeriodKind;
  // "गएको ७ दिन" / "गएको महिना" — the owner's words for the stretch.
  label: string;
  // The dates the stretch covers, in English and Bikram Sambat.
  rangeLabel: string;
  netSales: number;
  purchase: number;
  // Money actually taken in over the stretch: what sales were paid, less what
  // returns paid back out.
  paymentsReceived: number;
  billCount: number;
  pairsSold: number;
  // The design that moved the most pairs, or null when nothing sold.
  topDesign: { design: string; pairs: number } | null;
  // The single best day by net sales, or null when nothing sold.
  bestDay: { dateKey: string; netSales: number } | null;
  netProfitEstimate: number;
  previousNetSales: number;
  // Sales change against the previous stretch, as a whole-number percent.
  // Null when the previous stretch sold nothing (a share of zero has no meaning).
  changePercent: number | null;
};

function dateKeyOf(value: string) {
  return value.slice(0, 10);
}

function inRange(value: string, range: PeriodRange) {
  const key = dateKeyOf(value);
  return key >= range.startKey && key < range.endKey;
}

function isActiveSale(invoice: PosInvoice) {
  return invoice.status !== "Voided" && invoice.kind === "Sale";
}

function isActiveReturn(invoice: PosInvoice) {
  return invoice.status !== "Voided" && invoice.kind === "Return";
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

// Net sales for a set of POS invoices already narrowed to the range: sales
// billed, less returns billed.
function netSalesOf(posInvoices: PosInvoice[]) {
  const sales = sum(posInvoices.filter(isActiveSale), (invoice) => invoice.total);
  const returns = sum(posInvoices.filter(isActiveReturn), (invoice) => invoice.total);
  return sales - returns;
}

function topDesignOf(posInvoices: PosInvoice[]): PeriodReport["topDesign"] {
  const pairsByDesign = new Map<string, number>();

  for (const invoice of posInvoices) {
    // A sale adds pairs, a return takes them back; a voided bill is neither.
    const sign = isActiveSale(invoice) ? 1 : isActiveReturn(invoice) ? -1 : 0;
    if (sign === 0) continue;

    for (const item of invoice.items) {
      const design = item.design.trim();
      if (!design) continue;
      pairsByDesign.set(design, (pairsByDesign.get(design) ?? 0) + sign * item.quantity);
    }
  }

  let best: PeriodReport["topDesign"] = null;
  for (const [design, pairs] of pairsByDesign) {
    if (pairs > 0 && (!best || pairs > best.pairs)) {
      best = { design, pairs };
    }
  }
  return best;
}

function bestDayOf(posInvoices: PosInvoice[]): PeriodReport["bestDay"] {
  const netByDay = new Map<string, number>();

  for (const invoice of posInvoices) {
    const sign = isActiveSale(invoice) ? 1 : isActiveReturn(invoice) ? -1 : 0;
    if (sign === 0) continue;
    const key = dateKeyOf(invoice.createdAt);
    netByDay.set(key, (netByDay.get(key) ?? 0) + sign * invoice.total);
  }

  let best: PeriodReport["bestDay"] = null;
  for (const [dateKey, netSales] of netByDay) {
    if (netSales > 0 && (!best || netSales > best.netSales)) {
      best = { dateKey, netSales };
    }
  }
  return best;
}

function pairsSoldOf(posInvoices: PosInvoice[]) {
  return sum(posInvoices, (invoice) => {
    const sign = isActiveSale(invoice) ? 1 : isActiveReturn(invoice) ? -1 : 0;
    return sign * sum(invoice.items, (item) => item.quantity);
  });
}

function paymentsReceivedOf(posInvoices: PosInvoice[]) {
  const paidIn = sum(posInvoices.filter(isActiveSale), (invoice) => invoice.paidAmount);
  const paidOut = sum(posInvoices.filter(isActiveReturn), (invoice) => invoice.paidAmount);
  return paidIn - paidOut;
}

// The day before endKey, shown as the stretch's inclusive last date. endKey is
// exclusive, so a Sunday-morning weekly run reads "…– Saturday", not "…– Sunday".
function inclusiveLastKey(endKey: string) {
  const date = new Date(`${endKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function humanDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rangeLabelOf(range: PeriodRange) {
  const lastKey = inclusiveLastKey(range.endKey);
  const ad = `${humanDate(range.startKey)} – ${humanDate(lastKey)}`;
  const startBs = toBikramSambatNumeric(new Date(`${range.startKey}T00:00:00.000Z`));
  const lastBs = toBikramSambatNumeric(new Date(`${lastKey}T00:00:00.000Z`));
  return startBs && lastBs ? `${ad} · B.S ${startBs} – ${lastBs}` : ad;
}

// The core: given every POS and purchase invoice and the two stretches, fold the
// current stretch into a report and the previous one into just its net sales,
// which is all the comparison needs.
export function buildPeriodReport(input: {
  kind: PeriodKind;
  label: string;
  posInvoices: PosInvoice[];
  purchaseInvoices: PurchaseInvoice[];
  current: PeriodRange;
  previous: PeriodRange;
}): PeriodReport {
  const { kind, label, posInvoices, purchaseInvoices, current, previous } = input;

  const currentPos = posInvoices.filter((invoice) => inRange(invoice.createdAt, current));
  const previousPos = posInvoices.filter((invoice) => inRange(invoice.createdAt, previous));
  const currentPurchases = purchaseInvoices.filter((invoice) =>
    inRange(invoice.createdAt, current),
  );

  const netSales = netSalesOf(currentPos);
  const purchase = sum(currentPurchases, (invoice) => invoice.total);
  const previousNetSales = netSalesOf(previousPos);

  return {
    kind,
    label,
    rangeLabel: rangeLabelOf(current),
    netSales,
    purchase,
    paymentsReceived: paymentsReceivedOf(currentPos),
    billCount: currentPos.filter((invoice) => invoice.status !== "Voided").length,
    pairsSold: pairsSoldOf(currentPos),
    topDesign: topDesignOf(currentPos),
    bestDay: bestDayOf(currentPos),
    netProfitEstimate: netSales - purchase,
    previousNetSales,
    changePercent:
      previousNetSales > 0
        ? Math.round(((netSales - previousNetSales) / previousNetSales) * 100)
        : null,
  };
}

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

// The body of the email, bilingual the way the daily digest is: a Nepali label,
// its English gloss, then the number. Kept here beside the maths so the whole
// message is a pure function of the report and can be pinned by a test.
export function formatPeriodReportDetail(report: PeriodReport): string {
  const lines: string[] = [];
  lines.push(report.label);
  lines.push(`अवधि (Period): ${report.rangeLabel}`);
  lines.push("");
  lines.push(`कुल बिक्री (Net sales): ${money(report.netSales)}`);

  if (report.changePercent !== null) {
    const arrow = report.changePercent > 0 ? "⬆️" : report.changePercent < 0 ? "⬇️" : "➡️";
    const word = report.changePercent > 0 ? "बढी" : report.changePercent < 0 ? "कम" : "बराबर";
    lines.push(
      `  अघिल्लो अवधिभन्दा (vs previous): ${arrow} ${Math.abs(report.changePercent)}% ${word} — ${money(report.previousNetSales)}`,
    );
  } else {
    lines.push("  अघिल्लो अवधि (vs previous): तुलना गर्न बिक्री थिएन");
  }

  lines.push(`कुल किनमेल (Purchases): ${money(report.purchase)}`);
  lines.push(`अनुमानित नाफा (Est. profit): ${money(report.netProfitEstimate)}`);
  lines.push(`भुक्तानी संकलन (Collected): ${money(report.paymentsReceived)}`);
  lines.push(`बिल संख्या (Bills): ${report.billCount}`);
  lines.push(`जोर बिक्री (Pairs sold): ${report.pairsSold}`);

  if (report.topDesign) {
    lines.push(
      `सबभन्दा बिकेको (Top design): ${report.topDesign.design} — ${report.topDesign.pairs} जोर`,
    );
  }
  if (report.bestDay) {
    const bs = toBikramSambatNumeric(new Date(`${report.bestDay.dateKey}T00:00:00.000Z`));
    const day = bs ? `${humanDate(report.bestDay.dateKey)} · B.S ${bs}` : humanDate(report.bestDay.dateKey);
    lines.push(`उत्कृष्ट दिन (Best day): ${day} — ${money(report.bestDay.netSales)}`);
  }

  return lines.join("\n");
}

// The half-open range ending at the run date and reaching back seven days, plus
// the seven days before that to compare against. The weekly cron fires on a
// Sunday, so "current" is the week just finished, Sunday through Saturday.
export function weeklyRanges(reference: Date): { current: PeriodRange; previous: PeriodRange } {
  const endKey = reference.toISOString().slice(0, 10);
  const shift = (days: number) => {
    const date = new Date(`${endKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const currentStart = shift(-7);
  const previousStart = shift(-14);
  return {
    current: { startKey: currentStart, endKey },
    previous: { startKey: previousStart, endKey: currentStart },
  };
}

// The Bikram Sambat month before the run date, plus the month before that. A
// Nepali shop closes its books on the Nepali month (Shrawan, Bhadra…), not the
// English one, and those boundaries fall mid-English-month — so the range is
// built from BS month starts, converted to their A.D. calendar days. The monthly
// digest fires on BS gate 1, so "current" is the BS month just closed.
export function monthlyRanges(reference: Date): { current: PeriodRange; previous: PeriodRange } {
  const bs = bikramYearMonth(reference);

  if (!bs) {
    // Only reached if the reference date cannot be converted; fall back to the
    // English month so the digest still sends something rather than nothing.
    const year = reference.getUTCFullYear();
    const month = reference.getUTCMonth();
    const adStart = (back: number) =>
      new Date(Date.UTC(year, month - back, 1)).toISOString().slice(0, 10);
    return {
      current: { startKey: adStart(1), endKey: adStart(0) },
      previous: { startKey: adStart(2), endKey: adStart(1) },
    };
  }

  // bikramMonthStartAdKey carries a negative month index back into the prior BS
  // year, so gate 1 of Baisakh still resolves its two preceding months.
  const monthStart = (monthsBack: number) =>
    bikramMonthStartAdKey(bs.year, bs.monthIndex - monthsBack);
  const thisMonthStart = monthStart(0);
  const lastMonthStart = monthStart(1);
  const monthBeforeStart = monthStart(2);
  return {
    current: { startKey: lastMonthStart, endKey: thisMonthStart },
    previous: { startKey: monthBeforeStart, endKey: lastMonthStart },
  };
}
