import { randomUUID } from "node:crypto";
import { queryPostgres } from "@/lib/postgres/client";

/**
 * Everything a customer says to the shop, in one place.
 *
 * It was in four, reached from four menu entries: reviews kept as JSON inside
 * the products row, contact_messages, wholesale_enquiries, and a Feedback
 * screen reading a table that was never created. Answering a customer meant
 * opening four screens and hoping none had been missed.
 *
 * The status is what makes one inbox worth more than four lists. A message that
 * has been read but not answered looks different from one that is finished, and
 * a question left three days is the thing this shop most needs to see — a
 * shopper who asks about a size and hears nothing buys the pair somewhere else.
 */

const STORE = "customer voice";

export type VoiceKind = "review" | "question" | "complaint";
export type VoiceStatus = "new" | "answered" | "closed";

export type CustomerVoice = {
  id: string;
  createdAt: string;
  kind: VoiceKind;
  customerName: string;
  phone: string;
  email: string;
  productId: string;
  productName: string;
  /** Which order a review came from. Empty on anything that is not one. */
  orderId: string;
  /** 1..5 on a review, 0 where the kind carries no verdict. */
  rating: number;
  message: string;
  status: VoiceStatus;
  repliedAt: string | null;
  replyNote: string;
  published: boolean;
  source: string;
};

type VoiceRow = {
  id: string;
  created_at: Date | string;
  kind: VoiceKind;
  customer_name: string;
  phone: string;
  email: string;
  product_id: string;
  product_name: string;
  order_id: string;
  rating: number | string;
  message: string;
  status: VoiceStatus;
  replied_at: Date | string | null;
  reply_note: string;
  published: boolean;
  source: string;
};

const COLUMNS = `id, created_at, kind, customer_name, phone, email, product_id,
  product_name, order_id, rating, message, status, replied_at, reply_note, published, source`;

function fromRow(row: VoiceRow): CustomerVoice {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    kind: row.kind,
    customerName: row.customer_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    productId: row.product_id ?? "",
    productName: row.product_name ?? "",
    orderId: row.order_id ?? "",
    rating: Math.min(5, Math.max(0, Math.round(Number(row.rating) || 0))),
    message: row.message ?? "",
    status: row.status,
    repliedAt: row.replied_at ? new Date(row.replied_at).toISOString() : null,
    replyNote: row.reply_note ?? "",
    published: Boolean(row.published),
    source: row.source ?? "site",
  };
}

/** A customer's own words, so length is capped rather than trusted. */
const MESSAGE_MAX = 4000;
const NAME_MAX = 120;

export async function saveCustomerVoice(input: {
  kind: VoiceKind;
  customerName?: string;
  phone?: string;
  email?: string;
  productId?: string;
  productName?: string;
  orderId?: string;
  rating?: number;
  message?: string;
  source?: string;
}): Promise<CustomerVoice> {
  const id = `CV-${randomUUID()}`;
  const rows = await queryPostgres<VoiceRow>(
    STORE,
    `INSERT INTO customer_voice
       (id, kind, customer_name, phone, email, product_id, product_name,
        order_id, rating, message, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${COLUMNS}`,
    [
      id,
      input.kind,
      (input.customerName ?? "").trim().slice(0, NAME_MAX),
      (input.phone ?? "").trim().slice(0, 40),
      (input.email ?? "").trim().slice(0, NAME_MAX),
      (input.productId ?? "").trim(),
      (input.productName ?? "").trim().slice(0, NAME_MAX),
      (input.orderId ?? "").trim(),
      Math.min(5, Math.max(0, Math.round(Number(input.rating) || 0))),
      (input.message ?? "").trim().slice(0, MESSAGE_MAX),
      (input.source ?? "site").trim().slice(0, 40),
    ],
  );
  return fromRow(rows[0]);
}

/**
 * The inbox, newest first.
 *
 * Bounded, because an inbox that loads every message ever received gets slower
 * every day it succeeds.
 */
export async function getCustomerVoice(options?: {
  kind?: VoiceKind;
  status?: VoiceStatus;
  limit?: number;
}): Promise<CustomerVoice[]> {
  const limit = Math.min(Math.max(Math.trunc(options?.limit ?? 200), 1), 500);
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (options?.kind) {
    params.push(options.kind);
    where.push(`kind = $${params.length}`);
  }
  if (options?.status) {
    params.push(options.status);
    where.push(`status = $${params.length}`);
  }
  params.push(limit);

  const rows = await queryPostgres<VoiceRow>(
    STORE,
    `SELECT ${COLUMNS} FROM customer_voice
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map(fromRow);
}

export type VoiceCounts = {
  total: number;
  waiting: number;
  byKind: Record<VoiceKind, number>;
};

/** Counted in the database rather than by loading every row to count it. */
export async function getVoiceCounts(): Promise<VoiceCounts> {
  const rows = await queryPostgres<{ kind: VoiceKind; status: VoiceStatus; n: string }>(
    STORE,
    `SELECT kind, status, COUNT(*)::int AS n FROM customer_voice GROUP BY kind, status`,
    [],
  );

  const counts: VoiceCounts = {
    total: 0,
    waiting: 0,
    byKind: { review: 0, question: 0, complaint: 0 },
  };

  for (const row of rows) {
    const n = Number(row.n) || 0;
    counts.total += n;
    if (row.status === "new") counts.waiting += n;
    if (row.kind in counts.byKind) counts.byKind[row.kind] += n;
  }
  return counts;
}

export async function setVoiceStatus(id: string, status: VoiceStatus, replyNote = "") {
  await queryPostgres(
    STORE,
    `UPDATE customer_voice
     SET status = $2,
         reply_note = $3,
         -- Stamped the first time it is answered, and left alone after: the
         -- question is how long the customer waited, not when the row was last
         -- touched.
         replied_at = CASE WHEN $2 = 'new' THEN NULL ELSE COALESCE(replied_at, now()) END,
         updated_at = now()
     WHERE id = $1`,
    [id, status, replyNote.trim().slice(0, MESSAGE_MAX)],
  );
}

/** Whether a review appears on the storefront. Off until the owner says so. */
export async function setVoicePublished(id: string, published: boolean) {
  await queryPostgres(
    STORE,
    `UPDATE customer_voice SET published = $2, updated_at = now() WHERE id = $1`,
    [id, published],
  );
}

/**
 * A product's published reviews, for the storefront.
 *
 * Only reviews, only published ones — a question a shopper asked is not a
 * recommendation, and an unapproved review is not one the owner has stood
 * behind.
 */
export async function getPublishedReviews(productId: string): Promise<CustomerVoice[]> {
  const rows = await queryPostgres<VoiceRow>(
    STORE,
    `SELECT ${COLUMNS} FROM customer_voice
     WHERE product_id = $1 AND kind = 'review' AND published = true
     ORDER BY created_at DESC LIMIT 50`,
    [productId],
  );
  return rows.map(fromRow);
}

/** How long a message has been waiting, in whole days. */
export function daysWaiting(voice: CustomerVoice, now = new Date()): number {
  if (voice.status !== "new") return 0;
  const ms = now.getTime() - new Date(voice.createdAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
