"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { put } from "@vercel/blob";
import { getProductById, getProducts, upsertProduct } from "@/lib/product-store";
import { databaseImagesAvailable, getDatabaseImage, saveDatabaseImage } from "@/lib/image-store";
import { findReframe, reframePhoto, type Reframe } from "@/lib/photo-reframe";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { isShopVideoUrl, isVideoUrl, photosOf } from "@/lib/product-media";

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

  if (slot === "gallery" && photosOf(product.gallery).length >= MAX_PHOTOS) {
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
  if (!product || !image || !product.gallery.includes(image) || isVideoUrl(image)) {
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
  // The video can always go; the last picture cannot.
  if (!isVideoUrl(image) && photosOf(rest).length === 0) {
    return { ok: false, en: "This is the only photo — add another before removing it.", ne: "यो एउटै फोटो हो — पहिले अर्को राखेर मात्र हटाउनुहोस्।" };
  }
  try {
    await upsertProduct({ ...product, image: product.image === image ? photosOf(rest)[0] : product.image, gallery: rest });
  } catch (error) {
    reportError(`remove photo from product ${product.sku}`, error);
    return { ok: false, en: "The photo was not removed.", ne: "फोटो हटेन।" };
  }
  await recordAdminAuditEvent("product_photo_removed", `A photo removed from ${product.sku} (${product.name}).`);
  revalidatePath("/", "layout");
  revalidatePath("/admin/products/photos");
  return { ok: true, en: `${product.name} — photo removed`, ne: `${product.name} — फोटो हट्यो` };
}

/** A cover photo with bars in it, and the piece the fix would keep — for the screen to show before anything is saved. */
export type FramedPhoto = { productId: string; name: string; image: string; frame: Reframe };

/**
 * The bytes of a photo the shop itself stored: on its Blob store, or in its
 * database. Nothing else is fetched — an address typed into a product is not a
 * reason for the server to go and load it.
 */
async function storedPhotoBytes(image: string): Promise<Buffer | null> {
  try {
    if (image.startsWith("/api/images/")) {
      const stored = await getDatabaseImage(image.slice("/api/images/".length));
      return stored ? stored.bytes : null;
    }
    const url = new URL(image);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".blob.vercel-storage.com")) return null;
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * The shoes whose cover photo has bars in it (owner, 2026-10-02). Only looks;
 * changes nothing.
 */
export async function findFramedPhotosAction(): Promise<FramedPhoto[]> {
  await requireAdminPermission("products:write");
  const products = await getProducts({ includeDrafts: true });
  const found: FramedPhoto[] = [];
  for (const product of products) {
    if (!product.image || product.image.startsWith("/images/")) continue;
    const bytes = await storedPhotoBytes(product.image);
    const frame = bytes ? await findReframe(bytes) : null;
    if (frame) found.push({ productId: product.id, name: product.name, image: product.image, frame });
  }
  return found;
}

/**
 * Mends one shoe's cover photo: the bars cut, the shoe framed 4:5. The new
 * photo goes in as another photo and becomes the cover; the old one stays in
 * the strip behind it, so the owner can put it back with one tap.
 */
export async function fixFramedPhotoAction(productId: string): Promise<PhotoActionState> {
  await requireAdminPermission("products:write");
  const product = productId ? await getProductById(productId, { includeDrafts: true }) : null;
  if (!product) return { ok: false, en: "That product was not found.", ne: "सामान भेटिएन।" };
  if (photosOf(product.gallery).length >= MAX_PHOTOS) {
    return { ok: false, en: `${product.name} already has ${MAX_PHOTOS} photos — remove one first.`, ne: `${product.name} मा ${MAX_PHOTOS} फोटो भइसके — पहिले एउटा हटाउनुहोस्।` };
  }
  const bytes = await storedPhotoBytes(product.image);
  const frame = bytes ? await findReframe(bytes) : null;
  if (!bytes || !frame) return { ok: false, en: `${product.name} — nothing to mend in this photo.`, ne: `${product.name} — यो फोटोमा मिलाउनु पर्ने केही छैन।` };

  let url: string;
  try {
    const fixed = await reframePhoto(bytes, frame);
    if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
      const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shoe";
      url = (await put(`products/${slug}-framed.webp`, fixed, { access: "public", addRandomSuffix: true, contentType: "image/webp" })).url;
    } else if (databaseImagesAvailable()) {
      url = (await saveDatabaseImage({ bytes: fixed, contentType: "image/webp" })).url;
    } else {
      return { ok: false, en: "Photo storage is not set up here.", ne: "यहाँ फोटो राख्ने ठाउँ मिलाइएको छैन।" };
    }
  } catch (error) {
    reportError(`mend the photo of product ${product.sku}`, error);
    return { ok: false, en: `${product.name} — the photo was not mended.`, ne: `${product.name} — फोटो मिलेन।` };
  }

  try {
    await upsertProduct({ ...product, image: url, gallery: [url, ...product.gallery.filter((item) => item !== url)] });
  } catch (error) {
    reportError(`save the mended photo of product ${product.sku}`, error);
    return { ok: false, en: `${product.name} — the mended photo was not saved.`, ne: `${product.name} — मिलाएको फोटो सुरक्षित भएन।` };
  }
  await recordAdminAuditEvent(
    "product_photo_reframed",
    `Bars cut from the cover photo of ${product.sku} (${product.name}); framed 4:5 as a new cover, the old photo kept.`,
  );
  revalidatePath("/", "layout");
  revalidatePath("/admin/products/photos");
  return { ok: true, en: `${product.name} — photo mended ✅ (the old one is kept)`, ne: `${product.name} — फोटो मिल्यो ✅ (पुरानो पनि राखिएको छ)` };
}

/**
 * A shoe's video, once the phone has sent it to the file store (owner,
 * 2026-10-07). Only the shop's own upload is accepted, and a shoe keeps one:
 * a new video replaces the old.
 */
export async function setProductVideoAction(productId: string, url: string): Promise<PhotoActionState> {
  await requireAdminPermission("products:write");
  if (!isShopVideoUrl(url)) {
    return { ok: false, en: "That video did not come from this shop's upload.", ne: "यो भिडियो पसलकै upload बाट आएको होइन।" };
  }
  const product = await getProductById(productId, { includeDrafts: true });
  if (!product) return { ok: false, en: "That product was not found.", ne: "सामान भेटिएन।" };
  try {
    await upsertProduct({ ...product, gallery: [...photosOf(product.gallery), url] });
  } catch (error) {
    reportError(`save video for product ${product.sku}`, error);
    return { ok: false, en: "The video was not saved.", ne: "भिडियो सुरक्षित भएन।" };
  }
  await recordAdminAuditEvent("product_video_set", `Video set for ${product.sku} (${product.name}).`);
  revalidatePath("/", "layout");
  revalidatePath("/admin/products/photos");
  return { ok: true, en: `${product.name} — video added ✅`, ne: `${product.name} — भिडियो थपियो ✅` };
}
