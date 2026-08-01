import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { buildAdminBackup } from "@/lib/backup";
import { createStreamingJsonResponse } from "@/lib/streaming-json-response";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdminPermission("backup:export");

  const backup = await buildAdminBackup();
  await recordAdminAuditEvent(
    "backup_export",
    `Admin backup schema v${backup.schemaVersion} exported.`,
  );

  // Database-backed product photos are base64 inside backup v15. A normal
  // buffered JSON response can cross Vercel's Function response limit, so
  // send the exact same JSON incrementally without a Content-Length header.
  return createStreamingJsonResponse(backup, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="krishoe-backup-v${backup.schemaVersion}-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
