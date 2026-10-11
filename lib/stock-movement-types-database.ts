import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * The stock movement types the live database accepts, put right from one
 * Owner button (owner, 2026-10-11).
 *
 * "Damage Out" — a torn or lost pair, or a shelf count that found fewer than
 * the books — is refused by an old CHECK list: the database was rebuilt from a
 * snapshot that still held it, while the migration that widened it stayed
 * stamped as run, so no migration runner would ever put it back. Not one
 * Damage Out stands in the books. This asks the constraint itself rather than
 * schema_migrations, and the button runs the SQL of
 * scripts/migrations/20261011_stock_movement_damage_out_restore.sql word for word.
 */
export const stockMovementTypesMigration = {
  name: "20261011_stock_movement_damage_out_restore.sql",
  label: {
    en: "Let pairs come off the stock as damaged, lost or not found on a count (1 rule widened)",
    ne: "बिग्रेको, हराएको वा गन्दा नभेटिएको जोडी स्टकबाट घटाउन दिने (१ नियम फराकिलो)",
  },
  sql: `-- "Damage Out", put back.
--
-- 20260902_stock_movement_damage_out.sql widened this list, and is stamped as
-- run, but the live database carries the older seven: the database was built
-- again from docs/schema.sql when it moved to Supabase, and that snapshot still
-- held the old list. Since then every write-off — a torn pair, a lost pair, a
-- shelf count that found fewer than the books — has been refused before it was
-- written: not one Damage Out stands in the books (owner, 2026-10-11).
--
-- The same list as that migration, the one lib/stock-rules.ts writes.
-- A CHECK constraint cannot be altered in place, so it is dropped and made
-- again in one statement pair. No row is changed: every row already stored is
-- one of the older seven, all of which stay allowed.

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN (
    'Production In',
    'Purchase In',
    'Dispatch Out',
    'Return In',
    'Sale Out',
    'Market Sale',
    'Adjustment',
    'Damage Out'
  ));
`,
} as const;

/** Every type lib/stock-rules.ts writes (StockMovementType). */
export const STOCK_MOVEMENT_TYPES = [
  "Production In",
  "Purchase In",
  "Dispatch Out",
  "Return In",
  "Sale Out",
  "Market Sale",
  "Adjustment",
  "Damage Out",
] as const;

/** The types a CHECK definition leaves out. Pure, for the tests. */
export function typesMissingFrom(definition: string) {
  return STOCK_MOVEMENT_TYPES.filter((type) => !definition.includes(`'${type}'`));
}

const STORE = "stock movement types";

export type StockMovementTypesStatus = { ready: boolean; missing: string[]; label: { en: string; ne: string } };

/** Which types the live CHECK still refuses. Ready when none, or off Postgres. */
export async function stockMovementTypesStatus(): Promise<StockMovementTypesStatus> {
  const label = stockMovementTypesMigration.label;
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, missing: [], label };
  const rows = await queryPostgres<{ definition: string }>(
    STORE,
    `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conname = 'stock_movements_type_check'`,
  );
  // No CHECK at all refuses nothing.
  if (rows.length === 0) return { ready: true, missing: [], label };
  const missing = typesMissingFrom(rows[0].definition);
  return { ready: missing.length === 0, missing, label };
}

/** Widens the list, stamped as applied. Safe to press twice. */
export async function prepareStockMovementTypes() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: false };
  const { ready } = await stockMovementTypesStatus();
  if (ready) return { applied: false };
  await transactionPostgres(STORE, async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(stockMovementTypesMigration.sql);
    await db.query(
      "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
      [stockMovementTypesMigration.name, migrationChecksum(stockMovementTypesMigration.sql)],
    );
  });
  return { applied: true };
}
