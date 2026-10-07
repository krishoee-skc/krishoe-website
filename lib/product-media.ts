/**
 * A shoe's short video (owner, 2026-10-07: "एक जुत्ता: ४ फोटो + १० सेकेन्डको
 * भिडियो"). It is kept in the shoe's photo list, the one place the row already
 * has for its pictures, so no column had to be added to the live database; every
 * place that shows photos takes the video out first, and the product page shows
 * it on its own under the photos. At most one per shoe.
 */
const VIDEO = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i;

export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export function isVideoUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && VIDEO.test(url.trim());
}

/** The pictures only. */
export function photosOf(list: readonly string[] | null | undefined): string[] {
  return (list ?? []).filter((url) => !isVideoUrl(url));
}

/** The shoe's video, or "". */
export function videoOf(list: readonly string[] | null | undefined): string {
  return (list ?? []).find(isVideoUrl) ?? "";
}

/**
 * Only a video the shop itself uploaded may be saved on a shoe: from its own
 * file store, under products/videos/. A link typed or sent from anywhere else
 * is refused, so nobody can make the shop play somebody else's file.
 */
export function isShopVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com") &&
      url.pathname.startsWith("/products/videos/") &&
      isVideoUrl(url.pathname)
    );
  } catch {
    return false;
  }
}
