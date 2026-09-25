import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { backupKey, listStoredBackups, openBackup } from "@/lib/scheduled-backup";

export const dynamic = "force-dynamic";

/**
 * One stored weekly backup, unlocked, as the same JSON file "Export backup"
 * gives. Owner only. The name must be one of the stored backups — the route
 * never fetches an address it was handed.
 */
export async function GET(request: Request) {
  await requireAdminPermission("backup:export");

  const name = new URL(request.url).searchParams.get("name") ?? "";
  const key = backupKey();
  if (!key) return new Response("Backups are not set up.", { status: 503 });

  const stored = (await listStoredBackups()).find((backup) => backup.pathname === name);
  if (!stored) return new Response("That backup was not found.", { status: 404 });

  const sealed = await fetch(stored.url, { cache: "no-store" });
  if (!sealed.ok) return new Response("The backup could not be read.", { status: 502 });

  let json: Buffer;
  try {
    json = Buffer.from(openBackup(Buffer.from(await sealed.arrayBuffer()), key), "utf8");
  } catch {
    return new Response("The backup could not be unlocked.", { status: 500 });
  }

  await recordAdminAuditEvent("backup_stored_download", `Weekly backup ${stored.pathname} downloaded.`);

  // Streamed in pieces: a buffered response over a few megabytes is refused
  // by the hosting's function limit.
  const chunk = 256 * 1024;
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= json.length) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(json.subarray(offset, offset + chunk)));
      offset += chunk;
    },
  });
  const day = stored.uploadedAt.slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="krishoe-weekly-backup-${day}.json"`,
    },
  });
}
