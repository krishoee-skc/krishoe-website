/**
 * Taking a photo of a supplier's paper bill up to the file store — browser side.
 *
 * A phone camera makes a 3–6 MB photo, and the hosting refuses a request over
 * 4.5 MB. So the photo is shrunk here first, to at most 1600 px on its long
 * side as a JPEG: a few hundred KB, and the writing on the bill still reads.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.8;

/** A smaller JPEG of the photo. Falls back to the original if the browser cannot draw it. */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Only a photo can be kept with a bill.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  return blob ? new File([blob], "bill.jpg", { type: "image/jpeg" }) : file;
}

/** Shrinks and uploads one photo to a saved bill. Resolves with the server's word. */
export async function uploadBillPhoto(invoiceId: string, file: File): Promise<{ ok: boolean; message: string }> {
  try {
    const body = new FormData();
    body.set("file", await shrinkPhoto(file));
    const response = await fetch(`/api/admin/purchasing/${encodeURIComponent(invoiceId)}/photos`, {
      method: "POST",
      body,
    });
    if (response.ok) return { ok: true, message: "" };
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, message: result.error ?? "The photo could not be saved." };
  } catch {
    return { ok: false, message: "The photo could not be sent. Check the internet and add it from the bill page." };
  }
}
