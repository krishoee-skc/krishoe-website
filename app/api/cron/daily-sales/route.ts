import { notifyDailySalesSummary } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

// Vercel's cron hits this once every evening (see vercel.json) and the owner
// gets the day's numbers by email. If CRON_SECRET is set, only requests
// carrying it are accepted, so nobody else can make the shop spam itself.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }

  try {
    const event = await notifyDailySalesSummary();
    return Response.json({ ok: true, id: event.id, status: event.deliveryStatus });
  } catch (error) {
    reportError("send the daily sales summary", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
