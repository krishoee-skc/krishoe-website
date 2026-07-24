import NepaliDate from "nepali-date-converter";

// Bikram Sambat beside the English date, so a bill reads the way a Nepali
// shopkeeper reads a date. Converted through a maintained library rather than a
// hand-typed month table, which drifts a day the moment one month's length is
// wrong.

// Devanagari — "०५ श्रावण २०८३". This is how BS dates are written and read.
export function toBikramSambatNepali(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    return new NepaliDate(date).format("DD MMMM YYYY", "np");
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
    const bs = new NepaliDate(date);
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
    const bs = new NepaliDate(date);
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
    return new NepaliDate(date).getDate() === 1;
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
    return new NepaliDate(date).format("MMMM YYYY", language);
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
    return new NepaliDate(date).format("DD MMMM YYYY");
  } catch {
    return "";
  }
}
