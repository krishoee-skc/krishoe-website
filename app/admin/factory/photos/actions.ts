"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { reportError } from "@/lib/report-error";
import { getWorkerPhoto, linkWorkerPhotoToWork, markWorkerPhoto, resolveWorkerRequest } from "@/lib/worker-portal";
import { createFactoryWork, FactoryMutationError } from "@/lib/factory-mutations";
import { photoDraftReady } from "@/lib/worker-portal-db";

/** The Nepal day a photo was sent — the day the work is booked to. */
function nepalDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export type DraftReply = InboxReply & { amount?: number };

/**
 * ✓ on a worker's photo (owner, 2026-10-02, "ख"): the photo's draft — the
 * worker, the shoe, the pairs — goes on the books exactly as Add work would
 * put it, at the worker's own stage and its rate, on the day the photo was
 * sent. The owner may correct the shoe or the pairs first. Keyed to the photo,
 * so a second press, or two people pressing at once, books it once.
 */
export async function bookPhotoWorkAction(photoId: string, itemId: string, pairs: number): Promise<DraftReply> {
  const actor = await requireAdminPermission("production:entry");
  if (!(await photoDraftReady())) {
    return { ok: false, en: "Switch this on in Settings first (Worker app → OK).", ne: "पहिले Settings मा कामदारको app को OK थिच्नुहोस्।" };
  }
  const photo = await getWorkerPhoto(photoId);
  if (!photo) return { ok: false, en: "That photo was not found.", ne: "त्यो फोटो भेटिएन।" };
  if (photo.status === "added") return { ok: false, en: "Already on the books.", ne: "यो पहिले नै हिसाबमा छ।" };
  if (photo.kind === "problem") return { ok: false, en: "A problem photo is not work to pay for.", ne: "समस्याको फोटो तलबको काम होइन।" };
  if (photo.workerType !== "piece_rate") {
    return { ok: false, en: "Only piece-rate work is booked by the pair.", ne: "जोडी अनुसार ज्याला पाउनेको मात्र यसरी लेखिन्छ।" };
  }
  const item = itemId || photo.itemId;
  const count = Math.round(Number(pairs));
  if (!item) return { ok: false, en: "Choose the shoe.", ne: "जुत्ता छान्नुहोस्।" };
  if (!Number.isFinite(count) || count <= 0 || count > 10000) return { ok: false, en: "Enter the pairs.", ne: "जोडी लेख्नुहोस्।" };

  let entry: Awaited<ReturnType<typeof createFactoryWork>>;
  try {
    entry = await createFactoryWork({
      submissionKey: `worker-photo:${photo.id}`,
      date: nepalDay(photo.createdAt),
      workerId: photo.workerId,
      itemId: item,
      color: null,
      size: null,
      pairsCount: count,
      rejectPairs: 0,
      status: "completed",
      stage: null,
      sizeCounts: null,
    });
    await linkWorkerPhotoToWork(photo.id, entry.id, actor.session.email ?? actor.session.staffId ?? "");
  } catch (error) {
    if (error instanceof FactoryMutationError) {
      return { ok: false, en: `Not booked: ${error.message}`, ne: `हिसाबमा थपिएन: ${error.message}` };
    }
    reportError(`book work from worker photo ${photoId}`, error);
    return { ok: false, en: "Not booked. Try again.", ne: "हिसाबमा थपिएन। फेरि प्रयास गर्नुहोस्।" };
  }

  await recordAdminAuditEvent(
    "factory_work_from_photo",
    `${photo.workerName}: ${count} pairs booked from their photo (Rs. ${entry.amount_earned}).`,
  );
  revalidatePath("/admin/factory/photos");
  revalidatePath("/admin/factory/add-work");
  return { ok: true, en: `${photo.workerName}: ${count} pairs on the books — Rs. ${entry.amount_earned}`, ne: `${photo.workerName}: ${count} जोडी हिसाबमा — Rs. ${entry.amount_earned}`, amount: entry.amount_earned };
}

export type InboxReply = { ok: boolean; en: string; ne: string };

/** A worker's photo: seen, or put on the books (the entry itself is made on Add work). */
export async function markWorkerPhotoAction(id: string, status: "seen" | "added"): Promise<InboxReply> {
  const actor = await requireAdminPermission("production:entry");
  try {
    await markWorkerPhoto(id, status, actor.session.email ?? actor.session.staffId ?? "");
  } catch (error) {
    reportError(`mark worker photo ${id}`, error);
    return { ok: false, en: "Not saved. Try again.", ne: "सुरक्षित भएन। फेरि प्रयास गर्नुहोस्।" };
  }
  revalidatePath("/admin/factory/photos");
  revalidatePath("/admin/factory/workers");
  if (status === "added") return { ok: true, en: "Marked as added to the books.", ne: "हिसाबमा थपियो भनेर चिनो लाग्यो।" };
  return { ok: true, en: "Marked as seen.", ne: "देखेँ भनेर चिनो लाग्यो।" };
}

/**
 * Answer a worker: "the sum is wrong" or an advance. The answer is a message
 * back — a payment or a correction is recorded on the ledger as always.
 */
export async function answerWorkerRequestAction(id: string, status: "done" | "declined", reply: string): Promise<InboxReply> {
  const actor = await requireAdminPermission("wages:write");
  try {
    await resolveWorkerRequest(id, status, reply.trim(), actor.session.email ?? actor.session.staffId ?? "");
  } catch (error) {
    reportError(`answer worker request ${id}`, error);
    return { ok: false, en: "Not saved. Try again.", ne: "सुरक्षित भएन। फेरि प्रयास गर्नुहोस्।" };
  }
  await recordAdminAuditEvent("factory_worker_request_answered", `A worker request was ${status === "done" ? "answered" : "declined"}.`);
  revalidatePath("/admin/factory/photos");
  revalidatePath("/admin/factory/workers");
  return { ok: true, en: "The worker will see your answer.", ne: "कामदारले तपाईंको जवाफ देख्नेछ।" };
}
