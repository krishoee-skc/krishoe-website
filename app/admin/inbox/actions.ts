"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { setVoicePublished, setVoiceStatus, type VoiceStatus } from "@/lib/customer-voice";
import { reportError } from "@/lib/report-error";

const STATUSES: VoiceStatus[] = ["new", "answered", "closed"];

/**
 * Marking a message answered, or putting a review on the storefront.
 *
 * Both are one-tap from the row on purpose: a reply that takes four screens to
 * record is a reply nobody records, and an inbox whose statuses are stale is
 * worse than no inbox at all — it says "nothing is waiting" when something is.
 */
export async function setStatusAction(formData: FormData) {
  await requireAdminPermission("feedback:write");

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as VoiceStatus;
  if (!id || !STATUSES.includes(status)) return;

  try {
    await setVoiceStatus(id, status, String(formData.get("note") ?? ""));
  } catch (error) {
    reportError("update customer voice status", error);
  }
  revalidatePath("/admin/inbox");
}

// Publishing puts a customer's words on a public page, which is a larger act
// than filing a message — so it takes the reviews permission, not the inbox one.
export async function setPublishedAction(formData: FormData) {
  await requireAdminPermission("reviews:write");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  try {
    const affected = await setVoicePublished(
      id,
      String(formData.get("published") ?? "") === "true",
    );
    // Refresh the product page so a just-published review shows (and a hidden
    // one disappears) without waiting for the page to rebuild on its own.
    if (affected?.productId) {
      revalidatePath(`/product/${affected.productId}`);
    }
  } catch (error) {
    reportError("publish customer review", error);
  }
  revalidatePath("/admin/inbox");
}
