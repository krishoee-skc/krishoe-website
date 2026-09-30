import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * The notification kinds the live database accepts, put right from one Owner
 * button (owner, 2026-09-30).
 *
 * The buyer's "your order is placed" mail and the review request are refused
 * by an old CHECK list: the database was rebuilt from a snapshot that still
 * held it, while the migration that widened it stayed stamped as run — so no
 * migration runner would ever put it back. This asks the constraint itself
 * rather than schema_migrations, and the button runs the SQL of
 * scripts/migrations/20260930_notification_types_restore.sql word for word.
 */
export const notificationTypesMigration = {
  name: "20260930_notification_types_restore.sql",
  label: {
    en: "Let the customer's order and review mails be recorded (1 rule widened)",
    ne: "ग्राहकको अर्डर र review email रेकर्ड हुन दिने (१ नियम फराकिलो)",
  },
  sql: `-- The notification kinds, put back.
--
-- 20260823_order_confirmation_type.sql widened this list, and is stamped as
-- run, but the live database carries the older five: the database was built
-- again from docs/schema.sql when it moved to Supabase, and that snapshot still
-- held the old list. Since then the buyer's "your order is placed" mail has
-- been refused by this CHECK before it was written — the only online order so
-- far, on 2026-09-27, got none — and the review request a week after an order
-- would be refused the same way (owner, 2026-09-30).
--
-- The same list as that migration, the one lib/notifications.ts writes.
-- A CHECK constraint cannot be altered in place, so it is dropped and made
-- again in one statement pair. No row is changed: every row already stored is
-- one of the older five, all of which stay allowed.

ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events ADD CONSTRAINT notification_events_type_check
  CHECK (type IN (
    'order',
    'contact',
    'password-reset',
    'email-verification',
    'staff-security',
    'review-request',
    'order-confirmation',
    'operational-alert'
  ));
`,
} as const;

/** Every kind lib/notifications.ts writes (NotificationEventType). */
export const NOTIFICATION_KINDS = [
  "order",
  "contact",
  "password-reset",
  "email-verification",
  "staff-security",
  "review-request",
  "order-confirmation",
  "operational-alert",
] as const;

/** The kinds a CHECK definition leaves out. Pure, for the tests. */
export function kindsMissingFrom(definition: string) {
  return NOTIFICATION_KINDS.filter((kind) => !definition.includes(`'${kind}'`));
}

const STORE = "notification types";

export type NotificationTypesStatus = { ready: boolean; missing: string[]; label: { en: string; ne: string } };

/** Which kinds the live CHECK still refuses. Ready when none, or off Postgres. */
export async function notificationTypesStatus(): Promise<NotificationTypesStatus> {
  const label = notificationTypesMigration.label;
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, missing: [], label };
  const rows = await queryPostgres<{ definition: string }>(
    STORE,
    `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conname = 'notification_events_type_check'`,
  );
  // No CHECK at all refuses nothing.
  if (rows.length === 0) return { ready: true, missing: [], label };
  const missing = kindsMissingFrom(rows[0].definition);
  return { ready: missing.length === 0, missing, label };
}

/** Widens the list, stamped as applied. Safe to press twice. */
export async function prepareNotificationTypes() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: false };
  const { ready } = await notificationTypesStatus();
  if (ready) return { applied: false };
  await transactionPostgres(STORE, async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(notificationTypesMigration.sql);
    await db.query(
      "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
      [notificationTypesMigration.name, migrationChecksum(notificationTypesMigration.sql)],
    );
  });
  return { applied: true };
}
