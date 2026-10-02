"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getProductById, upsertProduct } from "@/lib/product-store";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

/**
 * The outcome, in both languages.
 *
 * A Server Action cannot read the reader's chosen language — that lives in a
 * client context — so it cannot pick one. It returns the pair, and PhotoCard
 * shows whichever half the reader asked for. Writing one string here is how
 * this screen came to answer in Nepali to somebody who had pressed ENGLISH.
 */
export type PhotoActionState = { ok: boolean; en: string; ne: string };

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
    return { ok: false, en: "No photo was chosen.", ne: "फोटो छानिएन।" };
  }

  const product = await getProductById(productId, { includeDrafts: true });
  if (!product) {
    return { ok: false, en: "That product was not found.", ne: "सामान भेटिएन।" };
  }

  if (slot === "gallery" && product.gallery.length >= MAX_PHOTOS) {
    return { ok: false, en: `A shoe holds ${MAX_PHOTOS} photos — remove one first.`, ne: `एउटा जुत्तामा ${MAX_PHOTOS} फोटो मात्र — पहिले एउटा हटाउनुहोस्।` };
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
    // saveFailureMessage answers in English when it recognises the failure;
    // otherwise it hands back the fallback it was given, so each language gets
    // its own half for the common case.
    const fallback = { en: "The photo was not saved.", ne: "फोटो सुरक्षित भएन।" };
    return {
      ok: false,
      en: saveFailureMessage(error, fallback.en),
      ne: saveFailureMessage(error, fallback.ne),
    };
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

  return slot === "main"
    ? { ok: true, en: `${product.name} — main photo changed ✅`, ne: `${product.name} — मुख्य फोटो बदलियो ✅` }
    : { ok: true, en: `${product.name} — another photo added ✅`, ne: `${product.name} — थप फोटो जोडियो ✅` };
}

/** At most this many photos on a shoe: a strip of six is already a lot to swipe. */
const MAX_PHOTOS = 6;

/**
 * Another photo is the cover now — the one on every card (owner,
 * 2026-10-02). The others keep their order behind it.
 */
export async function setCoverPhotoAction(
  _previousState: PhotoActionState | null,
  formData: FormData,
): Promise<PhotoActionState> {
  await requireAdminPermission("products:write");
  const productId = textValue(formData, "productId");
  const image = textValue(formData, "image");
  const product = productId ? await getProductById(productId, { includeDrafts: true }) : null;
  if (!product || !image || !product.gallery.includes(image)) {
    return { ok: false, en: "That photo was not found on this shoe.", ne: "यो जुत्तामा त्यो फोटो भेटिएन।" };
  }
  try {
    await upsertProduct({ ...product, image, gallery: [image, ...product.gallery.filter((item) => item !== image)] });
  } catch (error) {
    reportError(`set cover photo for product ${product.sku}`, error);
    return { ok: false, en: "The cover was not changed.", ne: "मुख्य फोटो बदलिएन।" };
  }
  await recordAdminAuditEvent("product_photo_cover", `Cover photo changed for ${product.sku} (${product.name}).`);
  revalidatePath("/", "layout");
  revalidatePath("/admin/products/photos");
  return { ok: true, en: `${product.name} — cover photo changed ✅`, ne: `${product.name} — मुख्य फोटो बदलियो ✅` };
}

/** A photo taken off a shoe. The last one stays: a shoe with no photo does not sell. */
export async function removePhotoAction(
  _previousState: PhotoActionState | null,
  formData: FormData,
): Promise<PhotoActionState> {
  await requireAdminPermission("products:write");
  const productId = textValue(formData, "productId");
  const image = textValue(formData, "image");
  const product = productId ? await getProductById(productId, { includeDrafts: true }) : null;
  if (!product || !image) return { ok: false, en: "That photo was not found.", ne: "फोटो भेटिएन।" };
  const rest = product.gallery.filter((item) => item !== image);
  if (rest.length === 0) {
    return { ok: false, en: "This is the only photo — add another before removing it.", ne: "यो एउटै फोटो हो — पहिले अर्को राखेर मात्र हटाउनुहोस्।" };
  }
  try {
    await upsertProduct({ ...product, image: product.image === image ? rest[0] : product.image, gallery: rest });
  } catch (error) {
    reportError(`remove photo from product ${product.sku}`, error);
    return { ok: false, en: "The photo was not removed.", ne: "फोटो हटेन।" };
  }
  await recordAdminAuditEvent("product_photo_removed", `A photo removed from ${product.sku} (${product.name}).`);
  revalidatePath("/", "layout");
  revalidatePath("/admin/products/photos");
  return { ok: true, en: `${product.name} — photo removed`, ne: `${product.name} — फोटो हट्यो` };
}
