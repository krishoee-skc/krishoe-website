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

  const jobs = [
    { name: "daily", run: () => notifyDailySalesSummary() },
    ...(isSunday
      ? [{ name: "weekly", run: () => notifyPeriodSalesSummary("weekly" as const) }]
      : []),
    ...(isMonthStart
      ? [{ name: "monthly", run: () => notifyPeriodSalesSummary("monthly" as const) }]
      : []),
  ];
  const settled = await Promise.allSettled(jobs.map((job) => job.run()));
  const sent: Record<string, string> = {};
  const failed: string[] = [];

  settled.forEach((result, index) => {
    const name = jobs[index].name;
    if (result.status === "fulfilled") {
      sent[name] = result.value.deliveryStatus;
      if (result.value.deliveryStatus !== "sent") failed.push(name);
      return;
    }

    failed.push(name);
    reportError(`send the ${name} sales summary`, result.reason);
  });

  return Response.json(
    { ok: failed.length === 0, scheduled: jobs.map((job) => job.name), sent, failed },
    { status: failed.length === 0 ? 200 : 503 },
  );
}
