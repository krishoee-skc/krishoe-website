import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { designKey } from "@/lib/design-name";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Getting the live database ready for goods added from the counter bill, from
 * one Owner button — the way the delivery, bill and order-dispatch columns
 * arrived (lib/delivery-database.ts). The SQL is the migration file word for
 * word (a test compares them). It only creates a new table; nothing existing
 * changes.
 *
 * Until it is added, the counter cannot add new goods and says so.
 */
export const counterItemsMigrations = [
  {
    name: "20260929_counter_items.sql",
    table: "counter_items",
    label: {
      en: "New goods from the counter bill (1 new table)",
      ne: "बिल काट्ने पेजबाट थपिने नयाँ माल (१ नयाँ तालिका)",
    },
    sql: `-- Goods first put on the books from the counter bill.
--
-- The shop had pairs on its shelves that were never entered — no purchase
-- bill, sometimes a bill still to come — and the counter could not sell them.
-- Such goods are now added from the bill itself; this table remembers how each
-- arrived, what one pair cost when that is known, who added it, and whether
-- the Owner has looked at it. The pairs themselves are ordinary stock rows and
-- movements; nothing here is counted twice.
--
--   how            'old' (already on the shelf), 'pending_bill' (arrived, bill
--                  to come), 'factory' (made here)
--   supplier_name  who it came from, for a bill still to come
--   cost_per_pair  rupees; 0 when not known ("cost to come")
--   reviewed_at    when the Owner looked at it; NULL until then
--   bill_linked_at when the supplier's bill was matched to it; NULL until then
--
-- Additive: a new table, nothing existing is changed. Reversible (DROP TABLE).

CREATE TABLE IF NOT EXISTS counter_items (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  design text NOT NULL,
  product_id text NOT NULL DEFAULT '',
  how text NOT NULL DEFAULT 'old' CHECK (how IN ('old', 'pending_bill', 'factory')),
  supplier_name text NOT NULL DEFAULT '',
  supplier_bill_no text NOT NULL DEFAULT '',
  pairs integer NOT NULL DEFAULT 0 CHECK (pairs >= 0),
  size_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  retail_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (retail_price >= 0),
  cost_per_pair numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_per_pair >= 0),
  created_by text NOT NULL DEFAULT '',
  reviewed_at timestamptz DEFAULT NULL,
  reviewed_by text NOT NULL DEFAULT '',
  bill_linked_at timestamptz DEFAULT NULL,
  purchase_invoice_id text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS counter_items_design_idx ON counter_items (lower(design));
CREATE INDEX IF NOT EXISTS counter_items_open_idx ON counter_items (created_at) WHERE reviewed_at IS NULL;
`,
  },
  {
    name: "20261009_counter_sold_first.sql",
    table: "counter_sold_first",
    label: {
      en: "Sell a new shoe first, fill its stock later (1 new table)",
      ne: "नयाँ जुत्ता पहिले बेच्ने, स्टक पछि भर्ने (१ नयाँ तालिका)",
    },
    sql: `-- Goods sold at the counter before their stock was put in.
--
-- The counter used to ask for every pair on the shelf before a new shoe could
-- be sold (owner, 2026-10-09: "we know the pairs when we enter the purchase
-- bill — at the counter, write how many are sold and cut the bill"). Now a new
-- shoe is added with only the pairs being sold; this table remembers that its
-- stock is still to be filled, and how it was filled — from the supplier's
-- purchase bill, or by counting the shelf.
--
--   counter_item_id  the counter_items row the shoe was added as
--   sold_pairs       pairs sold when it was added (its stock-in so far)
--   sold_sizes       the same, by size
--   filled_at        when the stock was filled; NULL until then
--   filled_how       'bill' (purchase bill) or 'count' (counted on the shelf)
--   filled_pairs     pairs the fill added
--
-- Additive: a new table, nothing existing is changed. Reversible (DROP TABLE).

CREATE TABLE IF NOT EXISTS counter_sold_first (
  counter_item_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  sold_pairs integer NOT NULL DEFAULT 0 CHECK (sold_pairs >= 0),
  sold_sizes jsonb NOT NULL DEFAULT '{}'::jsonb,
  filled_at timestamptz DEFAULT NULL,
  filled_how text NOT NULL DEFAULT '' CHECK (filled_how IN ('', 'bill', 'count')),
  filled_pairs integer NOT NULL DEFAULT 0 CHECK (filled_pairs >= 0),
  filled_by text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS counter_sold_first_open_idx ON counter_sold_first (created_at) WHERE filled_at IS NULL;
`,
  },
] as const;

const STORE = "counter items";

// "Ready" is remembered for good — a table is never taken away. "Not ready"
// is asked again after a minute, so the counter picks up the Owner's button
// without a restart.
let readyAt: boolean | null = null;
let checkedAt = 0;
const RECHECK_MS = 60_000;

/** Whether counter_items exists. Local files never do: the counter adds nothing there. */
export async function counterItemsReady(): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return false;
  if (readyAt === true) return true;
  if (readyAt === false && Date.now() - checkedAt < RECHECK_MS) return false;
  const { pending } = await counterItemsDatabaseStatus();
  readyAt = pending.length === 0;
  checkedAt = Date.now();
  return readyAt;
}

export type CounterItemsDatabaseStatus = {
  ready: boolean;
  pending: { name: string; label: { en: string; ne: string } }[];
};

/** Which of the tables the live database still lacks. One catalog read. */
export async function counterItemsDatabaseStatus(): Promise<CounterItemsDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, pending: [] };
  const rows = await queryPostgres<{ table_name: string }>(
    STORE,
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ANY($1)`,
    [counterItemsMigrations.map((migration) => migration.table)],
  );
  const present = new Set(rows.map((row) => row.table_name));
  const pending = counterItemsMigrations
    .filter((migration) => !present.has(migration.table))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

/**
 * Adds whatever is missing, in one transaction, and stamps it as applied.
 * Safe to press twice: every statement is IF NOT EXISTS and every stamp is
 * ON CONFLICT DO NOTHING.
 */
export async function prepareCounterItemsDatabase() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: [] as string[] };
  const { pending } = await counterItemsDatabaseStatus();
  if (!pending.length) return { applied: [] as string[] };
  const toApply = counterItemsMigrations.filter((migration) => pending.some((item) => item.name === migration.name));
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

/**
 * What one pair cost, as typed at the counter, by design. The latest figure
 * given wins. Empty when the table is not there yet, so costing never fails
 * for want of it.
 */
export async function getCounterItemCosts(): Promise<Map<string, number>> {
  if (!(await counterItemsReady().catch(() => false))) return new Map();
  const rows = await queryPostgres<{ design: string; cost_per_pair: number | string }>(
    STORE,
    `SELECT DISTINCT ON (lower(design)) design, cost_per_pair
       FROM counter_items
      WHERE cost_per_pair > 0
      ORDER BY lower(design), created_at DESC`,
  );
  return new Map(rows.map((row) => [designKey(row.design), Number(row.cost_per_pair) || 0]));
}
