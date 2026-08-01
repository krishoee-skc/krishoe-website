#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
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

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function outputPath() {
  const requested = process.argv.find((value) => value.startsWith("--out="));
  return requested
    ? requested.slice("--out=".length)
    : path.join("backups", `factory-pre-migration-${timestamp()}.json`);
}

loadEnvLocal();
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the Factory migration backup.");
}

const pool = new Pool(postgresConnectionOptions(databaseUrl, { max: 2 }));

try {
  const tables = {};
  const counts = {};

  for (const table of factoryTables) {
    const result = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
    tables[table] = result.rows;
    counts[table] = result.rowCount ?? result.rows.length;
  }

  const columns = await pool.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position
  `, [factoryTables]);

  const backup = {
    schemaVersion: 1,
    source: "KRISHOE Factory pre-migration backup",
    containsSensitiveData: true,
    exportedAt: new Date().toISOString(),
    counts,
    columns: columns.rows,
    tables,
  };
  const destination = path.resolve(process.cwd(), outputPath());
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(backup, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

  console.log(JSON.stringify({
    ok: true,
    containsSensitiveData: true,
    output: path.relative(process.cwd(), destination),
    counts,
  }, null, 2));
} finally {
  await pool.end();
}
