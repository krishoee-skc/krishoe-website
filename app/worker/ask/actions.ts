"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { reportError } from "@/lib/report-error";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";
import { addWorkerRequest, countOpenRequests, isWorkerOnLeave } from "@/lib/worker-portal";
import { workerTableReady } from "@/lib/worker-portal-db";

export type AskState = { ok: boolean; text: string } | null;

/** No more than this many questions waiting at once — the owner answers, then they can ask again. */
const OPEN_LIMIT = 5;

/**
 * A worker tells the owner the sum is wrong, or asks for an advance (owner,
 * 2026-10-02). It is a message, not a change: the books move only when the
 * owner records a payment or a correction themselves.
 */
export async function askOwnerAction(_previous: AskState, formData: FormData): Promise<AskState> {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated || !access.linked) return { ok: false, text: "पहिले login गर्नुहोस्।" };
  const worker = access.detail.worker;
  if (!(await workerTableReady("factory_worker_requests"))) return { ok: false, text: "यो सुविधा अझै खुलेको छैन — मालिकलाई भन्नुहोस्।" };
  if (await isWorkerOnLeave(worker.id)) return { ok: false, text: "तपाईं बिदामा हुनुहुन्छ — अहिले पठाउन मिल्दैन।" };
  if ((await countOpenRequests(worker.id)) >= OPEN_LIMIT) {
    return { ok: false, text: `मालिकले ${OPEN_LIMIT} वटा कुरा हेर्न बाँकी छ — जवाफ आएपछि फेरि पठाउनुहोस्।` };
  }

  const kind = String(formData.get("kind") ?? "") === "advance" ? "advance" : "hisab";
  const message = String(formData.get("message") ?? "").trim();
  const aboutDate = String(formData.get("aboutDate") ?? "").trim();
  const amountText = String(formData.get("amount") ?? "").replace(/[^\d.]/g, "");
  const amount = amountText ? Math.round(Number(amountText) * 100) / 100 : null;

  if (kind === "advance" && (!amount || amount <= 0 || amount > 1_000_000)) return { ok: false, text: "कति पेस्की चाहिन्छ, रकम लेख्नुहोस्।" };
  if (kind === "hisab" && !message) return { ok: false, text: "के नमिलेको हो, छोटकरीमा लेख्नुहोस्।" };
  if (aboutDate && !/^\d{4}-\d{2}-\d{2}$/.test(aboutDate)) return { ok: false, text: "मिति मिलेन।" };

  try {
    await addWorkerRequest({ workerId: worker.id, staffId: access.staff.id, kind, amount: kind === "advance" ? amount : null, aboutDate, message });
  } catch (error) {
    reportError(`save a request from factory worker ${worker.id}`, error);
    return { ok: false, text: "पठाइएन। फेरि प्रयास गर्नुहोस्।" };
  }
  await recordAdminAuditEvent(
    "factory_worker_request",
    kind === "advance" ? `${worker.name} asked for an advance of Rs. ${amount}.` : `${worker.name} said a sum does not add up.`,
  );
  revalidatePath("/worker/ask");
  revalidatePath("/admin/factory/photos");
  return { ok: true, text: "मालिकलाई पठाइयो ✅ जवाफ यहीँ देखिन्छ।" };
}
