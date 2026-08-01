#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const { Pool } = pg;
const factoryTables = [
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

function safeDatabaseLabel(connectionString) {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "configured";
  }
}

async function scalar(client, sql) {
  const result = await client.query(sql);
  return Number(result.rows[0]?.value ?? 0);
}

loadEnvLocal();
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the read-only Factory migration preflight.");
}

const pool = new Pool(postgresConnectionOptions(databaseUrl, { max: 2 }));

try {
  const tableRows = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    [factoryTables],
  );
  const existing = new Set(tableRows.rows.map((row) => row.tablename));
  const missing = factoryTables.filter((table) => !existing.has(table));
  const counts = {};

  for (const table of factoryTables.filter((name) => existing.has(name))) {
    counts[table] = await scalar(pool, `SELECT count(*) AS value FROM ${table}`);
  }

  const failures = [];
  const notices = [];

  if (existing.size === 0) {
    notices.push("No legacy Factory tables exist; the canonical schema will create a clean set.");
  } else if (missing.length > 0) {
    notices.push(`Partial legacy Factory schema detected; missing tables: ${missing.join(", ")}.`);
  }

  if (existing.has("factory_workers")) {
    const invalidWorkers = await scalar(pool, `
      SELECT count(*) AS value FROM factory_workers
      WHERE worker_type IS NULL
         OR worker_type NOT IN ('piece_rate', 'monthly_staff', 'daily_staff')
         OR category IS NULL
         OR category NOT IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff')
         OR status NOT IN ('active', 'inactive')
         OR monthly_salary < 0 OR weekly_advance < 0
    `);
    if (invalidWorkers) failures.push(`invalidFactoryWorkers=${invalidWorkers}`);

    const demoWorkers = await scalar(pool, "SELECT count(*) AS value FROM factory_workers WHERE id LIKE 'seed-%'");
    if (demoWorkers) notices.push(`Demo worker IDs present: ${demoWorkers}. Review them before real use.`);
  }

  if (existing.has("factory_items")) {
    const duplicateCodes = await scalar(pool, `
      SELECT count(*) AS value FROM (
        SELECT code FROM factory_items
        WHERE code IS NOT NULL AND btrim(code) <> ''
        GROUP BY code HAVING count(*) > 1
      ) duplicates
    `);
    if (duplicateCodes) failures.push(`duplicateFactoryItemCodes=${duplicateCodes}`);

    const demoItems = await scalar(pool, "SELECT count(*) AS value FROM factory_items WHERE id LIKE 'seed-%'");
    if (demoItems) notices.push(`Demo item IDs present: ${demoItems}. Review them before real use.`);
  }

  if (existing.has("factory_rates")) {
    const duplicateRates = await scalar(pool, `
      SELECT count(*) AS value FROM (
        SELECT item_id, worker_category, effective_date FROM factory_rates
        GROUP BY item_id, worker_category, effective_date HAVING count(*) > 1
      ) duplicates
    `);
    if (duplicateRates) failures.push(`duplicateEffectiveRates=${duplicateRates}`);
  }

  if (existing.has("factory_daily_work")) {
    const invalidWork = await scalar(pool, `
      SELECT count(*) AS value FROM factory_daily_work
      WHERE pairs_count <= 0 OR rate_applied <= 0 OR amount_earned <= 0
         OR status NOT IN ('in_progress', 'completed', 'rework')
         OR round(amount_earned::numeric, 2) <> round((pairs_count * rate_applied)::numeric, 2)
    `);
    if (invalidWork) failures.push(`invalidFactoryWork=${invalidWork}`);
  }

  if (existing.has("factory_monthly_summary")) {
    const duplicateSummaries = await scalar(pool, `
      SELECT count(*) AS value FROM (
        SELECT month, worker_id FROM factory_monthly_summary
        GROUP BY month, worker_id HAVING count(*) > 1
      ) duplicates
    `);
    if (duplicateSummaries) failures.push(`duplicateWorkerMonthSummaries=${duplicateSummaries}`);
  }

  console.log(JSON.stringify({
    ok: failures.length === 0,
    readOnly: true,
    checkedAt: new Date().toISOString(),
    database: safeDatabaseLabel(databaseUrl),
    existingTables: [...existing].sort(),
    missingTables: missing,
    counts,
    notices,
    failures,
  }, null, 2));

  if (failures.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
