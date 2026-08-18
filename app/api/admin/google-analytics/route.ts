import { fetchAnalyticsSnapshot } from "@/lib/google-analytics";
import { requireAdminPermission } from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";

function requestedDays(value: string | null) {
  const days = Number(value);
  return Number.isInteger(days) && [7, 28, 90].includes(days) ? days : 28;
}

export async function GET(request: Request) {
  await requireAdminPermission("insights:read");

  const days = requestedDays(new URL(request.url).searchParams.get("days"));
  const result = await fetchAnalyticsSnapshot(days);

  return Response.json(result, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
