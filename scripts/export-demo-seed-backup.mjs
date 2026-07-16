// READ ONLY. Dumps every row the demo-seed cleanup would touch, so the delete
// has a restore path. The backup:export script needs the app running; this
// talks to Postgres directly and works offline.
//
//   node scripts/export-demo-seed-backup.mjs
//
// Writes backups/demo-seed-<timestamp>.json
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

// The catalog seed shipped in lib/products.ts. Any product in the database with
// one of these names came from the seed import, not from the admin.
const SEED_PRODUCT_NAMES = [
  "Signature Ladies Sandals",
  "Cloud Step Slippers",
  "Urban Casual Shoes",
  "Midnight Party Heels",
  "Minimal Flat Sandals",
  "Soft Lift Wedges",
  "Kids Daily Runner",
  "Seasonal Arrival Pair",
];

function databaseUrl() {
  const fromEnv = process.env.DATABASE_URL;

  if (fromEnv) {
    return fromEnv;
  }

  const env = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const match = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);

  if (!match) {
    throw new Error("DATABASE_URL not set and not found in .env.local");
  }

  return match[1];
}

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();
await client.query("SET default_transaction_read_only = on");

const rows = async (sql, params = []) => (await client.query(sql, params)).rows;

const backup = {
  takenAt: new Date().toISOString(),
  note: "Rows matching the lib/products.ts demo seed, captured before cleanup.",
  seedProductNames: SEED_PRODUCT_NAMES,
  products: await rows(`SELECT * FROM products WHERE name = ANY($1)`, [SEED_PRODUCT_NAMES]),
  finishedStock: await rows(`SELECT * FROM finished_stock`),
  stockMovements: await rows(`SELECT * FROM stock_movements`),
  orders: await rows(`SELECT * FROM orders`),
  posInvoices: await rows(`SELECT * FROM pos_invoices`),
};

await client.end();

const dir = path.join(process.cwd(), "backups");
await mkdir(dir, { recursive: true });
const file = path.join(dir, `demo-seed-${backup.takenAt.replaceAll(":", "-")}.json`);
await writeFile(file, JSON.stringify(backup, null, 2));

console.log(`wrote ${file}`);
console.log(`  products (seed names): ${backup.products.length}`);
console.log(`  finished_stock:        ${backup.finishedStock.length}`);
console.log(`  stock_movements:       ${backup.stockMovements.length}`);
console.log(`  orders:                ${backup.orders.length}`);
console.log(`  pos_invoices:          ${backup.posInvoices.length}`);
