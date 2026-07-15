import { put } from "@vercel/blob";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

// Uploads a product photo to Vercel Blob and returns its public URL. Protected
// by the same permission as editing products.
export async function POST(request: Request) {
  await requireAdminPermission("products:write");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
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

  const safeName = (file.name || "product-photo")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);

  try {
    const blob = await put(`products/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    await appendAdminAuditEvent("product_photo_upload", `Uploaded product photo ${safeName}.`).catch(
      () => undefined,
    );

    return Response.json({ url: blob.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return Response.json({ error: `Upload failed: ${message}` }, { status: 502 });
  }
}
