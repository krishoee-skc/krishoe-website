import NepaliDate from "nepali-date-converter";

// Bikram Sambat beside the English date, so a bill reads the way a Nepali
// shopkeeper reads a date. Converted through a maintained library rather than a
// hand-typed month table, which drifts a day the moment one month's length is
// wrong.

/** The only clock this shop keeps. */
export const NEPAL_TIME_ZONE = "Asia/Kathmandu";

/**
 * The same instant, re-expressed so a Date's local getters read Kathmandu.
 *
 * NepaliDate converts using getFullYear/getMonth/getDate, which answer in
 * whatever zone the machine is set to. On Vercel that is UTC, and Nepal is
 * UTC+5:45 — so every moment between midnight and a quarter to six in the
 * morning fell on the PREVIOUS Bikram Sambat day on the server, in a shop that
 * closes its books by the day. A bill written at one in the morning was filed
 * against yesterday.
 *
 * Shifting the instant is a lie about the moment and the truth about the day,
 * which is what a calendar date is. Nothing here is ever stored or compared —
 * it exists only long enough to be read as a date.
 */
function inNepal(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NEPAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  // hour comes back as 24 at midnight in some engines; 24 % 24 is 0.
  return new Date(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
}

// Devanagari — "०५ श्रावण २०८३". This is how BS dates are written and read.
export function toBikramSambatNepali(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    return new NepaliDate(inNepal(date)).format("DD MMMM YYYY", "np");
  } catch {
    return "";
  }
}

// Numeric — "2083/04/07". The owner reads BS dates fastest as plain numbers,
// so this is what sits beside the English date across the admin. Built from
// the getters rather than a format string so the zero-padding is certain.
export function toBikramSambatNumeric(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    const bs = new NepaliDate(inNepal(date));
    const month = String(bs.getMonth() + 1).padStart(2, "0");
    const day = String(bs.getDate()).padStart(2, "0");
    return `${bs.getYear()}/${month}/${day}`;
  } catch {
    return "";
  }
}

// The Nepali civil calendar day, "YYYY-MM-DD", read from a JS Date's local
// fields rather than its ISO string. toJsDate() below returns local midnight, so
// on a machine east of UTC toISOString() would roll the day back one; the local
// fields give the calendar day the owner would read either way.
function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The A.D. calendar day a Bikram Sambat month begins, as "YYYY-MM-DD". A month
// index outside 0–11 is carried into the year first, so a caller can ask for
// "two months before Baisakh" without doing the wrap itself. Returns "" if the
// conversion cannot be made rather than throwing.
export function bikramMonthStartAdKey(bsYear: number, bsMonthIndex: number): string {
  let year = bsYear;
  let month = bsMonthIndex;
  while (month < 0) {
    month += 12;
    year -= 1;
  }
  while (month > 11) {
    month -= 12;
    year += 1;
  }
  try {
    return localDateKey(new NepaliDate(year, month, 1).toJsDate());
  } catch {
    return "";
  }
}

// The Bikram Sambat year and month index (Baisakh = 0) a date falls in, or null
// if it cannot be converted. Used to anchor a monthly digest to the BS month.
export function bikramYearMonth(value: string | Date): { year: number; monthIndex: number } | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    const bs = new NepaliDate(inNepal(date));
    return { year: bs.getYear(), monthIndex: bs.getMonth() };
  } catch {
    return null;
  }
}

// True when the date is the first day (gate 1) of a Bikram Sambat month — the
// day a Nepali shop's month turns over, which is what the monthly digest waits
// for instead of the 1st of the English month.
export function isBikramMonthStart(value: string | Date): boolean {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  try {
    return new NepaliDate(inNepal(date)).getDate() === 1;
  } catch {
    return false;
  }
}

// The Bikram Sambat month name and year for a date, "श्रावण २०८३" (or Roman),
// for naming the stretch a monthly digest covers. Empty on an unparseable date.
export function bikramMonthLabel(value: string | Date, language: "en" | "np" = "np"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    return new NepaliDate(inNepal(date)).format("MMMM YYYY", language);
  } catch {
    return "";
  }
}

// Roman — "05 Shrawan 2083", for anywhere the surrounding text is English.
export function toBikramSambatRoman(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    return new NepaliDate(inNepal(date)).format("DD MMMM YYYY");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Bikram Sambat months as a period, so money can be counted the way a Nepali
// shop counts it.
//
// A factory ledger filtered on the English month splits Bhadra in half: work
// from 17 August lands in "August" and the rest in "September", so the answer
// to "how much did this worker earn in Bhadra" is a figure the app never
// produces. Wages are agreed by the Nepali month, so they have to be summed by
// it.
//
// The dates stay stored as A.D. — Postgres compares and sorts them natively,
// and "the last seven days" has to keep working. Only the boundaries move.
// ---------------------------------------------------------------------------

const BIKRAM_MONTH_KEY = /^(\d{4})-(\d{2})$/;

/** "2083-05" for whatever Bikram Sambat month a date falls in. Month 01 = Baisakh. */
export function bikramMonthKeyOf(value: string | Date): string {
  const bs = bikramYearMonth(value);
  return bs ? `${bs.year}-${String(bs.monthIndex + 1).padStart(2, "0")}` : "";
}

/**
 * The A.D. days a Bikram Sambat month covers, as a half-open range.
 *
 * End-exclusive on purpose. A closed range needs the month's last day, and BS
 * months run 29 to 32 days — the length that is wrong is the one nobody
 * checks. Asking for the next month's first day never has to know.
 *
 * `+ INTERVAL '1 month'` cannot stand in for this either: Bhadra starts 17
 * August and Asoj starts 17 September, which looks like it works, until Asoj
 * runs 31 days to 18 October and a day of somebody's wages falls outside the
 * month they earned it in.
 */
export function bikramMonthRange(monthKey: string): { startKey: string; endKey: string } | null {
  const match = BIKRAM_MONTH_KEY.exec(monthKey.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  // A Bikram Sambat year runs about 57 ahead of the Gregorian one, so BS
  // 2070-2110 is 2013-2053 A.D. — every year this shop could be closing books
  // in, and nothing an A.D. date could be mistaken for. Without the lower
  // bound, a stale link carrying "2026-08" reads as BS 2026 Bhadra and reports
  // a worker's pay for 1969.
  if (year < 2070 || year > 2110) return null;

  const startKey = bikramMonthStartAdKey(year, month - 1);
  const endKey = bikramMonthStartAdKey(year, month);
  return startKey && endKey ? { startKey, endKey } : null;
}

/**
 * Recent Bikram Sambat months, newest first, for a picker.
 *
 * `<input type="month">` is the browser's own English control and cannot be
 * made to speak BS, so the months are listed instead — which also means the
 * owner picks "भाद्र २०८३" by name rather than converting a date in their head.
 */
export function recentBikramMonths(
  count = 14,
  reference: Date = new Date(),
): { key: string; label: string }[] {
  const bs = bikramYearMonth(reference);
  if (!bs) return [];

  const months: { key: string; label: string }[] = [];
  for (let back = 0; back < count; back += 1) {
    let year = bs.year;
    let index = bs.monthIndex - back;
    while (index < 0) {
      index += 12;
      year -= 1;
    }
    const startKey = bikramMonthStartAdKey(year, index);
    if (!startKey) continue;
    months.push({
      key: `${year}-${String(index + 1).padStart(2, "0")}`,
      label: bikramMonthLabel(`${startKey}T06:00:00.000Z`),
    });
  }
  return months;
}
