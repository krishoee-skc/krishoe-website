import { NEPAL_TIME_ZONE, toBikramSambatNumeric } from "@/lib/bikram-sambat";

// One date format for the whole admin: the English date, then the Bikram Sambat
// date after it, so every bill, list and record reads the way a Nepali reader
// reads a date — no converting in the head. The BS part is plain numbers
// ("B.S 2083/04/07") because that is how the owner reads them fastest. A blank
// or unparseable value comes back empty rather than throwing, and if the BS
// conversion cannot be made the English date still shows on its own.
export function formatAdminDate(value: string | Date, options?: { time?: boolean }): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  // Kathmandu, always — not the clock of whatever machine happens to be
  // formatting. Without this the server and the browser disagreed about the
  // same moment by 5 hours 45 minutes: a bill saved at 10:46 in the morning
  // rendered "5:01 am" into the page, and the owner's browser quietly
  // corrected it to 10:46 a moment later. Two answers, and the wrong one
  // arrives first.
  //
  // The date is worse than the time. Nepal is UTC+5:45, so anything recorded
  // between midnight and a quarter to six in the morning is still YESTERDAY in
  // UTC — a bill written at one in the morning was dated the previous day on
  // the server, in a shop that closes its books by the day.
  const ad = new Intl.DateTimeFormat("en-IN", {
    timeZone: NEPAL_TIME_ZONE,
    dateStyle: "medium",
    ...(options?.time ? { timeStyle: "short" as const } : {}),
  }).format(date);

  const bs = toBikramSambatNumeric(date);
  return bs ? `${ad} · B.S ${bs}` : ad;
}

/**
 * Any date, in Kathmandu, whatever the machine thinks the time is.
 *
 * There were fourteen other places formatting a date with no timezone named,
 * each one answering in the zone of whichever machine ran it — Nepal in the
 * owner's browser, UTC on the server, and a shopper's own zone on the order
 * page, where a customer in Qatar was shown a Qatari timestamp for a Nepali
 * shop's bill. One helper so a fifteenth place cannot quietly disagree.
 *
 * Takes the same options as Intl.DateTimeFormat; the zone is not one of them.
 */
export function nepalDate(
  value: string | Date,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone"> = { dateStyle: "medium" },
  locale = "en-IN",
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, { ...options, timeZone: NEPAL_TIME_ZONE }).format(date);
}
