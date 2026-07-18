import { getDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

// Product photos, stored in the database so the Upload button works with no
// object store to configure. This is deliberately backend-specific: it only
// runs on Postgres. Local-json dev uses the filesystem fallback in the upload
// route, and a connected Vercel Blob store takes priority over both.

export type StoredImage = {
  bytes: Buffer;
  contentType: string;
};

type UploadedImageRow = {
  content_type: string;
  bytes: Buffer;
};

/** Whether photos can be stored in the database — i.e. Postgres is the backend. */
export function databaseImagesAvailable() {
  return getDataBackend() === "postgres";
}

function createImageId() {
  const stamp = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `IMG-${stamp}-${suffix}`;
}

/**
 * Store an image and return the path the shop loads it from. The id carries no
 * extension; the content type is stored alongside and set when it is served.
 */
export async function saveDatabaseImage(image: StoredImage) {
  const id = createImageId();

  await queryPostgres(
    "uploaded images",
    `
      INSERT INTO uploaded_images (id, content_type, bytes, byte_size)
      VALUES ($1, $2, $3, $4)
    `,
    [id, image.contentType, image.bytes, image.bytes.byteLength],
  );

  return { id, url: `/api/images/${id}` };
}

/** Read an image back, or null if the id is unknown. */
export async function getDatabaseImage(id: string): Promise<StoredImage | null> {
  const rows = await queryPostgres<UploadedImageRow>(
    "uploaded images",
    `SELECT content_type, bytes FROM uploaded_images WHERE id = $1 LIMIT 1`,
    [id],
  );

  if (!rows[0]) {
    return null;
  }

  return { bytes: rows[0].bytes, contentType: rows[0].content_type };
}
