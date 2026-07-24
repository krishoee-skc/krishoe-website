import { isBikramMonthStart } from "@/lib/bikram-sambat";
import {
  notifyDailySalesSummary,
  notifyPeriodSalesSummary,
} from "@/lib/notifications";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

// Vercel's cron hits this once every evening (see vercel.json) and the owner
// gets the day's numbers by email. The same run also carries the wider digests:
// on a Sunday the week just finished, and on the first of the month the month
// just closed. Folding all three into one daily cron keeps the shop on a single
// scheduled job — well inside the free plan's cron limit — instead of three.
// If CRON_SECRET is set, only requests carrying it are accepted, so nobody else
// can make the shop spam itself.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }

  // The cron fires at 20:00 NPT, still the same calendar day in UTC (14:15), so
  // the UTC weekday is the Nepali one the owner would read off a calendar. The
  // monthly digest turns over on the Bikram Sambat month, not the English one —
  // a Nepali shop closes its books on gate 1 of Shrawan, Bhadra, and so on.
  const now = new Date();
  const isSunday = now.getUTCDay() === 0;
  const isMonthStart = isBikramMonthStart(now);

  const sent: Record<string, string> = {};

  try {
    const daily = await notifyDailySalesSummary();
    sent.daily = daily.deliveryStatus;
  } catch (error) {
    reportError("send the daily sales summary", error);
    return Response.json({ ok: false, stage: "daily" }, { status: 500 });
  }

  // The wider digests must not fail the daily one behind them, nor each other —
  // each is reported on its own and a miss is logged, not thrown.
  if (isSunday) {
    try {
      const weekly = await notifyPeriodSalesSummary("weekly");
      sent.weekly = weekly.deliveryStatus;
    } catch (error) {
      reportError("send the weekly sales summary", error);
    }
  }

  if (isMonthStart) {
    try {
      const monthly = await notifyPeriodSalesSummary("monthly");
      sent.monthly = monthly.deliveryStatus;
    } catch (error) {
      reportError("send the monthly sales summary", error);
    }
  }

  return Response.json({ ok: true, sent });
}
