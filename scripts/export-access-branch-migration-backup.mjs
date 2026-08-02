#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const { Pool } = pg;
const requestedTables = [
  "company_settings",
  "company_branches",
  "admin_staff_accounts",
  "products",
  "orders",
  "order_items",
  "contact_messages",
  "raw_materials",
  "supplier_ledgers",
  "supplier_transactions",
  "purchase_invoices",
  "purchase_invoice_items",
  "hr_employees",
  "hr_attendance",
  "hr_payroll",
  "production_batches",
  "material_consumptions",
  "worker_tasks",
  "production_work_orders",
  "production_cctv_references",
  "production_material_consumptions",
  "production_stage_handovers",
  "production_work_entries",
  "worker_payments",
  "finished_stock",
  "stock_movements",
  "production_qc_postings",
  "vehicle_dispatches",
  "vehicle_dispatch_items",
  "customer_ledgers",
  "ledger_transactions",
  "pos_invoices",
  "payment_transactions",
  "factory_workers",
  "factory_items",
  "factory_rates",
  "factory_daily_work",
  "factory_worker_ledger",
  "factory_weekly_advance",
  "factory_monthly_summary",
];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] ??= value;
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function outputPath() {
  const requested = process.argv.find((value) => value.startsWith("--out="));
  return requested
    ? requested.slice("--out=".length)
    : path.join("backups", `access-branch-pre-migration-${timestamp()}.json`);
}

loadEnvLocal();
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the access/branch migration backup.");
}

const pool = new Pool(postgresConnectionOptions(process.env.DATABASE_URL, { max: 2 }));

try {
  const existingResult = await pool.query(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public' AND tablename = ANY($1::text[])
     ORDER BY tablename`,
    [requestedTables],
  );
  const existing = existingResult.rows.map((row) => row.tablename);
  const missing = requestedTables.filter((table) => !existing.includes(table));
  const tables = {};
  const counts = {};

  for (const table of existing) {
    if (!/^[a-z0-9_]+$/.test(table)) throw new Error(`Unsafe table name: ${table}`);
    const result = await pool.query(`SELECT * FROM ${table}`);
    tables[table] = result.rows;
    counts[table] = result.rowCount ?? result.rows.length;
  }

  const columns = await pool.query(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])
     ORDER BY table_name, ordinal_position`,
    [existing],
  );

  const destination = path.resolve(process.cwd(), outputPath());
  const backup = {
    schemaVersion: 1,
    source: "KRISHOE access and branch pre-migration backup",
    containsSensitiveData: true,
    exportedAt: new Date().toISOString(),
    counts,
    missing,
    columns: columns.rows,
    tables,
  };
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(backup, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

  console.log(JSON.stringify({
    ok: true,
    containsSensitiveData: true,
    output: path.relative(process.cwd(), destination),
    tableCount: existing.length,
    missing,
    counts,
  }, null, 2));
} finally {
  await pool.end();
}
