import { notifyPeriodSalesSummary } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

// Vercel's cron hits this on the first of every month (see vercel.json) and the
// owner gets the previous month's numbers by email — the whole closed month, set
// beside the month before it. If CRON_SECRET is set, only requests carrying it
// are accepted, so nobody else can make the shop spam itself.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }

  try {
    const event = await notifyPeriodSalesSummary("monthly");
    return Response.json({ ok: true, id: event.id, status: event.deliveryStatus });
  } catch (error) {
    reportError("send the monthly sales summary", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
