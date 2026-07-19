"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  deleteProductReview,
  updateProductReviewStatus,
} from "@/lib/product-store";
import type { Review } from "@/lib/products";

const reviewStatuses: Review["status"][] = ["pending", "approved", "rejected"];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function statusValue(value: string): Review["status"] {
  return reviewStatuses.includes(value as Review["status"])
    ? (value as Review["status"])
    : "pending";
}

function revalidateReviewPaths(productId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin/products");
  revalidatePath(`/product/${productId}`);
}

export async function updateReviewStatusAction(formData: FormData) {
  await requireAdminPermission("reviews:write");

  const productId = textValue(formData, "productId");
  const reviewId = textValue(formData, "reviewId");
  const status = statusValue(textValue(formData, "status"));

  if (!productId || !reviewId) {
    throw new Error("Product id and review id are required.");
  }

  const { product, review } = await updateProductReviewStatus(productId, reviewId, status);
  await recordAdminAuditEvent(
    "review_status_update",
    `Review ${review.id} for ${product.name} marked ${status}.`,
  );
  revalidateReviewPaths(productId);
}

export async function deleteReviewAction(formData: FormData) {
  await requireAdminPermission("reviews:write");

  const productId = textValue(formData, "productId");
  const reviewId = textValue(formData, "reviewId");

  if (!productId || !reviewId) {
    throw new Error("Product id and review id are required.");
  }

  const { product, review } = await deleteProductReview(productId, reviewId);
  await recordAdminAuditEvent(
    "review_delete",
    `Review ${review.id} for ${product.name} deleted.`,
    "warning",
  );
  revalidateReviewPaths(productId);
}
