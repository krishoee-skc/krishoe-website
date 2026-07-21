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
