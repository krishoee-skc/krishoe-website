import { photosOf } from "@/lib/product-media";

/**
 * Whether a product is still wearing one of the sample photos.
 *
 * The shop shipped with stock photographs in public/images/products — a
 * ladies-sandals picture, a kids-collection picture — put there so the screens
 * had something to show before there was anything real. Three products are
 * still on them, and those three are the only ones with stock: a shopper
 * looking for Bachha Rubber (Kids) is shown a photograph of ladies' sandals.
 *
 * This is worse than an empty frame. An empty frame says "no photo yet"; a
 * wrong photo says "this is the shoe", and the shopper only learns otherwise
 * when the parcel arrives. So it is worth naming on the owner's own screen,
 * where it can still be fixed.
 *
 * A real photo lives in the Blob store, in the database, or in the dev uploads
 * folder — never in the bundled sample folder.
 */
const SAMPLE_PREFIX = "/images/products/";

export function isSamplePhoto(image: string | null | undefined): boolean {
  return typeof image === "string" && image.trim().startsWith(SAMPLE_PREFIX);
}

export function hasNoPhoto(image: string | null | undefined): boolean {
  return typeof image !== "string" || image.trim() === "";
}

/**
 * How a real photo could sell better (owner, 2026-10-01): the shop's photos
 * are WhatsApp snaps, one per shoe. Advice, never a fault — a shoe with any
 * real photo can be sold. Each item is a pair of words, English and Nepali.
 */
export function photoAdvice(product: { image?: string | null; gallery?: string[] | null }) {
  const advice: Array<{ en: string; ne: string }> = [];
  if (hasNoPhoto(product.image) || isSamplePhoto(product.image)) return advice;
  const real = new Set([product.image, ...photosOf(product.gallery)].filter((image): image is string => Boolean(image) && !isSamplePhoto(image)));
  if (real.size < 2) {
    advice.push({ en: "One photo only — add 2–4 angles (side, top, sole, worn)", ne: "एउटा मात्र फोटो — २–४ कोणबाट थप्नुहोस् (छेउ, माथि, तलुवा, लगाएको)" });
  }
  if ([...real].some((image) => /whatsapp[-_ ]?image/i.test(image))) {
    advice.push({ en: "A WhatsApp photo — a clear one on a plain white background sells better", ne: "WhatsApp को फोटो — सादा सेतो पृष्ठभूमिमा प्रस्ट फोटोले धेरै बेच्छ" });
  }
  return advice;
}
