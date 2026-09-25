import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Getting the live database ready for bills paid in parts, from one Owner button.
 *
 * The same way the delivery columns arrive (lib/delivery-database.ts): the live
 * database's address is Sensitive and cannot be read out, so the migration
 * comes to the app, which already holds it. Settings shows the Owner what would
 * be added and adds it on "OK". The SQL is the migration file's own, word for
 * word (a test compares them), stamped in schema_migrations with the checksum
 * the migration script uses. It only adds one defaulted column.
 *
 * Until it is added, the counter works exactly as before and simply does not
 * offer the parts — a split payment, an exchange in one bill, the old credit
 * cleared on the bill.
 */

export const posMigrations = [
  {
    name: "20260926_pos_invoice_payments.sql",
    table: "pos_invoices",
    columns: ["payments"],
    label: { en: "Bills paid in parts (1 column)", ne: "भाग-भागमा तिरेको बिल (१ कोठा)" },
    sql: `-- How a counter bill was paid, part by part.
--
-- A bill carried one payment method and one paid amount, which cannot say
-- "Rs 1,000 in cash and the rest by QR", "the old pair came back and paid for
-- most of the new one", or "and last month's credit was cleared too". Each of
-- those is one entry here (see lib/pos-payments.ts):
--
--   payments  [{ "method": "Cash", "amount": 1000, "purpose": "bill" },
--              { "method": "QR", "amount": 1600, "purpose": "bill", "reference": "88123" }]
--
-- An empty list — the default, and every bill saved before this — reads
-- exactly as before: the bill's one method and its paid amount. Additive,
-- defaulted, reversible (DROP COLUMN payments).

ALTER TABLE pos_invoices ADD COLUMN IF NOT EXISTS payments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(payments) = 'array');
`,
  },
] as const;

const STORE = "pos invoices";

// "Ready" is remembered for good — a column is never taken away. "Not ready"
// is asked again after a minute, so the counter picks up the Owner's button
// without a restart.
let readyAt: boolean | null = null;
let checkedAt = 0;
const RECHECK_MS = 60_000;

/** Whether pos_invoices has its payments column. Local files always do. */
export async function posPaymentsReady(): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return true;
  if (readyAt === true) return true;
  if (readyAt === false && Date.now() - checkedAt < RECHECK_MS) return false;

  const { pending } = await posDatabaseStatus();
  readyAt = pending.length === 0;
  checkedAt = Date.now();
  return readyAt;
}

export type PosDatabaseStatus = {
  ready: boolean;
  pending: { name: string; label: { en: string; ne: string } }[];
};

/**
 * Which bill migrations the live database still lacks — judged by the columns
 * themselves, so a column added by hand counts. One catalog read; no change.
 */
export async function posDatabaseStatus(): Promise<PosDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, pending: [] };

  const rows = await queryPostgres<{ table_name: string; column_name: string }>(
    STORE,
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ANY($1)
        AND column_name = ANY($2)
      LIMIT 20`,
    [
      [...new Set(posMigrations.map((migration) => migration.table))],
      posMigrations.flatMap((migration) => [...migration.columns]),
    ],
  );
  const present = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
  const pending = posMigrations
    .filter((migration) => migration.columns.some((column) => !present.has(`${migration.table}.${column}`)))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

/**
 * Adds whatever is missing, in one transaction, and stamps it as applied.
 * Safe to press twice: every statement is IF NOT EXISTS and every stamp is
 * ON CONFLICT DO NOTHING.
 */
export async function preparePosDatabase() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: [] as string[] };

  const { pending } = await posDatabaseStatus();
  if (!pending.length) return { applied: [] as string[] };

  const toApply = posMigrations.filter((migration) => pending.some((item) => item.name === migration.name));
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
