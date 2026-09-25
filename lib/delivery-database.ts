import { createHash } from "node:crypto";
import { getDataBackendConfig } from "@/lib/data-backend";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Getting the live database ready for delivery charges, from one Owner button.
 *
 * The two delivery migrations have to be run against the live database, and
 * its address is marked Sensitive in the hosting settings — nobody can read it
 * out, which is right. So instead of taking the address to the migrations,
 * the migrations come to the app, which already holds it: Settings shows the
 * Owner what would be added, and adds it on "OK".
 *
 * The SQL here is the migration files' own, word for word (a test compares
 * them), and each is stamped in schema_migrations with the same checksum the
 * migration script uses, so `npm run db:migrate:factory` later sees them as
 * applied and moves on. Both only add columns with defaults; nothing existing
 * is changed or removed. One transaction: all of it, or none of it.
 */

export const deliveryMigrations = [
  {
    name: "20260923_delivery_charge.sql",
    columns: ["delivery_fee_paisa", "free_delivery_over_paisa"],
    label: { en: "Delivery charge (2 columns)", ne: "Delivery शुल्क (२ कोठा)" },
    sql: `-- The owner's delivery charge, set from Settings instead of promised in copy.
--
-- The shop told customers "free delivery over NPR 2000" in three places and
-- "Free Shipping" in a fourth, while no code charged a fee or granted the free
-- one. These two numbers are what every screen and the checkout now read:
--
--   delivery_fee_paisa        flat courier charge; 0 = confirmed on the call
--   free_delivery_over_paisa  orders at or above this go free; 0 = no threshold
--
-- The defaults keep today's promise exactly: free over NPR 2000, anything under
-- it confirmed on the call. Additive, defaulted, reversible. The order's own
-- delivery charge needs no column: it is total - subtotal + discount.

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS delivery_fee_paisa bigint NOT NULL DEFAULT 0 CHECK (delivery_fee_paisa >= 0);
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS free_delivery_over_paisa bigint NOT NULL DEFAULT 200000 CHECK (free_delivery_over_paisa >= 0);
`,
  },
  {
    name: "20260925_delivery_zones.sql",
    columns: ["delivery_zones"],
    label: { en: "Charge by area (1 column)", ne: "ठाउँअनुसार शुल्क (१ कोठा)" },
    sql: `-- Delivery charged by area, set by the owner in Settings.
--
-- One flat courier fee overcharged the customer next door and undercharged the
-- one across the country. The owner names up to eight areas, each with its own
-- fee (0 = free to that area), and the customer picks theirs at checkout:
--
--   delivery_zones  [{ "id": "z1", "name": "Inside Chitwan", "feePaisa": 0 }, …]
--
-- An empty list — the default — keeps the flat fee from
-- 20260923_delivery_charge.sql exactly as it is. Additive, defaulted,
-- reversible (DROP COLUMN delivery_zones).

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS delivery_zones jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(delivery_zones) = 'array');
`,
  },
] as const;

const STORE = "admin settings";

/** The migration script's fingerprint: sha256, blind to line endings. */
export function migrationChecksum(sql: string) {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

export type DeliveryDatabaseStatus =
  /** Not a Postgres shop (local files): nothing to prepare. */
  | { ready: true; pending: [] }
  | { ready: boolean; pending: { name: string; label: { en: string; ne: string } }[] };

/**
 * Which delivery migrations the live database still lacks — judged by the
 * columns themselves, not only the stamps, so a column added by hand counts.
 * One small read of the catalog; nothing is changed.
 */
export async function deliveryDatabaseStatus(): Promise<DeliveryDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, pending: [] };

  const rows = await queryPostgres<{ column_name: string }>(
    STORE,
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'company_settings'
        AND column_name = ANY($1)
      LIMIT 10`,
    [deliveryMigrations.flatMap((migration) => [...migration.columns])],
  );
  const present = new Set(rows.map((row) => row.column_name));
  const pending = deliveryMigrations
    .filter((migration) => migration.columns.some((column) => !present.has(column)))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

/**
 * Adds whatever is missing, in one transaction, and stamps it as applied.
 * Safe to press twice: every statement is IF NOT EXISTS and every stamp is
 * ON CONFLICT DO NOTHING.
 */
export async function prepareDeliveryDatabase() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: [] as string[] };

  const { pending } = await deliveryDatabaseStatus();
  if (!pending.length) return { applied: [] as string[] };

  const toApply = deliveryMigrations.filter((migration) => pending.some((item) => item.name === migration.name));
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
  return { applied: toApply.map((migration) => migration.name) };
}
