import { randomUUID } from "node:crypto";
import { queryPostgres } from "@/lib/postgres/client";
import { photoDraftReady, workerTableReady } from "@/lib/worker-portal-db";

/**
 * What the worker app keeps beyond the factory's own books (owner, 2026-10-02):
 * the photos a worker sends, the questions and advance requests they raise,
 * and who is on leave. Each reads as "nothing" until its table is added in
 * Settings, so a page never fails for want of one.
 */

const STORE = "worker portal";

export const PHOTO_KINDS = [
  { value: "done", en: "Work done", ne: "काम सकियो", icon: "✅" },
  { value: "upper", en: "Upper part", ne: "माथिल्लो भाग", icon: "🧵" },
  { value: "ready", en: "Ready pairs", ne: "तयार जोडी", icon: "👟" },
  { value: "problem", en: "Problem / damaged", ne: "समस्या / बिग्रियो", icon: "⚠️" },
] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number]["value"];
export const isPhotoKind = (value: string): value is PhotoKind => PHOTO_KINDS.some((kind) => kind.value === value);

/** A day's photos from one worker, at most. A wall of them helps nobody. */
export const PHOTOS_PER_DAY = 10;

export type WorkerPhoto = {
  id: string;
  workerId: string;
  workerName: string;
  kind: PhotoKind;
  pairs: number | null;
  note: string;
  imageUrl: string;
  status: "new" | "seen" | "added";
  createdAt: string;
  /** The shoe it is of, when the worker said — what makes it a draft of the day's work. */
  itemId: string;
  itemName: string;
  /** The work entry it became, once the owner pressed ✓. */
  workId: string;
  workerCategory: string;
  workerType: string;
};

export type WorkerRequest = {
  id: string;
  workerId: string;
  workerName: string;
  kind: "hisab" | "advance";
  amount: number | null;
  aboutDate: string;
  message: string;
  status: "open" | "done" | "declined";
  reply: string;
  createdAt: string;
};

type PhotoRow = {
  id: string; worker_id: string; worker_name: string; kind: PhotoKind; pairs: number | null; note: string; image_url: string;
  status: WorkerPhoto["status"]; created_at: string | Date; item_id: string | null; item_name: string | null; work_id: string | null;
  worker_category: string; worker_type: string;
};
type RequestRow = { id: string; worker_id: string; worker_name: string; kind: WorkerRequest["kind"]; amount: string | number | null; about_date: string | Date | null; message: string; status: WorkerRequest["status"]; reply: string; created_at: string | Date };

const iso = (value: string | Date) => (value instanceof Date ? value.toISOString() : String(value));
const day = (value: string | Date | null) => (!value ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));

function photoFromRow(row: PhotoRow): WorkerPhoto {
  return {
    id: row.id, workerId: row.worker_id, workerName: row.worker_name, kind: row.kind, pairs: row.pairs, note: row.note, imageUrl: row.image_url,
    status: row.status, createdAt: iso(row.created_at), itemId: row.item_id ?? "", itemName: row.item_name ?? "", workId: row.work_id ?? "",
    workerCategory: row.worker_category, workerType: row.worker_type,
  };
}
function requestFromRow(row: RequestRow): WorkerRequest {
  return {
    id: row.id,
    workerId: row.worker_id,
    workerName: row.worker_name,
    kind: row.kind,
    amount: row.amount === null ? null : Number(row.amount),
    aboutDate: day(row.about_date),
    message: row.message,
    status: row.status,
    reply: row.reply,
    createdAt: iso(row.created_at),
  };
}

/* ---------------- leave ---------------- */

/** Who is away, and since when. Empty until the table is added. */
export async function getWorkersOnLeave(): Promise<Map<string, string>> {
  if (!(await workerTableReady("factory_worker_leave"))) return new Map();
  const rows = await queryPostgres<{ worker_id: string; since: string | Date }>(STORE, "SELECT worker_id, since FROM factory_worker_leave LIMIT 500");
  return new Map(rows.map((row) => [row.worker_id, day(row.since)]));
}

export async function isWorkerOnLeave(workerId: string) {
  return (await getWorkersOnLeave()).has(workerId);
}

/** On leave from today, or back. Only an active worker can be put on leave. */
export async function setWorkerLeave(workerId: string, onLeave: boolean, by: string) {
  if (!(await workerTableReady("factory_worker_leave"))) throw new Error("NOT_READY");
  if (onLeave) {
    await queryPostgres(
      STORE,
      `INSERT INTO factory_worker_leave (worker_id, set_by)
       SELECT id, $2 FROM factory_workers WHERE id = $1 AND status = 'active'
       ON CONFLICT (worker_id) DO NOTHING`,
      [workerId, by],
    );
  } else {
    await queryPostgres(STORE, "DELETE FROM factory_worker_leave WHERE worker_id = $1", [workerId]);
  }
}

/* ---------------- photos ---------------- */

export async function countPhotosToday(workerId: string) {
  if (!(await workerTableReady("factory_worker_photos"))) return 0;
  const rows = await queryPostgres<{ n: number }>(
    STORE,
    `SELECT count(*)::int AS n FROM factory_worker_photos
      WHERE worker_id = $1 AND created_at >= (now() AT TIME ZONE 'Asia/Kathmandu')::date AT TIME ZONE 'Asia/Kathmandu'`,
    [workerId],
  );
  return rows[0]?.n ?? 0;
}

export async function addWorkerPhoto(input: { workerId: string; staffId: string; kind: PhotoKind; pairs: number | null; note: string; imageUrl: string; itemId?: string }) {
  const id = `WPH-${randomUUID()}`;
  // The shoe goes in only once its column is there (Settings → OK).
  const withItem = Boolean(input.itemId) && (await photoDraftReady());
  await queryPostgres(
    STORE,
    withItem
      ? `INSERT INTO factory_worker_photos (id, worker_id, staff_id, kind, pairs, note, image_url, item_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
      : `INSERT INTO factory_worker_photos (id, worker_id, staff_id, kind, pairs, note, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    withItem
      ? [id, input.workerId, input.staffId, input.kind, input.pairs, input.note.slice(0, 300), input.imageUrl, input.itemId ?? ""]
      : [id, input.workerId, input.staffId, input.kind, input.pairs, input.note.slice(0, 300), input.imageUrl],
  );
  return id;
}

/** The newest photos — one worker's, or everyone's. */
export async function listWorkerPhotos(options: { workerId?: string; limit?: number } = {}): Promise<WorkerPhoto[]> {
  if (!(await workerTableReady("factory_worker_photos"))) return [];
  const draft = await photoDraftReady();
  const rows = await queryPostgres<PhotoRow>(
    STORE,
    `SELECT p.id, p.worker_id, w.name AS worker_name, w.category AS worker_category, w.worker_type,
            p.kind, p.pairs, p.note, p.image_url, p.status, p.created_at,
            ${draft ? "p.item_id, i.name AS item_name, p.work_id" : "NULL::text AS item_id, NULL::text AS item_name, NULL::text AS work_id"}
       FROM factory_worker_photos p
       JOIN factory_workers w ON w.id = p.worker_id
       ${draft ? "LEFT JOIN factory_items i ON i.id = p.item_id" : ""}
      WHERE ($1::text IS NULL OR p.worker_id = $1)
      ORDER BY p.created_at DESC
      LIMIT $2`,
    [options.workerId ?? null, Math.min(Math.max(options.limit ?? 60, 1), 200)],
  );
  return rows.map(photoFromRow);
}

/** One photo, for turning it into a work entry. */
export async function getWorkerPhoto(id: string): Promise<WorkerPhoto | null> {
  const draft = await photoDraftReady();
  const rows = await queryPostgres<PhotoRow>(
    STORE,
    `SELECT p.id, p.worker_id, w.name AS worker_name, w.category AS worker_category, w.worker_type,
            p.kind, p.pairs, p.note, p.image_url, p.status, p.created_at,
            ${draft ? "p.item_id, i.name AS item_name, p.work_id" : "NULL::text AS item_id, NULL::text AS item_name, NULL::text AS work_id"}
       FROM factory_worker_photos p
       JOIN factory_workers w ON w.id = p.worker_id
       ${draft ? "LEFT JOIN factory_items i ON i.id = p.item_id" : ""}
      WHERE p.id = $1`,
    [id],
  );
  return rows[0] ? photoFromRow(rows[0]) : null;
}

/** The photo became this work entry: marked added, with the entry's id. */
export async function linkWorkerPhotoToWork(id: string, workId: string, by: string) {
  await queryPostgres(
    STORE,
    `UPDATE factory_worker_photos SET status = 'added', work_id = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1`,
    [id, workId, by],
  );
}

export async function markWorkerPhoto(id: string, status: "seen" | "added", by: string) {
  await queryPostgres(
    STORE,
    `UPDATE factory_worker_photos SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1`,
    [id, status, by],
  );
}

/* ---------------- requests ---------------- */

export async function addWorkerRequest(input: { workerId: string; staffId: string; kind: WorkerRequest["kind"]; amount: number | null; aboutDate: string; message: string }) {
  const id = `WRQ-${randomUUID()}`;
  await queryPostgres(
    STORE,
    `INSERT INTO factory_worker_requests (id, worker_id, staff_id, kind, amount, about_date, message)
     VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date, $7)`,
    [id, input.workerId, input.staffId, input.kind, input.amount, input.aboutDate, input.message.slice(0, 500)],
  );
  return id;
}

export async function countOpenRequests(workerId: string) {
  if (!(await workerTableReady("factory_worker_requests"))) return 0;
  const rows = await queryPostgres<{ n: number }>(
    STORE,
    "SELECT count(*)::int AS n FROM factory_worker_requests WHERE worker_id = $1 AND status = 'open'",
    [workerId],
  );
  return rows[0]?.n ?? 0;
}

export async function listWorkerRequests(options: { workerId?: string; limit?: number } = {}): Promise<WorkerRequest[]> {
  if (!(await workerTableReady("factory_worker_requests"))) return [];
  const rows = await queryPostgres<RequestRow>(
    STORE,
    `SELECT r.id, r.worker_id, w.name AS worker_name, r.kind, r.amount, r.about_date, r.message, r.status, r.reply, r.created_at
       FROM factory_worker_requests r JOIN factory_workers w ON w.id = r.worker_id
      WHERE ($1::text IS NULL OR r.worker_id = $1)
      ORDER BY (r.status = 'open') DESC, r.created_at DESC
      LIMIT $2`,
    [options.workerId ?? null, Math.min(Math.max(options.limit ?? 60, 1), 200)],
  );
  return rows.map(requestFromRow);
}

export async function resolveWorkerRequest(id: string, status: "done" | "declined", reply: string, by: string) {
  await queryPostgres(
    STORE,
    `UPDATE factory_worker_requests SET status = $2, reply = $3, resolved_by = $4, resolved_at = now()
      WHERE id = $1 AND status = 'open'`,
    [id, status, reply.slice(0, 300), by],
  );
}

/** New photos and open requests, for a badge on the Workers page. */
export async function workerInboxCounts() {
  const [photos, requests] = await Promise.all([
    workerTableReady("factory_worker_photos").then((ready) =>
      ready ? queryPostgres<{ n: number }>(STORE, "SELECT count(*)::int AS n FROM factory_worker_photos WHERE status = 'new'").then((rows) => rows[0]?.n ?? 0) : 0,
    ),
    workerTableReady("factory_worker_requests").then((ready) =>
      ready ? queryPostgres<{ n: number }>(STORE, "SELECT count(*)::int AS n FROM factory_worker_requests WHERE status = 'open'").then((rows) => rows[0]?.n ?? 0) : 0,
    ),
  ]);
  return { photos, requests };
}

/* ---------------- pay ---------------- */

/** The last payment in the past few days, for "your pay was sent" on the worker's home. */
export async function recentWorkerPayment(workerId: string, days = 3): Promise<{ amount: number; date: string } | null> {
  const rows = await queryPostgres<{ amount: string | number; date: string | Date }>(
    STORE,
    `SELECT payment_given AS amount, date FROM factory_worker_ledger
      WHERE worker_id = $1 AND entry_type = 'payment' AND status <> 'reversed'
        AND COALESCE(payment_given, 0) > 0 AND date >= CURRENT_DATE - $2::int
      ORDER BY date DESC, created_at DESC
      LIMIT 1`,
    [workerId, days],
  );
  return rows[0] ? { amount: Number(rows[0].amount), date: day(rows[0].date) } : null;
}

/** Each worker's running balance — what the factory still owes them. */
export async function workerBalances(): Promise<Record<string, number>> {
  const rows = await queryPostgres<{ worker_id: string; balance: string | number }>(
    STORE,
    `SELECT worker_id, SUM(COALESCE(amount_earned, 0) - COALESCE(payment_given, 0)) AS balance
       FROM factory_worker_ledger WHERE status <> 'reversed'
      GROUP BY worker_id
      LIMIT 500`,
  );
  return Object.fromEntries(rows.map((row) => [row.worker_id, Number(row.balance) || 0]));
}
