import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  BILL_PHOTO_TYPES,
  MAX_BILL_PHOTOS,
  MAX_BILL_PHOTO_BYTES,
  billPhotosReady,
  deleteBillPhoto,
  isBillId,
  listBillPhotos,
  saveBillPhoto,
} from "@/lib/purchase-photos";
import { getPurchaseInvoiceById } from "@/lib/purchasing";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** The bill must exist, and the store must be set up, before a photo is taken. */
async function billFor(context: Context) {
  const { id } = await context.params;
  if (!isBillId(id)) return { error: Response.json({ error: "Unknown bill." }, { status: 404 }) };
  if (!billPhotosReady()) {
    return { error: Response.json({ error: "The photo store is not set up." }, { status: 503 }) };
  }
  const invoice = await getPurchaseInvoiceById(id);
  if (!invoice) return { error: Response.json({ error: "Unknown bill." }, { status: 404 }) };
  return { invoice };
}

/** Adds one photo of the supplier's paper bill. */
export async function POST(request: Request, context: Context) {
  await requireAdminPermission("purchasing:write");
  const found = await billFor(context);
  if ("error" in found) return found.error;
  const { invoice } = found;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No photo was received." }, { status: 400 });
  if (!BILL_PHOTO_TYPES.includes(file.type)) {
    return Response.json({ error: "Only a JPEG, PNG or WebP photo can be kept." }, { status: 415 });
  }
  if (file.size > MAX_BILL_PHOTO_BYTES) {
    return Response.json({ error: "The photo is too large. Take it again, a little further away." }, { status: 413 });
  }

  try {
    const existing = await listBillPhotos(invoice.id);
    if (existing.length >= MAX_BILL_PHOTOS) {
      return Response.json({ error: `A bill keeps at most ${MAX_BILL_PHOTOS} photos.` }, { status: 409 });
    }
    const saved = await saveBillPhoto(invoice.id, Buffer.from(await file.arrayBuffer()), file.type);
    await recordAdminAuditEvent("purchase_photo_added", `Photo of the supplier's bill added to ${invoice.purchaseNumber}.`);
    return Response.json({ url: saved.url, pathname: saved.pathname });
  } catch (error) {
    reportError("save a purchase bill photo", error);
    return Response.json({ error: "The photo could not be saved. Please try again." }, { status: 502 });
  }
}

/** Removes one photo from the bill (?pathname=…). */
export async function DELETE(request: Request, context: Context) {
  await requireAdminPermission("purchasing:write");
  const found = await billFor(context);
  if ("error" in found) return found.error;
  const pathname = new URL(request.url).searchParams.get("pathname") ?? "";

  try {
    const removed = await deleteBillPhoto(found.invoice.id, pathname);
    if (!removed) return Response.json({ error: "That photo is not on this bill." }, { status: 404 });
    await recordAdminAuditEvent("purchase_photo_removed", `Photo removed from ${found.invoice.purchaseNumber}.`);
    return Response.json({ ok: true });
  } catch (error) {
    reportError("remove a purchase bill photo", error);
    return Response.json({ error: "The photo could not be removed. Please try again." }, { status: 502 });
  }
}
