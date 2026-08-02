#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const { Pool } = pg;
const branchTables = [
  "orders", "order_items", "contact_messages", "raw_materials",
  "supplier_ledgers", "supplier_transactions", "purchase_invoices",
  "purchase_invoice_items", "hr_employees", "hr_attendance", "hr_payroll",
  "production_batches", "material_consumptions", "worker_tasks",
  "production_work_orders", "production_cctv_references",
  "production_material_consumptions", "production_stage_handovers",
  "production_work_entries", "worker_payments", "finished_stock",
  "stock_movements", "production_qc_postings", "vehicle_dispatches",
  "vehicle_dispatch_items", "customer_ledgers", "ledger_transactions",
  "pos_invoices", "payment_transactions", "factory_workers",
  "factory_daily_work", "factory_worker_ledger", "factory_weekly_advance",
  "factory_monthly_summary", "branch_product_stock",
];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] ??= value;
  }
}

loadEnvLocal();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const pool = new Pool(postgresConnectionOptions(process.env.DATABASE_URL, { max: 2 }));

try {
  const relationResult = await pool.query(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       EXISTS (
         SELECT 1 FROM pg_policies p
         WHERE p.schemaname = 'public'
           AND p.tablename = c.relname
           AND p.policyname = 'krishoe_branch_isolation'
       ) AS has_policy
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
    [branchTables],
  );
  const relations = new Map(relationResult.rows.map((row) => [row.relname, row]));
  const failures = [];

  for (const table of branchTables) {
    const relation = relations.get(table);
    if (!relation) {
      failures.push(`${table}: missing table`);
      continue;
    }
    if (!relation.relrowsecurity || !relation.relforcerowsecurity || !relation.has_policy) {
      failures.push(`${table}: RLS/policy is incomplete`);
    }
    const nullResult = await pool.query(
      `SELECT count(*)::int AS count FROM ${table} WHERE branch_id IS NULL OR branch_id = ''`,
    );
    if (nullResult.rows[0].count > 0) failures.push(`${table}: ${nullResult.rows[0].count} unassigned row(s)`);
  }

  const accessTables = await pool.query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename = ANY($1::text[])`,
    [["admin_staff_tokens", "admin_staff_sessions", "admin_staff_access_history"]],
  );
  const presentAccessTables = new Set(accessTables.rows.map((row) => row.tablename));
  for (const table of ["admin_staff_tokens", "admin_staff_sessions", "admin_staff_access_history"]) {
    if (!presentAccessTables.has(table)) failures.push(`${table}: missing table`);
  }

  const tokenColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'admin_staff_tokens'`,
  );
  const tokenColumnNames = tokenColumns.rows.map((row) => row.column_name);
  if (!tokenColumnNames.includes("token_hash") || !tokenColumnNames.includes("secret_hash")) {
    failures.push("admin_staff_tokens: hashed secret columns missing");
  }
  if (tokenColumnNames.some((name) => ["raw_token", "raw_secret", "password"].includes(name))) {
    failures.push("admin_staff_tokens: unsafe raw secret column exists");
  }

  const migrationRows = await pool.query(
    `SELECT name FROM schema_migrations
     WHERE name = ANY($1::text[])
     ORDER BY name`,
    [["20260802_admin_access_v1.sql", "20260802_branch_access_v1.sql"]],
  );
  if (migrationRows.rowCount !== 2) failures.push("security migration records are incomplete");

  const defaultBranchResult = await pool.query(
    "SELECT default_branch_id FROM company_settings WHERE id = 'default'",
  );
  const defaultBranchId = defaultBranchResult.rows[0]?.default_branch_id ?? "";
  if (!defaultBranchId) {
    failures.push("company_settings: default branch is missing");
  } else {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query(
        `SELECT
           set_config('app.krishoe_branch_context', 'true', true),
           set_config('app.krishoe_branch_id', $1, true),
           set_config('app.krishoe_branch_bypass', 'false', true),
           set_config('app.krishoe_staff_id', 'security-audit', true)`,
        [defaultBranchId],
      );
      for (const table of [
        "orders", "pos_invoices", "purchase_invoices", "hr_employees",
        "production_work_orders", "factory_daily_work", "stock_movements",
      ]) {
        const crossBranch = await client.query(
          `SELECT count(*)::int AS count FROM ${table} WHERE branch_id <> $1`,
          [defaultBranchId],
        );
        if (crossBranch.rows[0].count > 0) failures.push(`${table}: cross-branch row visible under RLS context`);
      }
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      failures.push(`branch context verification failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  console.log(JSON.stringify({
    ok: failures.length === 0,
    checkedAt: new Date().toISOString(),
    branchTableCount: branchTables.length,
    protectedBranchTables: relationResult.rows.filter((row) => row.relrowsecurity && row.relforcerowsecurity && row.has_policy).length,
    verifiedDefaultBranch: defaultBranchId,
    accessTables: [...presentAccessTables].sort(),
    migrations: migrationRows.rows.map((row) => row.name),
    failures,
  }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await pool.end();
}
