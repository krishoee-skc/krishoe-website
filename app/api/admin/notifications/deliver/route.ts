import { requireAdminPermission } from "@/lib/admin-permissions";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { deliverPendingNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireAdminPermission("notifications:write");

  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(50, Number(body.limit) || 20));
  const summary = await deliverPendingNotifications(limit);

  await recordAdminAuditEvent(
    "notifications_delivery_api",
    `Notification API delivery attempted ${summary.attempted}, sent ${summary.sent}, failed ${summary.failed}, skipped ${summary.skipped}.`,
    summary.failed > 0 ? "warning" : "success",
  );

  return Response.json(summary, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
