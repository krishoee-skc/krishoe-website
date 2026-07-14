import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { buildAdminBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdminPermission("backup:export");

  const backup = await buildAdminBackup();
  await appendAdminAuditEvent(
    "backup_export",
    `Admin backup schema v${backup.schemaVersion} exported.`,
  ).catch(() => undefined);

  return Response.json(backup, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="krishoe-backup-v${backup.schemaVersion}-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
