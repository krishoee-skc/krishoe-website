import { GET as runDailySales } from "@/app/api/cron/daily-sales/route";

export const dynamic = "force-dynamic";

// A second daily invocation protects the owner's evening report from a missed
// or delayed primary cron. notifyDailySalesSummary is idempotent, so this route
// retries a failure but never sends a second copy after success.
export async function GET(request: Request) {
  return runDailySales(request);
}
