import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Made or bought, said by hand (owner, 2026-10-29): for a shoe whose stock
 * history has neither a factory "Production In" nor a purchase "Purchase In"
 * — pairs put in by an opening count or an adjustment — the Owner says which
 * it is in its form. A shoe whose history does say keeps what it says
 * (lib/stock-origin.ts); this is only read where the history is silent.
 */
export const productOriginMigrations = [
  {
    name: "20261029_product_origins.sql",
    table: "product_origins",
    label: {
      en: "Made or bought, said by hand for shoes whose stock history does not say (1 new table)",
      ne: "बनाएको कि किनेको — स्टक इतिहासले नभनेका जुत्तामा हातले छान्ने (१ नयाँ तालिका)",
    },
    sql: `-- Made or bought, said by hand (owner, 2026-10-29), for a shoe whose stock
-- history has no Production In or Purchase In. One row a shoe; no row means
-- not said. Additive: a new table, nothing existing is changed. Reversible
-- (DROP TABLE product_origins).

CREATE TABLE IF NOT EXISTS product_origins (
  product_id text PRIMARY KEY,
  origin text NOT NULL CHECK (origin IN ('made', 'bought')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);
`,
  },
] as const;

export type ChosenOrigin = "made" | "bought";

const STORE = "product origins";

let ready: boolean | null = null;
let checkedAt = 0;
const RECHECK_MS = 60_000;

export type ProductOriginsDatabaseStatus = {
  ready: boolean;
  pending: { name: string; label: { en: string; ne: string } }[];
};

export async function productOriginsDatabaseStatus(): Promise<ProductOriginsDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, pending: [] };
  const rows = await queryPostgres<{ table_name: string }>(
    STORE,
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ANY($1)`,
    [productOriginMigrations.map((migration) => migration.table)],
  );
  const present = new Set(rows.map((row) => row.table_name));
  const pending = productOriginMigrations
    .filter((migration) => !present.has(migration.table))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

/** Whether the table is there, remembered for a minute. */
export async function productOriginsReady(): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return false;
  if (ready === true) return true;
  if (ready === false && Date.now() - checkedAt < RECHECK_MS) return false;
  ready = (await productOriginsDatabaseStatus().catch(() => ({ ready: false }))).ready;
  checkedAt = Date.now();
  return ready;
}

export async function prepareProductOriginsDatabase() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: [] as string[] };
  const { pending } = await productOriginsDatabaseStatus();
  if (!pending.length) return { applied: [] as string[] };
  const toApply = productOriginMigrations.filter((migration) => pending.some((item) => item.name === migration.name));
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
  ready = null;
  return { applied: toApply.map((migration) => migration.name) };
}

/** Every shoe's hand-said origin, by product id; empty until the table is there. */
export async function getChosenOrigins(): Promise<Record<string, ChosenOrigin>> {
  if (!(await productOriginsReady())) return {};
  try {
    const rows = await queryPostgres<{ product_id: string; origin: ChosenOrigin }>(
      STORE,
      "SELECT product_id, origin FROM product_origins LIMIT 5000",
    );
    return Object.fromEntries(rows.map((row) => [row.product_id, row.origin]));
  } catch {
    return {};
  }
}

/** Say a shoe is made or bought, or "" to take the word back. */
export async function setChosenOrigin(productId: string, origin: ChosenOrigin | "", by: string) {
  if (!(await productOriginsReady())) return;
  if (!productId) return;
  if (origin === "") {
    await queryPostgres(STORE, "DELETE FROM product_origins WHERE product_id = $1", [productId]);
    return;
  }
  await queryPostgres(
    STORE,
    `INSERT INTO product_origins (product_id, origin, updated_by, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (product_id) DO UPDATE SET origin = EXCLUDED.origin, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [productId, origin, by.slice(0, 80)],
  );
}
