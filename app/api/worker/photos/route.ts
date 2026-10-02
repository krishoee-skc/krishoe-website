import { put } from "@vercel/blob";
import sharp from "sharp";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { reportError } from "@/lib/report-error";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";
import { addWorkerPhoto, countPhotosToday, isPhotoKind, isWorkerOnLeave, PHOTOS_PER_DAY } from "@/lib/worker-portal";
import { workerTableReady } from "@/lib/worker-portal-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Vercel caps a request body at 4.5 MB; the phone shrinks the photo well under it first. */
const MAX_BYTES = Math.floor(4.5 * 1024 * 1024);
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const reply = (status: number, words: { en: string; ne: string }) => Response.json({ ok: false, ...words }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * A worker sends a photo of their work (owner, 2026-10-02). The worker's own
 * sign-in only, for their own record; a worker who has left or is on leave
 * cannot send. The photo is turned upright, kept to 1600px and WebP before it
 * is stored, and it is proof only — it reaches the books when the owner
 * presses "Add to the books" on it.
 */
export async function POST(request: Request) {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) return reply(401, { en: "Sign in first.", ne: "पहिले login गर्नुहोस्।" });
  if (!access.linked) return reply(403, { en: "Your account is closed.", ne: "तपाईंको खाता बन्द छ।" });
  const worker = access.detail.worker;

  if (!(await workerTableReady("factory_worker_photos"))) {
    return reply(503, { en: "Photos are not switched on yet — ask the owner.", ne: "फोटो पठाउने सुविधा अझै खुलेको छैन — मालिकलाई भन्नुहोस्।" });
  }
  if (await isWorkerOnLeave(worker.id)) return reply(403, { en: "You are on leave — nothing can be sent.", ne: "तपाईं बिदामा हुनुहुन्छ — अहिले पठाउन मिल्दैन।" });
  if ((await countPhotosToday(worker.id)) >= PHOTOS_PER_DAY) {
    return reply(429, { en: `${PHOTOS_PER_DAY} photos a day at most — send more tomorrow.`, ne: `एक दिनमा ${PHOTOS_PER_DAY} फोटो मात्र — बाँकी भोलि पठाउनुहोस्।` });
  }
  if (!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)) {
    return reply(503, { en: "Photo storage is not set up.", ne: "फोटो राख्ने ठाउँ मिलाइएको छैन।" });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  const kind = String(form?.get("kind") ?? "");
  const pairsText = String(form?.get("pairs") ?? "").trim();
  const note = String(form?.get("note") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) return reply(400, { en: "Choose a photo.", ne: "फोटो छान्नुहोस्।" });
  if (file.size > MAX_BYTES) return reply(413, { en: "That photo is too big.", ne: "फोटो धेरै ठूलो भयो।" });
  if (file.type && !TYPES.includes(file.type)) return reply(415, { en: "Send a photo (JPEG or PNG).", ne: "फोटो मात्र पठाउनुहोस्।" });
  if (!isPhotoKind(kind)) return reply(400, { en: "Choose what the photo is of.", ne: "के को फोटो हो, छान्नुहोस्।" });
  const pairs = pairsText ? Math.round(Number(pairsText)) : null;
  if (pairs !== null && (!Number.isFinite(pairs) || pairs <= 0 || pairs > 10000)) {
    return reply(400, { en: "Pairs should be a number.", ne: "जोडी अंकमा लेख्नुहोस्।" });
  }

  try {
    const bytes = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "none" })
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    const stored = await put(`worker-photos/${worker.id}.webp`, bytes, { access: "public", addRandomSuffix: true, contentType: "image/webp" });
    await addWorkerPhoto({ workerId: worker.id, staffId: access.staff.id, kind, pairs, note, imageUrl: stored.url });
  } catch (error) {
    reportError(`store a work photo from factory worker ${worker.id}`, error);
    return reply(500, { en: "The photo did not send. Try again.", ne: "फोटो पठाइएन। फेरि प्रयास गर्नुहोस्।" });
  }

  await recordAdminAuditEvent("factory_worker_photo", `${worker.name} sent a work photo (${kind}${pairs ? `, ${pairs} pairs` : ""}).`);
  return Response.json({ ok: true, en: "Sent to the owner ✅", ne: "मालिकलाई पठाइयो ✅" }, { headers: { "Cache-Control": "no-store" } });
}
