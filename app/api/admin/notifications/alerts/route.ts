import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  createAndDeliverOperationalAlertNotifications,
  createOperationalAlertNotifications,
  getOperationalAlertCenter,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

function noStoreJson(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      ...init?.headers,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function GET() {
  await requireAdminPermission("activity:read");

  return noStoreJson({
    source: "KRISHOE operational alert center",
    checkedAt: new Date().toISOString(),
    alertCenter: await getOperationalAlertCenter(),
  });
}

export async function POST(request: Request) {
  await requireAdminPermission("notifications:write");

  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(50, Number(body.limit) || 10));
  const deliver = Boolean(body.deliver);

  const summary = deliver
    ? await createAndDeliverOperationalAlertNotifications(limit)
    : await createOperationalAlertNotifications(limit);

  await appendAdminAuditEvent(
    "operational_alert_notifications_api",
    deliver
      ? `Operational alert API created ${summary.created} notifications and delivered pending queue.`
      : `Operational alert API created ${summary.created} notifications and skipped ${summary.skippedExisting} existing alerts.`,
    summary.created > 0 ? "success" : undefined,
  ).catch(() => undefined);

  return noStoreJson({
    mode: deliver ? "create-and-deliver" : "create",
    summary,
  });
}
