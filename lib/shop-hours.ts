/**
 * When the shop is open — written once (owner, 2026-10-13: 8 to 6, closed on
 * Monday). Checkout, the contact page and what search engines read all said
 * something different: checkout 8–6 closed Monday, the other two 10–7 Monday
 * to Saturday. A customer who came by on a Sunday on Google's word would have
 * found the shop open; one who came on a Monday, shut.
 */
export const shopHours = {
  /** schema.org openingHours: every day but Monday, 08:00–18:00. */
  schema: "Su,Tu-Sa 08:00-18:00",
  en: "8 AM – 6 PM. Closed every Monday.",
  ne: "बिहान ८ बजे – साँझ ६ बजे। हरेक सोमबार बन्द।",
  /** The same hours as numbers, for "Open now" (Nepal time, 24-hour clock). */
  opensAt: 8,
  closesAt: 18,
  /** 0 = Sunday … 6 = Saturday. */
  closedDay: 1,
} as const;

const NEPAL_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu",
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Whether the shop is open at this moment, by Nepal's clock (contact page,
 * owner 2026-10-24). It knows the weekly hours only — not a festival holiday.
 */
export function shopOpenNow(now: Date = new Date()) {
  const parts = NEPAL_CLOCK.formatToParts(now);
  const day = WEEKDAYS.indexOf(parts.find((part) => part.type === "weekday")?.value ?? "");
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  if (day === shopHours.closedDay) {
    return { open: false, en: "Closed today (Monday) · open tomorrow 8 AM", ne: "आज सोमबार बन्द · भोलि बिहान ८ बजे खुल्छ" };
  }
  if (hour >= shopHours.opensAt && hour < shopHours.closesAt) {
    return { open: true, en: "Open now · until 6 PM", ne: "अहिले खुला छ · साँझ ६ बजेसम्म" };
  }
  const tomorrowClosed = hour >= shopHours.closesAt && (day + 1) % 7 === shopHours.closedDay;
  return tomorrowClosed
    ? { open: false, en: "Closed now · opens Tuesday 8 AM", ne: "अहिले बन्द · मंगलबार बिहान ८ बजे खुल्छ" }
    : { open: false, en: "Closed now · opens 8 AM", ne: "अहिले बन्द · बिहान ८ बजे खुल्छ" };
}
