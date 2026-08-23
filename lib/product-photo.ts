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
