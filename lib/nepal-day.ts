/**
 * The calendar day in Nepal, as YYYY-MM-DD (owner, 2026-10-21).
 *
 * A bill's day was the first ten characters of its UTC time, so Nepal's day
 * turned at 5:45 in the morning: an online order billed at 1:27 am fell on
 * the day before, and a code "ending 17 Oct" stopped at 5:45 that morning.
 * A date typed without a time ("2026-10-17") is that same day.
 */
const NEPAL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" });

export function nepalDay(value: string | Date = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : NEPAL_DAY.format(date);
}
