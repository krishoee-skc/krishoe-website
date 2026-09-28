import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Getting the live database ready to record how an order was sent, from one
 * Owner button — the same way the delivery and counter-bill columns arrived
 * (lib/delivery-database.ts, lib/pos-database.ts). The SQL is the migration
 * file word for word (a test compares them). It only adds defaulted columns;
 * no status, no stock rule and no existing order changes.
 *
 * Until it is added, the order desk works as before and simply cannot mark an
 * order sent.
 */
export const orderDispatchMigrations = [
  {
    name: "20260929_order_dispatch.sql",
    table: "orders",
    columns: ["dispatched_at", "dispatch_by", "dispatch_charge_paisa", "dispatch_tracking", "cancel_reason"],
    label: {
      en: "Orders: who took it, delivery charge, cancel reason (5 columns)",
      ne: "अर्डर: कसले लग्यो, डेलिभरी शुल्क, रद्दको कारण (५ कोठा)",
    },
    sql: `-- How an online order left the shop, and why one was cancelled.
--
-- The order desk had New, Contacted, Closed and Cancelled, and nowhere to say
-- the pairs were sent, who took them, what the delivery cost or why an order
-- was dropped. The order's status is left exactly as it is: a sent order stays
-- Contacted (so it keeps holding its pairs and counts as a sale everywhere it
-- did), and dispatched_at is what says it is on its way. Converting it to a
-- bill still closes it.
--
--   dispatched_at          when it was sent (NULL = not sent)
--   dispatch_by            who took it: our own person, or a courier's name
--   dispatch_charge_paisa  what the delivery cost, in paisa
--   dispatch_tracking      the courier's number, if any
--   cancel_reason          why it was cancelled, if it was
--
-- Additive, defaulted, reversible (DROP COLUMN each).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at timestamptz DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_by text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_charge_paisa bigint NOT NULL DEFAULT 0 CHECK (dispatch_charge_paisa >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_tracking text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason text NOT NULL DEFAULT '';
`,
  },
] as const;

const STORE = "orders";

// "Ready" is remembered for good — a column is never taken away. "Not ready"
// is asked again after a minute, so the order desk picks up the Owner's button
// without a restart.
let readyAt: boolean | null = null;
let checkedAt = 0;
const RECHECK_MS = 60_000;

/** Whether orders has its dispatch columns. Local files always do. */
export async function orderDispatchReady(): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return true;
  if (readyAt === true) return true;
  if (readyAt === false && Date.now() - checkedAt < RECHECK_MS) return false;
  const { pending } = await orderDispatchDatabaseStatus();
  readyAt = pending.length === 0;
  checkedAt = Date.now();
  return readyAt;
}

export type OrderDispatchDatabaseStatus = {
  ready: boolean;
  pending: { name: string; label: { en: string; ne: string } }[];
};

/** Which dispatch columns the live database still lacks. One catalog read. */
export async function orderDispatchDatabaseStatus(): Promise<OrderDispatchDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, pending: [] };
  const rows = await queryPostgres<{ column_name: string }>(
    STORE,
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = ANY($1)`,
    [orderDispatchMigrations.flatMap((migration) => [...migration.columns])],
  );
  const present = new Set(rows.map((row) => row.column_name));
  const pending = orderDispatchMigrations
    .filter((migration) => migration.columns.some((column) => !present.has(column)))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

/**
 * Adds whatever is missing, in one transaction, and stamps it as applied.
 * Safe to press twice: every statement is IF NOT EXISTS and every stamp is
 * ON CONFLICT DO NOTHING.
 */
export async function prepareOrderDispatchDatabase() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: [] as string[] };
  const { pending } = await orderDispatchDatabaseStatus();
  if (!pending.length) return { applied: [] as string[] };
  const toApply = orderDispatchMigrations.filter((migration) => pending.some((item) => item.name === migration.name));
  await transactionPostgres(STORE, async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    for (const migration of toApply) {
      await db.query(migration.sql);
      await db.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
        [migration.name, migrationChecksum(migration.sql)],
      );
    }
  });
  readyAt = null;
  return { applied: toApply.map((migration) => migration.name) };
}
