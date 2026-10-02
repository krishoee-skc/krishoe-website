"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { reportError } from "@/lib/report-error";
import { markWorkerPhoto, resolveWorkerRequest } from "@/lib/worker-portal";

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
