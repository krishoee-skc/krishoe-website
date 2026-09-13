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

  if (!(file instanceof File)) {
    return Response.json({ error: "No image was received." }, { status: 400 });
  }

  if (!ALLOWED.includes(file.type)) {
    return Response.json(
      { error: "Only JPEG, PNG, WebP or AVIF photos can have their background removed." },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That photo is too large." }, { status: 413 });
  }

  const cut = await removePhotoBackground(Buffer.from(await file.arrayBuffer()));

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
