"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { reportError } from "@/lib/report-error";
import { del } from "@vercel/blob";
import { deleteWorkerPhotoRow, getWorkerPhoto, linkWorkerPhotoToWork, markWorkerPhoto, resolveWorkerRequest, reviewWorkerPhoto, setPhotoRobotOn } from "@/lib/worker-portal";
import { robotLookAtPhoto } from "@/lib/worker-photo-robot";
import { isAiConfigured } from "@/lib/ai/gemini";
import { photoRobotReady } from "@/lib/worker-portal-db";
import { createFactoryWork, deleteFactoryWork, FactoryMutationError } from "@/lib/factory-mutations";
import { FACTORY_WORKER_CATEGORIES } from "@/lib/factory-worker-options";
import { photoDraftReady, photoReviewReady } from "@/lib/worker-portal-db";

const byOf = (actor: Awaited<ReturnType<typeof requireAdminPermission>>) => actor.session.email ?? actor.session.staffId ?? "";

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
/** Colour and size too (owner, 2026-10-03): the books refuse work without them. */
export type BookInput = { itemId: string; pairs: number; color?: string; size?: string; stage?: string; workDate?: string; rejectPairs?: number; reply?: string };

export async function bookPhotoWorkAction(photoId: string, input: BookInput): Promise<DraftReply> {
  const { itemId, pairs } = input;
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
  const color = String(input.color ?? "").trim().slice(0, 40);
  const size = String(input.size ?? "").trim().slice(0, 80);
  if (!color) return { ok: false, en: "Choose the colour.", ne: "रङ छान्नुहोस्।" };
  if (!size) return { ok: false, en: "Choose the size.", ne: "साइज छान्नुहोस्।" };
  // The stage the work was done at (owner, 2026-10-03): the worker's own unless
  // the owner picks another; the day it was done; damaged pairs among them.
  const stage = input.stage && (FACTORY_WORKER_CATEGORIES as readonly string[]).includes(input.stage) && input.stage !== "Staff" ? input.stage : null;
  const workDate = input.workDate && /^\d{4}-\d{2}-\d{2}$/.test(input.workDate) ? input.workDate : nepalDay(photo.createdAt);
  const rejects = Math.max(0, Math.min(count, Math.round(Number(input.rejectPairs) || 0)));
  if (workDate > nepalDay(new Date().toISOString())) return { ok: false, en: "The day cannot be after today.", ne: "दिन आजभन्दा पछिको हुन सक्दैन।" };

  let entry: Awaited<ReturnType<typeof createFactoryWork>>;
  try {
    entry = await createFactoryWork({
      submissionKey: `worker-photo:${photo.id}`,
      date: workDate,
      workerId: photo.workerId,
      itemId: item,
      color,
      size,
      pairsCount: count,
      rejectPairs: rejects,
      status: "completed",
      stage,
      sizeCounts: null,
    });
    if (await photoReviewReady()) {
      await reviewWorkerPhoto(
        photo.id,
        { status: "added", workId: entry.id, verdict: "", itemId: item, pairs: count, stage: stage ?? "", workDate, rejectPairs: rejects, reply: input.reply ?? photo.reply },
        { by: byOf(actor), what: `On the books: ${count} pairs, ${color}, ${size}${rejects ? ` (${rejects} damaged)` : ""}${stage ? ` at ${stage}` : ""}, ${workDate} — Rs. ${entry.amount_earned}` },
      );
    } else {
      await linkWorkerPhotoToWork(photo.id, entry.id, byOf(actor));
    }
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

const NOT_READY: InboxReply = { ok: false, en: "Switch this on in Settings first (Worker app → OK).", ne: "पहिले Settings मा कामदारको app को OK थिच्नुहोस्।" };

/** Not work to pay for — with the reason the worker will read (owner, 2026-10-03). */
export async function notWorkPhotoAction(photoId: string, reason: string, message: string): Promise<InboxReply> {
  const actor = await requireAdminPermission("production:entry");
  if (!(await photoReviewReady())) return NOT_READY;
  const photo = await getWorkerPhoto(photoId);
  if (!photo) return { ok: false, en: "That photo was not found.", ne: "त्यो फोटो भेटिएन।" };
  if (photo.status === "added") return { ok: false, en: "It is on the books — take it back first.", ne: "यो हिसाबमा छ — पहिले फिर्ता गर्नुहोस्।" };
  const reply = [reason.trim(), message.trim()].filter(Boolean).join(" — ");
  try {
    await reviewWorkerPhoto(photo.id, { verdict: "not_work", status: "seen", reply }, { by: byOf(actor), what: `Not work: ${reply || "no reason given"}` });
  } catch (error) {
    reportError(`mark worker photo ${photoId} as not work`, error);
    return { ok: false, en: "Not saved. Try again.", ne: "सुरक्षित भएन। फेरि प्रयास गर्नुहोस्।" };
  }
  revalidatePath("/admin/factory/photos");
  return { ok: true, en: `Marked not work — ${photo.workerName} will see why.`, ne: `काम होइन भनियो — ${photo.workerName} ले कारण देख्नेछ।` };
}

/**
 * Back off the books: the work entry the photo became is removed the way the
 * Add work list removes one — with the reason in the audit, and never from a
 * month already closed and paid. The photo goes back to "to check".
 */
export async function takeBackPhotoWorkAction(photoId: string): Promise<InboxReply> {
  const actor = await requireAdminPermission("wages:write");
  if (!(await photoReviewReady())) return NOT_READY;
  const photo = await getWorkerPhoto(photoId);
  if (!photo || photo.status !== "added" || !photo.workId) return { ok: false, en: "This photo is not on the books.", ne: "यो फोटो हिसाबमा छैन।" };
  try {
    await deleteFactoryWork({ workId: photo.workId, reason: `Taken back from ${photo.workerName}'s work photo ${photo.id}`, deletedBy: byOf(actor) });
    await reviewWorkerPhoto(photo.id, { status: "seen", workId: null }, { by: byOf(actor), what: "Taken back off the books" });
  } catch (error) {
    if (error instanceof FactoryMutationError) return { ok: false, en: `Not taken back: ${error.message}`, ne: `फिर्ता भएन: ${error.message}` };
    reportError(`take back work from worker photo ${photoId}`, error);
    return { ok: false, en: "Not taken back. Try again.", ne: "फिर्ता भएन। फेरि प्रयास गर्नुहोस्।" };
  }
  await recordAdminAuditEvent("factory_work_photo_taken_back", `${photo.workerName}: work from their photo ${photo.id} taken back off the books.`, "warning");
  revalidatePath("/admin/factory/photos");
  revalidatePath("/admin/factory/add-work");
  return { ok: true, en: "Taken back off the books.", ne: "हिसाबबाट फिर्ता भयो।" };
}

/** Out of the list, kept — for a photo on the books or a problem photo, which are proof. */
export async function hidePhotoAction(photoId: string, hidden: boolean): Promise<InboxReply> {
  const actor = await requireAdminPermission("production:entry");
  if (!(await photoReviewReady())) return NOT_READY;
  try {
    await reviewWorkerPhoto(photoId, { hidden }, { by: byOf(actor), what: hidden ? "Hidden from the list" : "Shown in the list again" });
  } catch (error) {
    reportError(`hide worker photo ${photoId}`, error);
    return { ok: false, en: "Not saved. Try again.", ne: "सुरक्षित भएन। फेरि प्रयास गर्नुहोस्।" };
  }
  revalidatePath("/admin/factory/photos");
  return hidden ? { ok: true, en: "Hidden — still kept.", ne: "लुकाइयो — राखिएको छ।" } : { ok: true, en: "Shown again.", ne: "फेरि देखाइयो।" };
}

/**
 * Gone for good: the photo and its file. Owner only, and never a photo on the
 * books or a problem photo — those are a worker's proof, and are hidden instead.
 */
export async function deletePhotoAction(photoId: string): Promise<InboxReply> {
  await requireAdminPermission("wages:write");
  const photo = await getWorkerPhoto(photoId);
  if (!photo) return { ok: false, en: "That photo was not found.", ne: "त्यो फोटो भेटिएन।" };
  if (photo.status === "added") return { ok: false, en: "It is on the books — take it back first, or hide it.", ne: "यो हिसाबमा छ — पहिले फिर्ता गर्नुहोस्, वा लुकाउनुहोस्।" };
  if (photo.kind === "problem") return { ok: false, en: "A problem photo is proof — hide it instead.", ne: "समस्याको फोटो प्रमाण हो — लुकाउनुहोस्।" };
  let url: string | null = null;
  try {
    url = await deleteWorkerPhotoRow(photo.id);
    if (url && /\.blob\.vercel-storage\.com\//.test(url)) await del(url).catch((error) => reportError(`remove the file of worker photo ${photoId}`, error));
  } catch (error) {
    reportError(`delete worker photo ${photoId}`, error);
    return { ok: false, en: "Not deleted. Try again.", ne: "मेटिएन। फेरि प्रयास गर्नुहोस्।" };
  }
  await recordAdminAuditEvent("factory_worker_photo_deleted", `A work photo from ${photo.workerName} (${photo.kind}, sent ${photo.createdAt}) was deleted.`, "warning");
  revalidatePath("/admin/factory/photos");
  return { ok: true, en: "Deleted.", ne: "मेटियो।" };
}

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

/** Ask the robot again, or for the first time, about one photo (owner, 2026-10-03). */
export async function robotPhotoAction(photoId: string): Promise<InboxReply> {
  await requireAdminPermission("production:entry");
  if (!(await photoRobotReady())) return NOT_READY;
  if (!isAiConfigured()) return { ok: false, en: "The robot is not connected (no Gemini key).", ne: "रोबोट जोडिएको छैन (Gemini key छैन)।" };
  const guess = await robotLookAtPhoto(photoId, { force: true });
  revalidatePath("/admin/factory/photos");
  if (!guess) return { ok: false, en: "The robot is switched off, or could not look.", ne: "रोबोट बन्द छ, वा हेर्न सकेन।" };
  if (guess.missing === "limit") return { ok: false, en: "Today's free robot limit is used up — try tomorrow.", ne: "आजको निःशुल्क सीमा सकियो — भोलि फेरि।" };
  if (guess.missing) return { ok: false, en: "The robot could not tell. Fill it in yourself.", ne: "रोबोटले चिन्न सकेन। आफैँ भर्नुहोस्।" };
  return { ok: true, en: "The robot has looked 🤖", ne: "रोबोटले हेर्‍यो 🤖" };
}

/** The Settings switch: the robot looks at new photos, or not. Owner and Admin. */
export async function setPhotoRobotAction(on: boolean): Promise<InboxReply> {
  const actor = await requireAdminPermission("wages:write");
  if (!(await photoRobotReady())) return NOT_READY;
  await setPhotoRobotOn(on);
  await recordAdminAuditEvent("factory_photo_robot", `${byOf(actor)} turned the photo robot ${on ? "on" : "off"}.`);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/factory/photos");
  return on ? { ok: true, en: "The robot is on.", ne: "रोबोट खुल्यो।" } : { ok: true, en: "The robot is off.", ne: "रोबोट बन्द भयो।" };
}
