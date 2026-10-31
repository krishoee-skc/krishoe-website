import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";
import { designKey } from "@/lib/design-name";
import { getStockOrigins } from "@/lib/operations";
import { getChosenOrigins } from "@/lib/product-origins";
import { getProducts } from "@/lib/product-store";

/**
 * The factory and the shop as two businesses (owner, 2026-10-31, "code garau"):
 * each with its own name and PAN, the shop buying what the factory makes. This
 * file holds what the two need that the shop alone did not: the factory's own
 * details, a made shoe's factory price (what the shop pays; blank means the
 * wholesale price), which business a bill belongs to, and a challan line's
 * price. Also the switch that hides the vehicle work nobody uses yet.
 *
 * One Settings OK adds every column at once. Until then every screen works as
 * before; only these parts stay out of sight.
 */
export const twoBusinessMigrations = [
  {
    name: "20261031_two_businesses.sql",
    label: {
      en: "The factory and the shop as two businesses: the factory's name, PAN and address, a made shoe's factory price, which business a bill is, a challan line's price, and the vehicle switch (new columns only)",
      ne: "कारखाना र पसल दुई व्यापार: कारखानाको नाम, PAN र ठेगाना, बनाएको जुत्ताको कारखाना मूल्य, बिल कसको, challan लाइनको मूल्य, र गाडीको switch (नयाँ column मात्र)",
    },
    columns: [
      "company_settings.factory_name",
      "company_settings.factory_pan",
      "company_settings.factory_address",
      "company_settings.show_vehicles",
      "product_origins.factory_price",
      "pos_invoices.business",
      "pos_invoices.bill_group",
      "stock_transfer_items.unit_price",
    ],
    sql: `-- The factory and the shop as two businesses (owner, 2026-10-31). Additive:
-- new columns with defaults, nothing existing is changed; every old bill reads
-- as the shop's, every old challan line as unpriced. Reversible: drop each
-- column below.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS factory_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS factory_pan text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS factory_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_vehicles boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS product_origins (
  product_id text PRIMARY KEY,
  origin text NOT NULL CHECK (origin IN ('made', 'bought')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);
ALTER TABLE product_origins
  ADD COLUMN IF NOT EXISTS factory_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (factory_price >= 0);

ALTER TABLE pos_invoices
  ADD COLUMN IF NOT EXISTS business text NOT NULL DEFAULT 'shop' CHECK (business IN ('shop', 'factory')),
  ADD COLUMN IF NOT EXISTS bill_group text NOT NULL DEFAULT '';

ALTER TABLE stock_transfer_items
  ADD COLUMN IF NOT EXISTS unit_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0);
`,
  },
  {
    name: "20261031_shop_factory_payments.sql",
    label: {
      en: "What the shop pays the factory for shoes taken on challans (one new table)",
      ne: "challan मा लिएको जुत्ताको पैसा पसलले कारखानालाई तिरेको (नयाँ table मात्र)",
    },
    columns: [
      "shop_factory_payments.id",
      "shop_factory_payments.paid_on",
      "shop_factory_payments.amount",
      "shop_factory_payments.method",
      "shop_factory_payments.removed_at",
    ],
    sql: `-- What the shop pays the factory for the shoes it took on challans (owner,
-- 2026-10-31, two businesses, choice 2(a)). Additive: one new table, nothing
-- existing changes. A wrong entry is marked removed with a reason, never
-- deleted. Reversible: DROP TABLE shop_factory_payments.

CREATE TABLE IF NOT EXISTS shop_factory_payments (
  id text PRIMARY KEY,
  paid_on date NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash', 'Bank', 'Cheque')),
  note text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by text NOT NULL DEFAULT '',
  removed_reason text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS shop_factory_payments_paid_on_idx ON shop_factory_payments (paid_on DESC);
`,
  },
] as const;

const STORE = "two businesses";

// Each step's columns, checked on their own and remembered for a minute: a
// later step waiting for its OK never turns off one already done.
const readyByStep = new Map<string, { ok: boolean; at: number }>();
const RECHECK_MS = 60_000;

export type TwoBusinessDatabaseStatus = {
  ready: boolean;
  pending: { name: string; label: { en: string; ne: string } }[];
};

export async function twoBusinessDatabaseStatus(): Promise<TwoBusinessDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, pending: [] };
  const wanted = twoBusinessMigrations.flatMap((migration) => [...migration.columns]);
  const tables = [...new Set(wanted.map((column) => column.split(".")[0]))];
  const rows = await queryPostgres<{ table_name: string; column_name: string }>(
    STORE,
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ANY($1)`,
    [tables],
  );
  const present = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
  const pending = twoBusinessMigrations
    .filter((migration) => migration.columns.some((column) => !present.has(column)))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

async function stepReady(name: string): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return false;
  const known = readyByStep.get(name);
  if (known?.ok) return true;
  if (known && Date.now() - known.at < RECHECK_MS) return false;
  const ok = await twoBusinessDatabaseStatus()
    .then((status) => !status.pending.some((item) => item.name === name))
    .catch(() => false);
  readyByStep.set(name, { ok, at: Date.now() });
  return ok;
}

/** Whether the two businesses' columns are there (step one), remembered for a minute. */
export async function twoBusinessReady(): Promise<boolean> {
  return stepReady(twoBusinessMigrations[0].name);
}

/** Whether the shop's payments to the factory can be kept (step two). */
export async function shopPaymentsReady(): Promise<boolean> {
  return stepReady(twoBusinessMigrations[1].name);
}

export async function prepareTwoBusinessDatabase() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: [] as string[] };
  const { pending } = await twoBusinessDatabaseStatus();
  if (!pending.length) return { applied: [] as string[] };
  const toApply = twoBusinessMigrations.filter((migration) => pending.some((item) => item.name === migration.name));
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
  readyByStep.clear();
  return { applied: toApply.map((migration) => migration.name) };
}

export type FactoryBusiness = { name: string; pan: string; address: string };

/** The factory's own name, PAN and address; empty until its columns are there. */
export async function getFactoryBusiness(): Promise<FactoryBusiness> {
  const empty = { name: "", pan: "", address: "" };
  if (!(await twoBusinessReady())) return empty;
  const rows = await queryPostgres<{ factory_name: string; factory_pan: string; factory_address: string }>(
    STORE,
    "SELECT factory_name, factory_pan, factory_address FROM company_settings WHERE id = 'default'",
  ).catch(() => []);
  const row = rows[0];
  return row ? { name: row.factory_name, pan: row.factory_pan, address: row.factory_address } : empty;
}

export async function setFactoryBusiness(details: FactoryBusiness) {
  if (!(await twoBusinessReady())) return;
  const clean = (value: string, max: number) => (value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  await queryPostgres(
    STORE,
    // An upsert: a database whose settings row was never written still keeps them.
    `INSERT INTO company_settings (id, factory_name, factory_pan, factory_address) VALUES ('default', $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET factory_name = EXCLUDED.factory_name, factory_pan = EXCLUDED.factory_pan,
       factory_address = EXCLUDED.factory_address, updated_at = now()`,
    [clean(details.name, 120), clean(details.pan, 30), clean(details.address, 200)],
  );
}

/**
 * Whether the vehicle work shows (owner, 2026-10-31: not used, hide it). Off
 * until the Owner turns it on — and off before its column is there too, so the
 * screens are tidy from the day this goes live. Nothing is deleted.
 */
export async function vehiclesShown(): Promise<boolean> {
  if (!(await twoBusinessReady())) return false;
  const rows = await queryPostgres<{ on: boolean }>(STORE, "SELECT show_vehicles AS on FROM company_settings WHERE id = 'default'").catch(() => []);
  return rows[0]?.on ?? false;
}

export async function setVehiclesShown(on: boolean) {
  if (!(await twoBusinessReady())) return;
  await queryPostgres(
    STORE,
    "INSERT INTO company_settings (id, show_vehicles) VALUES ('default', $1) ON CONFLICT (id) DO UPDATE SET show_vehicles = EXCLUDED.show_vehicles",
    [on],
  );
}

/** Every made shoe's factory price, by product id; only those set (above 0). */
export async function getFactoryPrices(): Promise<Record<string, number>> {
  if (!(await twoBusinessReady())) return {};
  try {
    const rows = await queryPostgres<{ product_id: string; factory_price: number | string }>(
      STORE,
      "SELECT product_id, factory_price FROM product_origins WHERE factory_price > 0 LIMIT 5000",
    );
    return Object.fromEntries(rows.map((row) => [row.product_id, Number(row.factory_price) || 0]));
  } catch {
    return {};
  }
}

/**
 * A made shoe's factory price, or 0 to fall back to its wholesale price.
 * Setting one says the shoe is made, so a shoe with no row yet gets one as
 * made; a row already there keeps its word.
 */
export async function setFactoryPrice(productId: string, price: number, by: string) {
  if (!(await twoBusinessReady())) return;
  if (!productId) return;
  const value = Math.max(0, Math.round((Number(price) || 0) * 100) / 100);
  if (value === 0) {
    await queryPostgres(STORE, "UPDATE product_origins SET factory_price = 0, updated_by = $2, updated_at = now() WHERE product_id = $1", [productId, by.slice(0, 80)]);
    return;
  }
  await queryPostgres(
    STORE,
    `INSERT INTO product_origins (product_id, origin, factory_price, updated_by, updated_at)
     VALUES ($1, 'made', $2, $3, now())
     ON CONFLICT (product_id) DO UPDATE SET factory_price = EXCLUDED.factory_price, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [productId, value, by.slice(0, 80)],
  );
}

/** Whether the factory can cut its own bills: the columns are there, and its name and PAN are filled. */
export async function factoryBillsReady(): Promise<boolean> {
  if (!(await twoBusinessReady())) return false;
  const factory = await getFactoryBusiness();
  return Boolean(factory.name.trim() && factory.pan.trim());
}

export type ShoeOrigin = "made" | "bought";

/**
 * Made or bought, by design key: the stock's history first (a shoe the factory
 * ever made counts as made), then what was said by hand on its Item page. A
 * shoe neither says is left out — the counter asks.
 */
export async function shoeOrigins(): Promise<Record<string, ShoeOrigin>> {
  const [history, chosen, products] = await Promise.all([
    getStockOrigins(),
    getChosenOrigins().catch(() => ({}) as Record<string, "made" | "bought">),
    getProducts({ includeDrafts: true }).catch(() => []),
  ]);
  const origins: Record<string, ShoeOrigin> = {};
  for (const product of products) {
    const said = chosen[product.id];
    if (said) origins[designKey(product.name)] = said;
  }
  for (const [key, origin] of history) {
    if (origin.made) origins[key] = "made";
    else if (origin.bought) origins[key] = "bought";
  }
  return origins;
}

/** The price the shop pays the factory for a made shoe: its own, else wholesale. */
export function factoryPriceOf(own: number, wholesale: number) {
  return own > 0 ? own : Math.max(0, wholesale);
}
