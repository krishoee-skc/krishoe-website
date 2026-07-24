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

  // Evaluated in Nepal time: the cron fires at 20:00 NPT, which is still the
  // same calendar day in UTC (14:15), so the UTC day-of-week and day-of-month
  // are the Nepali ones the owner would read off a calendar.
  const now = new Date();
  const isSunday = now.getUTCDay() === 0;
  const isFirstOfMonth = now.getUTCDate() === 1;

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

  if (isFirstOfMonth) {
    try {
      const monthly = await notifyPeriodSalesSummary("monthly");
      sent.monthly = monthly.deliveryStatus;
    } catch (error) {
      reportError("send the monthly sales summary", error);
    }
  }

  return Response.json({ ok: true, sent });
}
