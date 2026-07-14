import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { getNotificationEvents, type OperationalAlertSeverity } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function datedFilename() {
  return `krishoe-notifications-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET() {
  await requireAdminPermission("exports:read");

  const events = await getNotificationEvents(300);

  return csvResponse(
    datedFilename(),
    toCsv(
      [
        "id",
        "createdAt",
        "type",
        "title",
        "deliveryStatus",
        "deliveryAttempts",
        "deliveredAt",
        "lastDeliveryChannel",
        "lastDeliveryError",
        "alertSeverity",
        "alertCategory",
        "alertAction",
        "alertHref",
      ],
      events.map((event) => {
        const alert =
          event.type === "operational-alert"
            ? (event.payload as {
                severity?: OperationalAlertSeverity;
                category?: string;
                action?: string;
                href?: string;
              })
            : null;

        return [
          event.id,
          event.createdAt,
          event.type,
          event.title,
          event.deliveryStatus,
          event.deliveryAttempts,
          event.deliveredAt ?? "",
          event.lastDeliveryChannel,
          event.lastDeliveryError,
          alert?.severity ?? "",
          alert?.category ?? "",
          alert?.action ?? "",
          alert?.href ?? "",
        ];
      }),
    ),
  );
}
