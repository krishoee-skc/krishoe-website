import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  recordAdminAuditEvent,
  filterAdminAuditEvents,
  getAdminAuditEvents,
  hasAdminAuditFilters,
  normalizeAdminAuditFilters,
} from "@/lib/admin-audit";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

function datedFilename(filtered: boolean) {
  return `krishoe-admin-activity${filtered ? "-filtered" : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  await requireAdminPermission("exports:read");

  const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = normalizeAdminAuditFilters(searchParams);
  const filtered = hasAdminAuditFilters(filters);
  const events = filterAdminAuditEvents(await getAdminAuditEvents(500), filters);
  await recordAdminAuditEvent(
    "activity_export",
    `${events.length} admin activity rows exported as CSV${filtered ? " with filters" : ""}.`,
  );

  return csvResponse(
    datedFilename(filtered),
    toCsv(
      [
        "id",
        "createdAt",
        "action",
        "detail",
        "status",
        "actorId",
        "actorName",
        "actorEmail",
        "actorRole",
        "actorBranchId",
      ],
      events.map((event) => [
        event.id,
        event.createdAt,
        event.action,
        event.detail,
        event.status,
        event.actorId,
        event.actorName,
        event.actorEmail,
        event.actorRole,
        event.actorBranchId,
      ]),
    ),
  );
}
