import { put } from "@vercel/blob";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { removePhotoBackground } from "@/lib/remove-photo-background";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The model takes about a second, and a cold start adds another for loading
// it. The default ten is enough, but say so rather than discover it.
export const maxDuration = 30;

const MAX_BYTES = Math.floor(4.5 * 1024 * 1024);
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Accept a photo URL only if it is one of the shop's own.
 *
 * The Add photos screen sends a URL rather than a file, because the photo it
 * wants the background off is already uploaded. That turns this route into one
 * that fetches a URL somebody else supplied, which is the shape of a
 * server-side request forgery: without this check, anyone who could reach the
 * route could make the server open addresses only the server can see — a cloud
 * metadata endpoint, an internal service, a database admin page — and the
 * error message would report back what it found.
 *
 * So: HTTPS only, and only the Vercel blob host the shop's own photos live on.
 * Not a substring test — "vercel-storage.com.attacker.net" contains that name
 * and is not that host. The URL is parsed and the hostname compared as a whole.
 *
 * Returns the parsed URL when it is ours, and null for everything else.
 */
function safeShopPhotoUrl(value: string): URL | null {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;

  // The shop's photos are served from <store>.public.blob.vercel-storage.com.
  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith(".public.blob.vercel-storage.com")) return null;

  // A bare ".public.blob.vercel-storage.com" with nothing before it is not a
  // real store, and neither is one with credentials or a port attached.
  if (host === ".public.blob.vercel-storage.com") return null;
  if (parsed.username || parsed.password || parsed.port) return null;

  return parsed;
}

/**
 * Cut the background out of one photo, on request.
 *
 * Deliberately its own route rather than part of the upload. Background
 * removal is a judgement — it does well on a shoe against a plain surface and
 * keeps the hand when the shoe is being held — so the shopkeeper presses a
 * button, sees the result, and decides. Running it automatically would mean
 * discovering a bad cut-out only after it was already in the shop.
 *
 * This stores the result and returns its URL. The screen then shows both and
 * only writes it to the product if the owner keeps it, so a rejected attempt
 * costs a file in blob storage and nothing else.
 */
export async function POST(request: Request) {
  // Throws rather than returning a response, the same as the upload route it
  // sits beside. Protected by the same permission as editing a product.
  await requireAdminPermission("products:write");

  const formData = await request.formData();
  const file = formData.get("file");
  const url = formData.get("url");

  let input: Buffer;

  if (file instanceof File) {
    // A photo being chosen now, from the product form.
    if (!ALLOWED.includes(file.type)) {
      return Response.json(
        { error: "Only JPEG, PNG, WebP or AVIF photos can have their background removed." },
        { status: 415 },
      );
    }

    if (file.size > MAX_BYTES) {
      return Response.json({ error: "That photo is too large." }, { status: 413 });
    }

    input = Buffer.from(await file.arrayBuffer());
  } else if (typeof url === "string" && url.trim()) {
    // A photo already on the shop, from the Add photos screen — the shopkeeper
    // has uploaded it and now wants the background off it, without finding the
    // original on their phone again.
    //
    // Only ever our own blob store. Fetching an arbitrary URL a form asked for
    // would let anyone who reaches this route make the server open addresses of
    // their choosing, including ones only the server can see.
    const target = safeShopPhotoUrl(url.trim());
    if (!target) {
      return Response.json(
        { error: "That photo is not one of the shop's own." },
        { status: 400 },
      );
    }

    const fetched = await fetch(target);
    if (!fetched.ok) {
      return Response.json({ error: "That photo could not be read." }, { status: 400 });
    }

    const type = fetched.headers.get("content-type") ?? "";
    if (!ALLOWED.some((allowed) => type.startsWith(allowed))) {
      return Response.json(
        { error: "Only JPEG, PNG, WebP or AVIF photos can have their background removed." },
        { status: 415 },
      );
    }

    const bytes = Buffer.from(await fetched.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      return Response.json({ error: "That photo is too large." }, { status: 413 });
    }

    input = bytes;
  } else {
    return Response.json({ error: "No image was received." }, { status: 400 });
  }

  const cut = await removePhotoBackground(input);

  if (!cut) {
    // Every failure path lands here: an unreadable file, a model that could not
    // load, or a mask that kept almost nothing or almost everything. The
    // shopkeeper keeps the photo they had.
    return Response.json(
      {
        error:
          "The background could not be separated from this photo. It works best on a shoe photographed against a plain surface — a white cloth behind it does more than this can.",
      },
      { status: 422 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Photo storage is not configured on this deployment." },
      { status: 500 },
    );
  }

  const blob = await put(`products/cutout.webp`, cut.bytes, {
    access: "public",
    addRandomSuffix: true,
    contentType: cut.contentType,
  });

  await recordAdminAuditEvent(
    "product_photo_background_removed",
    `Removed the background from a product photo — kept ${cut.keptPercent}% of the frame.`,
  );

  return Response.json({ url: blob.url, keptPercent: cut.keptPercent });
}
