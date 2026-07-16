// Removes the lib/products.ts demo seed from the database.
//
// The seed was imported into production, so the catalog carries eight demo
// shoes and finished_stock carries their pairs — including the 480 Cloud Step
// Slippers that made the shop look stocked while the real products sat at zero.
//
//   node scripts/clean-demo-seed.mjs            # dry run, changes nothing
//   node scripts/clean-demo-seed.mjs --confirm  # actually deletes
//
// Take a backup first: node scripts/export-demo-seed-backup.mjs
//
// Orders are never touched. A real customer may be waiting on one, and no
// demo order can be told apart from a real one by name.
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

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

// finished_stock and stock_movements join the catalog by normalised design name.
const SEED_DESIGNS = ["Cloud Step Slippers", "Kids Daily Runner", "Signature Ladies Sandals"];

const confirm = process.argv.includes("--confirm");

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

const targets = [
  {
    label: "products (demo catalog entries)",
    select: `SELECT id, name, stock FROM products WHERE name = ANY($1)`,
    del: `DELETE FROM products WHERE name = ANY($1)`,
    params: [SEED_PRODUCT_NAMES],
  },
  {
    label: "finished_stock (demo pairs)",
    select: `SELECT design, channel, stock_pairs FROM finished_stock WHERE lower(btrim(design)) = ANY($1)`,
    del: `DELETE FROM finished_stock WHERE lower(btrim(design)) = ANY($1)`,
    params: [SEED_DESIGNS.map((name) => name.toLowerCase())],
  },
  {
    label: "stock_movements (demo movements)",
    select: `SELECT design, channel, type, pairs FROM stock_movements WHERE lower(btrim(design)) = ANY($1)`,
    del: `DELETE FROM stock_movements WHERE lower(btrim(design)) = ANY($1)`,
    params: [SEED_DESIGNS.map((name) => name.toLowerCase())],
  },
];

console.log(confirm ? "DELETING\n" : "DRY RUN — nothing will be changed. Pass --confirm to delete.\n");

let total = 0;

try {
  // One transaction: a half-cleaned catalog is worse than an uncleaned one.
  await client.query("BEGIN");

  for (const target of targets) {
    const { rows } = await client.query(target.select, target.params);
    console.log(`=== ${target.label}: ${rows.length} row(s) ===`);

    if (rows.length > 0) {
      console.table(rows);
    }

    total += rows.length;

    if (confirm && rows.length > 0) {
      await client.query(target.del, target.params);
    }
  }

  if (confirm) {
    await client.query("COMMIT");
    console.log(`\nDeleted ${total} row(s).`);
    console.log("Your real products are untouched, and so are orders.");
  } else {
    await client.query("ROLLBACK");
    console.log(`\nWould delete ${total} row(s). Re-run with --confirm to do it.`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Rolled back, nothing changed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
