import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { databaseImagesAvailable, saveDatabaseImage } from "@/lib/image-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel routes a server upload through the function and caps the body at
// 4.5 MB. A larger file is rejected by the platform before it reaches this
// code, with a generic error, so cap it here to give a clear message instead.
const MAX_BYTES = Math.floor(4.5 * 1024 * 1024);
const MAX_LABEL = "4.5 MB";
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

type StorageKind = "blob" | "database" | "local" | "none";

function uploadTarget() {
  // A connected Blob store injects BLOB_STORE_ID as well as the token. Newer
  // Vercel setups authenticate the SDK over OIDC and may not expose the token
  // as a plain env var, so the store id is the more reliable "connected" signal
  // — and put() works over OIDC without the token in hand.
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const hasStoreId = Boolean(process.env.BLOB_STORE_ID);
  const hasBlob = hasToken || hasStoreId;
  // The database is where photos go when there is no Blob store — no external
  // service to configure, and it works on the live shop. Only on Postgres;
  // local-json dev has no table for it.
  const hasDatabase = databaseImagesAvailable();
  // 'development' under `npm run dev`, 'production' in a build. The filesystem
  // fallback is offered only in dev, where it is writable and reachable — it is
  // the path for local-json dev, which has neither Blob nor a database.
  const canSaveLocally = process.env.NODE_ENV === "development";

  // Order of preference: a real object store, then the database, then the dev
  // filesystem. The first that shows a photo on the live shop wins.
  const storage: StorageKind = hasBlob
    ? "blob"
    : hasDatabase
      ? "database"
      : canSaveLocally
        ? "local"
        : "none";

  return { hasToken, hasStoreId, hasBlob, hasDatabase, storage, ready: storage !== "none" };
}

// Whether uploads are configured, without exposing anything secret. Lets the
// form warn before a photo is chosen, and lets a deploy be checked from a
// logged-in browser. Only names and booleans leave here — never a token value.
export async function GET() {
  const { hasToken, hasStoreId, storage, ready } = uploadTarget();

  return Response.json({
    ready,
    // "blob"/"database" both show on the live shop; "local" is dev-only.
    storage,
    env: { BLOB_READ_WRITE_TOKEN: hasToken, BLOB_STORE_ID: hasStoreId },
    // Vercel routes a server upload through the function, capped at 4.5 MB.
    maxBytes: MAX_BYTES,
  });
}

// Uploads a product photo and returns a URL to it. Protected by the same
// permission as editing products.
export async function POST(request: Request) {
  await requireAdminPermission("products:write");

  const { storage } = uploadTarget();

  if (storage === "none") {
    return Response.json(
      {
        error:
          "Photo upload is not set up. Paste a public image URL instead, or connect a Vercel Blob store and redeploy.",
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
    return Response.json(
      { error: `Image must be ${MAX_LABEL} or smaller. Please shrink it and try again.` },
      { status: 413 },
    );
  }

  const safeName = safeFileName(file.name);

  try {
    let url: string;
    let storedTo: string;

    if (storage === "blob") {
      const blob = await put(`products/${safeName}`, file, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type,
      });
      url = blob.url;
      storedTo = "Vercel Blob";
    } else if (storage === "database") {
      const bytes = Buffer.from(await file.arrayBuffer());
      const saved = await saveDatabaseImage({ bytes, contentType: file.type });
      url = saved.url;
      storedTo = "database";
    } else {
      url = await saveLocally(file, safeName);
      storedTo = "local dev folder";
    }

    await recordAdminAuditEvent(
      "product_photo_upload",
      `Uploaded product photo ${safeName} to ${storedTo}.`,
    );

    // Only the dev filesystem photo fails to load on the live shop, so only that
    // one warns. Blob and database URLs both work there.
    return Response.json({ url, local: storage === "local" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return Response.json({ error: `Upload failed: ${message}` }, { status: 502 });
  }
}
