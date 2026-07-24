import { notifyPeriodSalesSummary } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

// Vercel's cron hits this every Sunday morning (see vercel.json) and the owner
// gets the week's numbers by email — the seven days just finished, set beside
// the seven before them. If CRON_SECRET is set, only requests carrying it are
// accepted, so nobody else can make the shop spam itself.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }

  try {
    const event = await notifyPeriodSalesSummary("weekly");
    return Response.json({ ok: true, id: event.id, status: event.deliveryStatus });
  } catch (error) {
    reportError("send the weekly sales summary", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
