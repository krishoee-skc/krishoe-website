"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  deleteVoice,
  publishVoices,
  setVoiceProduct,
  setVoicePublished,
  setVoiceStatus,
  type VoiceStatus,
} from "@/lib/customer-voice";
import { getProducts } from "@/lib/product-store";
import { reportError } from "@/lib/report-error";

const STATUSES: VoiceStatus[] = ["new", "answered", "closed"];

/**
 * Where a published review shows besides its shoe: the home page's "What our
 * customers say" and /reviews (owner, 2026-10-01). Refreshed with every change,
 * so a review appears or goes without waiting for the pages to rebuild.
 */
function refreshReviewPages() {
  revalidatePath("/");
  revalidatePath("/ne");
  revalidatePath("/reviews");
  revalidatePath("/product/[id]", "page");
  revalidatePath("/admin/inbox");
}

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
    if (affected?.productId) revalidatePath(`/product/${affected.productId}`);
  } catch (error) {
    reportError("publish customer review", error);
  }
  refreshReviewPages();
}

/** "Publish these" — the reviews that will show somewhere, at once. */
export async function publishManyAction(formData: FormData) {
  await requireAdminPermission("reviews:write");
  const ids = formData.getAll("id").map((value) => String(value).trim());
  try {
    await publishVoices(ids);
  } catch (error) {
    reportError("publish several reviews", error);
  }
  refreshReviewPages();
}

/** Off the storefront, and out of "to decide": the Owner looked and said no. */
export async function keepHiddenAction(formData: FormData) {
  await requireAdminPermission("reviews:write");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  try {
    await setVoicePublished(id, false);
    await setVoiceStatus(id, "closed", String(formData.get("note") ?? ""));
  } catch (error) {
    reportError("keep a review hidden", error);
  }
  refreshReviewPages();
}

/** A review written for the wrong shoe, moved — or made a review of the shop. */
export async function moveReviewAction(formData: FormData) {
  await requireAdminPermission("reviews:write");
  const id = String(formData.get("id") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!id) return;
  try {
    const product = productId ? (await getProducts({ includeDrafts: true })).find((item) => item.id === productId) : null;
    if (productId && !product) return;
    await setVoiceProduct(id, product?.id ?? "", product?.name ?? "");
  } catch (error) {
    reportError("move a review to another shoe", error);
  }
  refreshReviewPages();
}

// Deleting removes a message for good — kept for spam and cold sales pitches,
// not real customers — so it takes the stricter reviews permission, the same
// one publishing does.
export async function deleteVoiceAction(formData: FormData) {
  await requireAdminPermission("reviews:write");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  // The review card asks with a tick first; the other rows keep their own ask.
  if (String(formData.get("confirmAsked") ?? "") === "1" && String(formData.get("confirm") ?? "") !== "yes") return;

  try {
    await deleteVoice(id);
  } catch (error) {
    reportError("delete customer voice", error);
  }
  refreshReviewPages();
}
