/**
 * When a bill kept on a phone without the internet was sold (owner,
 * 2026-10-20, the kept-bill sample, 1).
 *
 * A cash sale at 8 in the evening that reached the shop the next morning used
 * to fall on the next day: that day's sales were Rs 950 more than its drawer,
 * and the evening's were Rs 950 less. Now the bill carries the time it was
 * sold. Only up to a day back — an older one is held for the owner, and saved
 * today when opened again — and never ahead of the shop's own clock, so no one
 * can date a bill by hand. A bill made with the internet never carries a time.
 */

export const KEPT_BILL_MAX_HOURS = 24;

/** A phone's clock a little ahead of the shop's is the same moment. */
const CLOCK_SLACK_MS = 2 * 60 * 1000;

const TOO_OLD = {
  en: `Kept more than ${KEPT_BILL_MAX_HOURS} hours — open it on the bill and save it (it is dated today).`,
  ne: "२४ घण्टाभन्दा पुरानो बिल — बिलमा खोलेर हेर्नुहोस् र Save थिच्नुहोस् (आजको मितिमा बन्छ)।",
};

export class KeptBillTooOld extends Error {
  constructor() {
    super(`${TOO_OLD.ne} · ${TOO_OLD.en}`);
    this.name = "KeptBillTooOld";
  }
}

const NEPAL_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kathmandu",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "21-10-2026 07:30", in Nepal time. */
export function nepalStamp(at: Date) {
  const part = (type: string) => NEPAL_TIME.formatToParts(at).find((item) => item.type === type)?.value ?? "";
  return `${part("day")}-${part("month")}-${part("year")} ${part("hour")}:${part("minute")}`;
}

/**
 * The bill's time and the line its remarks gain, or null when it is simply
 * now. Throws KeptBillTooOld past the limit.
 */
export function keptBillTime(soldAt: string | undefined, now: Date): { createdAt: string; remark: string } | null {
  if (!soldAt) return null;
  const sold = new Date(soldAt);
  if (Number.isNaN(sold.getTime())) return null;
  const behind = now.getTime() - sold.getTime();
  // Ahead of the shop, or a moment ago: the shop's own time.
  if (behind <= CLOCK_SLACK_MS) return null;
  if (behind > KEPT_BILL_MAX_HOURS * 60 * 60 * 1000) throw new KeptBillTooOld();
  return { createdAt: sold.toISOString(), remark: `Kept offline · sent ${nepalStamp(now)}` };
}
