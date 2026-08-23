import { isBikramMonthStart } from "@/lib/bikram-sambat";
import { sendReviewRequests } from "@/lib/review-requests";
import { getOrderById } from "@/lib/submissions";
import {
  notifyDailySalesSummary,
  notifyPeriodSalesSummary,
  notifyProductionSummary,
} from "@/lib/notifications";
import { pruneOldMonitoringRows } from "@/lib/monitoring";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

// Vercel's cron hits this once every evening (see vercel.json) and the owner
// gets the day's numbers by email. The same run also carries the wider digests:
// on a Sunday the week just finished, and on the first of the month the month
// just closed. Folding all three into one daily cron keeps the shop on a single
// scheduled job — well inside the free plan's cron limit — instead of three.
// If CRON_SECRET is set, only requests carrying it are accepted, so nobody else
// can make the shop spam itself.
/**
 * The pairs on an order, for the review request.
 *
 * Passed in rather than imported inside lib/review-requests so that module has
 * one job — deciding who to ask and stamping that they were asked — and can be
 * read without the order store coming with it.
 */
async function orderItemsFor(orderId: string) {
  const order = await getOrderById(orderId);
  return (order?.items ?? []).map((item) => ({
    productId: item.productId,
    name: item.productName,
    quantity: item.quantity,
  }));
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return new Response("Cron is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
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
    { name: "daily-production", run: () => notifyProductionSummary("daily") },
    // Asking buyers what they thought, a week after their order closed. Carried
    // by the daily cron rather than a schedule of its own: the shop is on a
    // hosting plan with a small cron allowance, and a job that only has work on
    // some days does not need a slot reserved for the days it does not.
    {
      name: "review-requests",
      // The loop reports each job by delivery status. This one delivers many
      // small things rather than one digest, and reports its own failures as it
      // goes, so a completed run is "sent" however many it found to ask —
      // including none, which is the ordinary case on a day with no closed
      // orders a week old.
      run: async () => {
        await sendReviewRequests(orderItemsFor);
        return { deliveryStatus: "sent" as const };
      },
    },
    ...(isSunday
      ? [
          { name: "weekly", run: () => notifyPeriodSalesSummary("weekly" as const) },
          { name: "weekly-production", run: () => notifyProductionSummary("weekly" as const) },
        ]
      : []),
    ...(isMonthStart
      ? [
          { name: "monthly", run: () => notifyPeriodSalesSummary("monthly" as const) },
          { name: "monthly-production", run: () => notifyProductionSummary("monthly" as const) },
        ]
      : []),
  ];
  // Housekeeping, not a job: it has nothing to deliver and nothing to report,
  // so a failure here must not colour the summaries' result.
  await pruneOldMonitoringRows();

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
