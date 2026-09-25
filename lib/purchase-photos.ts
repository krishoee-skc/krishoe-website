import { del, list, put } from "@vercel/blob";

/**
 * Photos of the supplier's paper bill, kept beside the purchase bill.
 *
 * The paper bill is the proof — the rate the supplier wrote, their stamp, the
 * signature — and it went into a drawer. Now a photo of it is kept with the
 * bill in the file store (where the product photos live), named after the
 * bill: purchase-photos/<bill id>-photo-<random>.jpg. The bill finds its
 * photos by that name, so nothing is added to the database.
 *
 * The store serves a file to whoever has its link. The random part of the name
 * cannot be guessed, and the links are shown only on admin pages.
 */

const PREFIX = "purchase-photos/";
/** A bill of two or three pages, and one more for the gate pass. */
export const MAX_BILL_PHOTOS = 4;
/** Below the hosting's 4.5 MB request limit; the phone shrinks photos first. */
export const MAX_BILL_PHOTO_BYTES = 4 * 1024 * 1024;
export const BILL_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type BillPhoto = { url: string; pathname: string; size: number; uploadedAt: string };

export function billPhotosReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** Bill ids are generated ("PUR-20260925…-AB12"); anything else is refused. */
export function isBillId(id: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/.test(id);
}

function billPrefix(invoiceId: string) {
  // The trailing "-photo" keeps one bill's prefix from matching another whose
  // id merely starts the same way.
  return `${PREFIX}${invoiceId}-photo`;
}

export async function listBillPhotos(invoiceId: string): Promise<BillPhoto[]> {
  if (!billPhotosReady() || !isBillId(invoiceId)) return [];
  const { blobs } = await list({ prefix: billPrefix(invoiceId), limit: MAX_BILL_PHOTOS * 2 });
  return blobs
    .map((blob) => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: new Date(blob.uploadedAt).toISOString(),
    }))
    .sort((left, right) => left.uploadedAt.localeCompare(right.uploadedAt));
}

export async function saveBillPhoto(invoiceId: string, bytes: Buffer, contentType: string) {
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return put(`${billPrefix(invoiceId)}.${extension}`, bytes, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });
}

/** Removes one photo — only ever one that belongs to this bill. */
export async function deleteBillPhoto(invoiceId: string, pathname: string) {
  if (!isBillId(invoiceId) || !pathname.startsWith(billPrefix(invoiceId))) return false;
  await del(pathname);
  return true;
}
