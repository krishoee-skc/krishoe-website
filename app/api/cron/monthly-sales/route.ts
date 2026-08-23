import { notifyPeriodSalesSummary } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

// Sending the closed month's numbers by hand, set beside the month before it.
//
// Nothing schedules this route, and the pointer that used to stand here sent a
// reader looking through vercel.json for an entry that is not in it — the shop
// does not close its books on the English month. The daily cron carries the
// monthly report instead, firing it when isBikramMonthStart says a Bikram
// Sambat month has turned over, which is the first of Baishakh or Jestha as the
// shop counts them. A 1st-of-the-month entry in vercel.json would land in the
// middle of a Nepali month and report a period nobody here keeps books by.
//
// This stays as the way to send one on demand — a missed month, or a report the
// owner wants again. Guarded by CRON_SECRET like the rest, so nobody else can
// make the shop spam itself.
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

  try {
    const event = await notifyPeriodSalesSummary("monthly");
    return Response.json({ ok: true, id: event.id, status: event.deliveryStatus });
  } catch (error) {
    reportError("send the monthly sales summary", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
