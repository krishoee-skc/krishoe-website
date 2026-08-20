#!/usr/bin/env node
/**
 * Clears the data KRISHOE entered while learning the app, and keeps the setup.
 *
 * The shop spent weeks practising: placing orders on itself, ringing up POS
 * bills, entering factory work at invented rates. All of it is real rows in the
 * live database, and from today the owner is entering real trade. Left in
 * place, the first month's wages, profit and stock would be the sum of practice
 * and reality with no way to separate them afterwards.
 *
 * This is deliberately NOT clean-business-start.mjs. That script predates the
 * factory_* tables, so it leaves the practice wage ledger, the worker balances
 * and the monthly summaries behind, and it preserves hr_employees, which the
 * owner has confirmed were practice. It also cannot make the per-row decisions
 * this needs: four of fourteen products are real and stay, the rest go.
 *
 * Every choice below was confirmed by the owner, item by item, before this
 * file was written.
 *
 * Dry run unless --confirm-clean-trial-data is passed. It writes a full JSON
 * backup of everything it is about to remove before removing any of it.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const confirmationFlag = "--confirm-clean-trial-data";
const confirmed = process.argv.includes(confirmationFlag);

/**
 * Products the owner entered themselves and confirmed as real.
 *
 * Kept by name rather than by id so this file can be read and checked by the
 * person who has to live with the result. Everything else in `products` is
 * either sample data that shipped with the app or, in one case, an entry with
 * no price that the owner asked to remove.
 */
const KEEP_PRODUCTS = ["Doctor Chappal moto", "bag open", "halka fom", "jeans shoes"];

/**
 * Emptied completely.
 *
 * Ordered so a table is listed before anything it depends on is needed; they
 * are truncated in one statement, which resolves the foreign keys among them
 * together.
 *
 * factory_rates is here because the owner confirmed the fifteen practice rates
 * are wrong. Nothing can be entered against a worker until new ones exist —
 * that is the one thing to do first after this runs.
 */
/**
 * Emptied with DELETE rather than TRUNCATE, and why it has to be that way.
 *
 * Postgres refuses to truncate a table that a foreign key points at unless the
 * referring table is truncated in the same breath — and both of these are
 * pointed at by tables the shop is keeping: production_items by factory_items,
 * hr_employees by factory_workers and admin_staff_accounts.
 *
 * DELETE respects the same constraints but checks them row by row, so it
 * succeeds precisely because no surviving row actually refers to these. That
 * was verified before this list was written: all nine factory items have a null
 * production_item_id, and all eight workers a null hr_employee_id. If a link is
 * ever made, this will fail loudly rather than quietly orphan it — which is the
 * behaviour worth having.
 */
const CLEAR_BY_DELETE = ["production_items", "hr_employees"];

const CLEAR = [
  // Shop
  "order_items",
  "orders",
  "pos_invoices",
  "payment_transactions",
  "contact_messages",
  // Stock, in every form it is held
  "stock_movements",
  "finished_stock",
  "branch_product_stock",
  // Factory — the wage ledger and everything derived from it
  "factory_daily_work",
  "factory_worker_ledger",
  "factory_monthly_summary",
  "factory_weekly_advance",
  "factory_rates",
  "worker_payments",
  "worker_tasks",
  "factory_wage_settlement_entries",
  "factory_wage_settlements",
  "factory_production_entry_sizes",
  "factory_production_entries",
  "factory_stage_handover_sizes",
  "factory_stage_handovers",
  "factory_stage_assignments",
  "factory_work_order_sizes",
  "factory_work_orders",
  "factory_packing_approvals",
  "factory_material_issues",
  "factory_item_bom",
  "factory_item_stage_rates",
  "factory_worker_links",
  "factory_production_items",
  "factory_cctv_references",
  // The parallel production ledger, all of it practice
  "production_qc_postings",
  "production_stage_handovers",
  "production_work_entries",
  "production_worker_stage_rates",
  "production_stage_rates",
  "production_material_consumptions",
  "production_item_materials",
  "production_cost_cards",
  "production_work_orders",
  "production_batches",
  "production_cctv_references",
  // Purchasing and materials
  "purchase_invoice_items",
  "purchase_invoices",
  "supplier_transactions",
  "supplier_ledgers",
  "material_consumptions",
  "raw_materials",
  // Money owed
  "customer_ledgers",
  "ledger_transactions",
  // Dispatch
  "vehicle_dispatch_items",
  "vehicle_dispatches",
  // HR — confirmed as practice
  "hr_attendance",
  "hr_payroll",
  // Operational noise from weeks of practising
  "notification_events",
  "admin_audit_events",
  "rate_limit_attempts",
  // Neon's own sample table, never ours
  "playing_with_neon",
];

/** Kept, and reported after the run so the owner can see they survived. */
const PRESERVE = [
  "products",
  "factory_workers",
  "factory_items",
  "admin_staff_accounts",
  "company_branches",
  "company_settings",
  "costing_settings",
  "users",
  "push_subscriptions",
  "admin_passkeys",
];

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]*)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function stamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

loadEnvLocal();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");

const client = new pg.Client(postgresConnectionOptions(process.env.DATABASE_URL));
await client.connect();

try {
  const present = new Set(
    (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map(
      (row) => row.tablename,
    ),
  );
  const targets = CLEAR.filter((table) => present.has(table));
  const deleteTargets = CLEAR_BY_DELETE.filter((table) => present.has(table));

  const clearing = {};
  for (const table of [...targets, ...deleteTargets]) {
    const count = Number((await client.query(`SELECT COUNT(*) AS c FROM ${table}`)).rows[0].c);
    if (count > 0) clearing[table] = count;
  }

  const doomedProducts = (
    await client.query(
      `SELECT id, name, price_value / 100 AS rupees, stock, status
         FROM products WHERE name <> ALL($1) ORDER BY name`,
      [KEEP_PRODUCTS],
    )
  ).rows;

  const keptProducts = (
    await client.query(
      `SELECT name, price_value / 100 AS rupees, stock FROM products WHERE name = ANY($1) ORDER BY name`,
      [KEEP_PRODUCTS],
    )
  ).rows;

  const preserved = {};
  for (const table of PRESERVE) {
    if (!present.has(table)) continue;
    preserved[table] = Number((await client.query(`SELECT COUNT(*) AS c FROM ${table}`)).rows[0].c);
  }

  console.log(
    JSON.stringify(
      {
        mode: confirmed ? "CONFIRMED — will delete" : "DRY RUN — nothing deleted",
        clearing,
        productsToDelete: doomedProducts.map((row) => `${row.name} (Rs ${row.rupees}, stock ${row.stock})`),
        productsToKeep: keptProducts.map((row) => `${row.name} (Rs ${row.rupees}, stock ${row.stock})`),
        preserved,
      },
      null,
      2,
    ),
  );

  if (!confirmed) {
    console.log(`\nNothing was changed. Re-run with ${confirmationFlag} to execute.`);
    process.exit(0);
  }

  // Backed up before anything is touched. The owner can re-read a JSON file;
  // they cannot re-read a truncated table.
  const snapshot = { takenAt: new Date().toISOString(), clearing, doomedProducts, data: {} };
  for (const table of [...targets, ...deleteTargets]) {
    snapshot.data[table] = (await client.query(`SELECT * FROM ${table}`)).rows;
  }
  snapshot.data.products = (await client.query("SELECT * FROM products")).rows;

  const backupDirectory = path.join(process.cwd(), "backups");
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `clean-trial-data-pre-${stamp()}.json`);
  await writeFile(backupPath, JSON.stringify(snapshot, null, 2), { encoding: "utf8", mode: 0o600 });

  await client.query("BEGIN");
  try {
    // One statement, so foreign keys between these tables resolve together
    // rather than in whatever order the list happens to be in.
    await client.query(`TRUNCATE TABLE ${targets.join(", ")} RESTART IDENTITY`);

    // After the truncate, so the rows that referenced these are already gone.
    for (const table of deleteTargets) {
      await client.query(`DELETE FROM ${table}`);
    }

    // Products go after, because the rows that referenced them are gone by now.
    await client.query("DELETE FROM products WHERE name <> ALL($1)", [KEEP_PRODUCTS]);

    // The four that remain keep their names and prices and lose their stock.
    // Stock is a physical count, and the only honest number for it today is
    // zero until somebody walks the store room.
    await client.query("UPDATE products SET stock = 0, updated_at = now()");

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  const after = {};
  for (const table of [...targets, ...deleteTargets]) {
    after[table] = Number((await client.query(`SELECT COUNT(*) AS c FROM ${table}`)).rows[0].c);
  }
  const remainingProducts = (
    await client.query("SELECT name, price_value / 100 AS rupees, stock FROM products ORDER BY name")
  ).rows;
  const preservedAfter = {};
  for (const table of PRESERVE) {
    if (!present.has(table)) continue;
    preservedAfter[table] = Number(
      (await client.query(`SELECT COUNT(*) AS c FROM ${table}`)).rows[0].c,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        backupPath,
        clearedToZero: Object.values(after).every((count) => count === 0),
        remainingProducts,
        preserved: preservedAfter,
        nextStep: "Enter the real wage rates before entering any factory work.",
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
