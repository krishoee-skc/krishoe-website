#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const confirmationFlag = "--confirm-clean-business-start";
const confirmed = process.argv.includes(confirmationFlag);
const tables = [
  "factory_wage_settlement_entries",
  "factory_wage_settlements",
  "factory_cctv_references",
  "factory_stage_handover_sizes",
  "factory_stage_handovers",
  "factory_production_entry_sizes",
  "factory_production_entries",
  "factory_packing_approvals",
  "factory_material_issues",
  "factory_work_order_sizes",
  "factory_stage_assignments",
  "factory_work_orders",
  "factory_item_bom",
  "factory_item_stage_rates",
  "factory_worker_links",
  "factory_production_items",
  "payment_transactions",
  "order_items",
  "orders",
  "pos_invoices",
  "purchase_invoice_items",
  "purchase_invoices",
  "supplier_transactions",
  "supplier_ledgers",
  "material_consumptions",
  "worker_tasks",
  "production_batches",
  "stock_movements",
  "finished_stock",
  "vehicle_dispatch_items",
  "vehicle_dispatches",
  "ledger_transactions",
  "customer_ledgers",
  "raw_materials",
  "hr_attendance",
  "hr_payroll",
  "notification_events",
  "rate_limit_attempts",
  "admin_audit_events",
  "contact_messages",
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
  const existingRows = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  const existing = new Set(existingRows.rows.map((row) => row.tablename));
  const targets = tables.filter((table) => existing.has(table));
  const counts = {};
  for (const table of targets) {
    counts[table] = Number(
      (await client.query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count,
    );
  }
  const products = await client.query(
    "SELECT id, sku, name, status, stock FROM products ORDER BY name",
  );
  const preserved = {
    products: products.rowCount,
    employees: Number((await client.query("SELECT COUNT(*) FROM hr_employees")).rows[0].count),
    staff: Number((await client.query("SELECT COUNT(*) FROM admin_staff_accounts")).rows[0].count),
    branches: Number((await client.query("SELECT COUNT(*) FROM company_branches")).rows[0].count),
  };

  console.log(JSON.stringify({ mode: confirmed ? "confirmed" : "dry-run", counts, preserved }, null, 2));
  if (!confirmed) {
    console.log(`\nDry run only. Re-run with ${confirmationFlag} to execute.`);
    process.exit(0);
  }

  const snapshot = { takenAt: new Date().toISOString(), counts, products: products.rows, data: {} };
  for (const table of targets) {
    snapshot.data[table] = (await client.query(`SELECT * FROM ${table}`)).rows;
  }
  const backupDirectory = path.join(process.cwd(), "backups");
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = path.join(
    backupDirectory,
    `clean-business-start-pre-${stamp()}.json`,
  );
  await writeFile(backupPath, JSON.stringify(snapshot, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });

  await client.query("BEGIN");
  try {
    await client.query(`TRUNCATE TABLE ${targets.join(", ")} RESTART IDENTITY`);
    await client.query("UPDATE products SET stock = 0, updated_at = now()");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  const after = {};
  for (const table of targets) {
    after[table] = Number(
      (await client.query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count,
    );
  }
  const productStock = Number(
    (await client.query("SELECT COALESCE(SUM(stock), 0) AS stock FROM products")).rows[0].stock,
  );
  console.log(JSON.stringify({ ok: true, backupPath, after, productStock, preserved }, null, 2));
} finally {
  await client.end();
}
