"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { queryPostgres } from "@/lib/postgres/client";
import { reportError } from "@/lib/report-error";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";
import { photoLine, tellOwnerWorkerSent } from "@/lib/worker-inbox-alert";
import { addWorkerWrittenWork, countWrittenToday, isWorkerOnLeave, WRITTEN_PER_DAY } from "@/lib/worker-portal";
import { workerWritesReady } from "@/lib/worker-portal-db";

export type WriteReply = { ok: boolean; ne: string };

/** The Nepal day, today or a number of days back, as YYYY-MM-DD. */
function nepalDay(daysBack = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() - daysBack * 86_400_000),
  );
}

/**
 * A worker writes the day's work (owner, 2026-10-13, "क"). Their own sign-in,
 * for their own record only; it waits for the owner's ✓ and pays nothing until
 * then. Today or yesterday only — older work is the owner's to enter.
 */
export async function writeWorkAction(input: { itemId: string; color: string; size: string; pairs: number; day: "today" | "yesterday"; note: string }): Promise<WriteReply> {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) return { ok: false, ne: "पहिले login गर्नुहोस्।" };
  if (!access.linked) return { ok: false, ne: "तपाईंको खाता बन्द छ।" };
  const worker = access.detail.worker;

  if (!(await workerWritesReady())) return { ok: false, ne: "काम लेख्ने सुविधा अझै खुलेको छैन — मालिकलाई भन्नुहोस्।" };
  if (worker.workerType !== "piece_rate") return { ok: false, ne: "जोडी अनुसार ज्याला पाउनेले मात्र यहाँ काम लेख्छन्।" };
  if (await isWorkerOnLeave(worker.id)) return { ok: false, ne: "तपाईं बिदामा हुनुहुन्छ — अहिले लेख्न मिल्दैन।" };
  if ((await countWrittenToday(worker.id)) >= WRITTEN_PER_DAY) return { ok: false, ne: `एक दिनमा ${WRITTEN_PER_DAY} पटक मात्र — बाँकी भोलि लेख्नुहोस्।` };

  const itemId = String(input.itemId ?? "").trim();
  const color = String(input.color ?? "").trim().slice(0, 40);
  const size = String(input.size ?? "").trim().slice(0, 80);
  const pairs = Math.round(Number(input.pairs));
  const note = String(input.note ?? "").trim().slice(0, 300);
  if (!itemId) return { ok: false, ne: "जुत्ता छान्नुहोस्।" };
  if (!color) return { ok: false, ne: "रङ छान्नुहोस्।" };
  if (!size) return { ok: false, ne: "साइज छान्नुहोस्।" };
  if (!Number.isFinite(pairs) || pairs <= 0 || pairs > 10000) return { ok: false, ne: "कति जोडी, लेख्नुहोस्।" };

  // The shoe must be one the factory makes — it decides the rate the ✓ pays.
  const found = await queryPostgres<{ name: string }>("worker portal", "SELECT name FROM factory_items WHERE id = $1 AND status = 'active'", [itemId]).catch(() => []);
  if (!found[0]) return { ok: false, ne: "जुत्ता फेरि छान्नुहोस्।" };

  try {
    await addWorkerWrittenWork({
      workerId: worker.id,
      staffId: access.staff.id,
      itemId,
      color,
      size,
      pairs,
      workDate: nepalDay(input.day === "yesterday" ? 1 : 0),
      note,
    });
  } catch (error) {
    reportError(`store written work from factory worker ${worker.id}`, error);
    return { ok: false, ne: "पठाइएन। फेरि प्रयास गर्नुहोस्।" };
  }

  await recordAdminAuditEvent("factory_worker_wrote_work", `${worker.name} wrote ${pairs} pairs of ${found[0].name} (${color}, ${size}) for the owner's check.`);
  await tellOwnerWorkerSent("photo", worker.name, photoLine("✍️", `${found[0].name} · ${color}`, pairs));
  revalidatePath("/worker/write");
  revalidatePath("/worker/production");
  return { ok: true, ne: `मालिकलाई पठाइयो ✅ ${pairs} जोडी ${found[0].name} — मालिकले ✓ गरेपछि हिसाबमा जान्छ।` };
}
