import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

function safeFileName(name: string) {
  return (name || "product-photo")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
}

// A photo has to live somewhere the shop can load it from. Two places:
//
//  - Vercel Blob, when BLOB_READ_WRITE_TOKEN is set. Works everywhere, and the
//    URL loads on the live shop. This is the real one.
//  - The local public/uploads folder, when running `npm run dev` on your own
//    machine with no token. Lets you upload while learning the app without
//    setting anything up — but the URL is your computer's, so a photo added
//    this way shows only here, not on the live shop.
//
// The local fallback is refused on the deployed server on purpose: Vercel's
// filesystem is read-only there, and a /uploads URL written on one request
// would not survive to the next.
async function saveLocally(file: File, safeName: string) {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  // A short prefix so two photos with the same name do not overwrite each
  // other, mirroring Blob's addRandomSuffix. Built from Date.now rather than a
  // bracketed regex over the ISO string: Tailwind scans this file — comments
  // included — and reads such a bracket token as an arbitrary CSS property that
  // then fails to parse.
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const fileName = `${stamp}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(uploadsDir, fileName), bytes);

  // Served from /public, so the browser loads it at this path.
  return `/uploads/${fileName}`;
}

// Uploads a product photo and returns a URL to it. Protected by the same
// permission as editing products.
export async function POST(request: Request) {
  await requireAdminPermission("products:write");

  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  // NODE_ENV is 'development' under `npm run dev` and 'production' in a build,
  // which is what the deployed server runs. Only offer the local fallback in
  // development, where the filesystem is writable and the URL is reachable.
  const canSaveLocally = process.env.NODE_ENV === "development";

  if (!hasBlob && !canSaveLocally) {
    return Response.json(
      {
        error:
          "Photo upload is not set up yet. Add a Vercel Blob store and set BLOB_READ_WRITE_TOKEN, then redeploy.",
      },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No image file was received." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: "Only JPEG, PNG, WebP, AVIF, or GIF images are allowed." },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Image must be 8 MB or smaller." }, { status: 413 });
  }

  const safeName = safeFileName(file.name);

  try {
    let url: string;
    let storedTo: string;

    if (hasBlob) {
      const blob = await put(`products/${safeName}`, file, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type,
      });
      url = blob.url;
      storedTo = "Vercel Blob";
    } else {
      url = await saveLocally(file, safeName);
      storedTo = "local dev folder";
    }

    await appendAdminAuditEvent(
      "product_photo_upload",
      `Uploaded product photo ${safeName} to ${storedTo}.`,
    ).catch(() => undefined);

    // Tells the form to warn that a locally-stored photo will not show on the
    // live shop, so a product edited here does not silently ship a broken image.
    return Response.json({ url, local: !hasBlob });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return Response.json({ error: `Upload failed: ${message}` }, { status: 502 });
  }
}
