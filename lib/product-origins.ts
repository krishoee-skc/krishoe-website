import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Made or bought, said by hand (owner, 2026-10-29): for a shoe whose stock
 * history has neither a factory "Production In" nor a purchase "Purchase In"
 * — pairs put in by an opening count or an adjustment — the Owner says which
 * it is in its form. A shoe whose history does say keeps what it says
 * (lib/stock-origin.ts); this is only read where the history is silent.
 *
 * And what a bought shoe cost a pair (owner, 2026-10-30): one already on the
 * shelf with no purchase bill had nowhere to say it — a bill would have added
 * its pairs a second time. Typed in its form; a purchase bill still wins.
 */
export const productOriginMigrations = [
  {
    name: "20261029_product_origins.sql",
    table: "product_origins",
    column: "",
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
  {
    name: "20261030_product_origin_cost.sql",
    table: "product_origins",
    column: "cost_per_pair",
    label: {
      en: "What a bought shoe cost a pair, typed in its form when it has no purchase bill (1 new column)",
      ne: "खरिद बिल नभएको किनेको जुत्ताको एक जोडी किन्ने दर, त्यसको फारममा लेख्ने (१ नयाँ column)",
    },
    sql: `-- What a bought shoe cost a pair (owner, 2026-10-30), for one already on the
-- shelf with no purchase bill. 0 means not said. Additive: one column with a
-- default, nothing existing is changed. Reversible
-- (ALTER TABLE product_origins DROP COLUMN cost_per_pair).

ALTER TABLE product_origins
  ADD COLUMN IF NOT EXISTS cost_per_pair numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_per_pair >= 0);
`,
  },
] as const;

export type ChosenOrigin = "made" | "bought";

const STORE = "product origins";

type Readiness = { table: boolean; cost: boolean };
let known: Readiness | null = null;
let checkedAt = 0;
const RECHECK_MS = 60_000;

export type ProductOriginsDatabaseStatus = {
  ready: boolean;
  pending: { name: string; label: { en: string; ne: string } }[];
};

async function presentParts() {
  const rows = await queryPostgres<{ table_name: string; column_name: string }>(
    STORE,
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ANY($1)`,
    [[...new Set(productOriginMigrations.map((migration) => migration.table))]],
  );
  return {
    tables: new Set(rows.map((row) => row.table_name)),
    columns: new Set(rows.map((row) => `${row.table_name}.${row.column_name}`)),
  };
}

export async function productOriginsDatabaseStatus(): Promise<ProductOriginsDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, pending: [] };
  const { tables, columns } = await presentParts();
  const pending = productOriginMigrations
    .filter((migration) => (migration.column ? !columns.has(`${migration.table}.${migration.column}`) : !tables.has(migration.table)))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

/** Which parts are there, remembered for a minute once both are. */
async function readiness(): Promise<Readiness> {
  if (getDataBackendConfig().backend !== "postgres") return { table: false, cost: false };
  if (known?.table && known.cost) return known;
  if (known && Date.now() - checkedAt < RECHECK_MS) return known;
  known = await presentParts()
    .then(({ tables, columns }) => ({ table: tables.has("product_origins"), cost: columns.has("product_origins.cost_per_pair") }))
    .catch(() => ({ table: false, cost: false }));
  checkedAt = Date.now();
  return known;
}

/** Whether the made-or-bought table is there. */
export async function productOriginsReady(): Promise<boolean> {
  return (await readiness()).table;
}

/** Whether a bought shoe's cost can be kept (its column is there). */
export async function productOriginCostReady(): Promise<boolean> {
  return (await readiness()).cost;
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
  known = null;
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

/** Every bought shoe's typed cost a pair, by product id; empty until its column is there. */
export async function getChosenCosts(): Promise<Record<string, number>> {
  if (!(await productOriginCostReady())) return {};
  try {
    const rows = await queryPostgres<{ product_id: string; cost_per_pair: number | string }>(
      STORE,
      "SELECT product_id, cost_per_pair FROM product_origins WHERE cost_per_pair > 0 LIMIT 5000",
    );
    return Object.fromEntries(rows.map((row) => [row.product_id, Number(row.cost_per_pair) || 0]));
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

/**
 * Keep what a bought shoe cost a pair, or 0 to take it back. Typing a bought
 * cost says the shoe was bought, so a shoe with no row yet gets one as bought;
 * a row already there keeps its word and only its cost changes.
 */
export async function setChosenCost(productId: string, costPerPair: number, by: string) {
  if (!(await productOriginCostReady())) return;
  if (!productId) return;
  const cost = Math.max(0, Math.round((Number(costPerPair) || 0) * 100) / 100);
  if (cost === 0) {
    await queryPostgres(STORE, "UPDATE product_origins SET cost_per_pair = 0, updated_by = $2, updated_at = now() WHERE product_id = $1", [productId, by.slice(0, 80)]);
    return;
  }
  await queryPostgres(
    STORE,
    `INSERT INTO product_origins (product_id, origin, cost_per_pair, updated_by, updated_at)
     VALUES ($1, 'bought', $2, $3, now())
     ON CONFLICT (product_id) DO UPDATE SET cost_per_pair = EXCLUDED.cost_per_pair, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [productId, cost, by.slice(0, 80)],
  );
}
