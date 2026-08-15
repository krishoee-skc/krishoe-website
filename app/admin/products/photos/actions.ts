"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getProductById, upsertProduct } from "@/lib/product-store";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export type PhotoActionState = { ok: boolean; message: string };

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Saves one photo onto one product, and nothing else.
 *
 * The full product form rebuilds the whole row from its fields, which is right
 * when the owner is editing a product but wrong here — this screen shows ten
 * products at once and knows only which photo changed. Loading the stored row
 * and replacing a single field keeps the price, the sizes and the description
 * exactly as they were.
 */
export async function saveProductPhotoAction(
  _previousState: PhotoActionState | null,
  formData: FormData,
): Promise<PhotoActionState> {
  await requireAdminPermission("products:write");

  const productId = textValue(formData, "productId");
  const image = textValue(formData, "image");
  const slot = textValue(formData, "slot") === "gallery" ? "gallery" : "main";

  if (!productId || !image) {
    return { ok: false, message: "फोटो छानिएन।" };
  }

  const product = await getProductById(productId, { includeDrafts: true });
  if (!product) {
    return { ok: false, message: "सामान भेटिएन।" };
  }

  try {
    await upsertProduct({
      ...product,
      image: slot === "main" ? image : product.image,
      // The main photo leads the gallery, so a new main photo replaces the old
      // one there too rather than leaving the previous shot first in the strip.
      gallery:
        slot === "main"
          ? [image, ...product.gallery.filter((item) => item !== product.image && item !== image)]
          : [...product.gallery.filter((item) => item !== image), image],
    });
  } catch (error) {
    reportError(`save photo for product ${product.sku}`, error);
    return { ok: false, message: saveFailureMessage(error, "फोटो सुरक्षित भएन।") };
  }

  await recordAdminAuditEvent(
    "product_photo_set",
    `Photo set for ${product.sku} (${product.name}) in the ${slot} slot.`,
  );

  // The home and category pages are prerendered and carry these photos, so a
  // hand-picked list would leave the new photo showing on one page and the old
  // one on another.
  revalidatePath("/", "layout");
  revalidatePath("/admin/products/photos");

  return {
    ok: true,
    message: slot === "main" ? `${product.name} — मुख्य फोटो बदलियो ✅` : `${product.name} — थप फोटो जोडियो ✅`,
  };
}
