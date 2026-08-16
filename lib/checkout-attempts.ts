import { queryPostgres } from "@/lib/postgres/client";

export type CheckoutAttempt = {
  id: string;
  createdAt: string;
  email: string;
  name: string;
  phone: string;
  itemCount: number;
  totalPaisa: number;
  summary: string;
};

type AttemptRow = {
  id: string;
  created_at: Date | string;
  email: string;
  name: string;
  phone: string;
  item_count: number | string;
  total_paisa: number | string;
  summary: string;
};

const STORE = "orders";

function attemptFromRow(row: AttemptRow): CheckoutAttempt {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    email: row.email,
    name: row.name ?? "",
    phone: row.phone ?? "",
    itemCount: Math.max(0, Math.round(Number(row.item_count) || 0)),
    totalPaisa: Math.max(0, Math.round(Number(row.total_paisa) || 0)),
    summary: row.summary ?? "",
  };
}

function normalizeEmail(email: string) {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Remembers a basket that reached the checkout page and stopped.
 *
 * One row per shopper, updated in place: someone who opens checkout three times
 * in an evening has one basket, not three, and must never receive three
 * reminders. Coming back also resets the clock, because they are still
 * deciding — the reminder is for someone who walked away, not someone still
 * standing at the counter.
 */
export async function recordCheckoutAttempt(input: {
  email: string;
  name: string;
  phone: string;
  itemCount: number;
  totalPaisa: number;
  summary: string;
}) {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@") || input.itemCount <= 0) return;

  await queryPostgres<{ id: string }>(
    STORE,
    `INSERT INTO checkout_attempts (
       id, email, name, phone, item_count, total_paisa, summary
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (lower(email)) DO UPDATE SET
       name = EXCLUDED.name,
       phone = EXCLUDED.phone,
       item_count = EXCLUDED.item_count,
       total_paisa = EXCLUDED.total_paisa,
       summary = EXCLUDED.summary,
       created_at = now(),
       updated_at = now(),
       reminded_at = NULL,
       recovered_order_id = NULL
     RETURNING id`,
    [
      `KRS-CHK-${Date.now().toString(36).toUpperCase()}`,
      email,
      input.name.slice(0, 120),
      input.phone.slice(0, 40),
      Math.max(0, Math.round(input.itemCount)),
      Math.max(0, Math.round(input.totalPaisa)),
      input.summary.slice(0, 300),
    ],
  );
}

/**
 * Closes the loop when the order finally arrives.
 *
 * Called on every completed order, whether or not a reminder was ever sent —
 * an attempt that turned into an order on its own must stop being a candidate,
 * and the order id is what lets the shop see whether the reminders are worth
 * sending at all.
 */
export async function markCheckoutRecovered(email: string, orderId: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  await queryPostgres<{ id: string }>(
    STORE,
    `UPDATE checkout_attempts
     SET recovered_order_id = $2, updated_at = now()
     WHERE lower(email) = $1 AND recovered_order_id IS NULL
     RETURNING id`,
    [normalized, orderId],
  );
}

/**
 * Baskets worth one reminder.
 *
 * Left at least a few hours, so nobody is chased while they are still choosing,
 * and not older than a week, because a message about a basket someone forgot
 * eight days ago reads as a shop that was watching rather than one that was
 * helpful.
 */
export async function listAttemptsToRemind(options: { minHours?: number; maxDays?: number } = {}) {
  const minHours = options.minHours ?? 4;
  const maxDays = options.maxDays ?? 7;

  const rows = await queryPostgres<AttemptRow>(
    STORE,
    `SELECT id, created_at, email, name, phone, item_count, total_paisa, summary
     FROM checkout_attempts
     WHERE reminded_at IS NULL
       AND recovered_order_id IS NULL
       AND created_at < now() - ($1 || ' hours')::interval
       AND created_at > now() - ($2 || ' days')::interval
     ORDER BY created_at ASC
     LIMIT 50`,
    [String(minHours), String(maxDays)],
  );

  return rows.map(attemptFromRow);
}

export async function markAttemptReminded(id: string) {
  await queryPostgres<{ id: string }>(
    STORE,
    `UPDATE checkout_attempts SET reminded_at = now(), updated_at = now()
     WHERE id = $1 RETURNING id`,
    [id],
  );
}
