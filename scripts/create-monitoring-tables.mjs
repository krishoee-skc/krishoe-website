#!/usr/bin/env node
/**
 * Creates the three monitoring tables, and only those three.
 *
 * They were written into docs/schema.sql and never applied, so every figure on
 * /admin/monitoring read zero — not because the shop had no errors, but because
 * there was nowhere to put one. Each read failed, each read swallowed its own
 * failure and returned an empty result, and the screen reported perfect health
 * as confidently as it would have on the day the shop was down.
 *
 * A separate script rather than re-running the whole schema, because that file
 * is over fifteen hundred lines against a live database holding real orders and
 * real wages. Everything here is CREATE IF NOT EXISTS and ADD COLUMN IF NOT
 * EXISTS: it touches nothing that already exists and holds no data of its own.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS monitoring_errors (
     id TEXT PRIMARY KEY,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     level TEXT NOT NULL CHECK (level IN ('error', 'warning', 'info')),
     message TEXT NOT NULL,
     fingerprint TEXT,
     stack TEXT,
     context TEXT,
     user_id TEXT,
     path TEXT,
     method TEXT,
     status_code INTEGER
   )`,
  // For a database that already carries the table from an earlier schema run.
  `ALTER TABLE monitoring_errors ADD COLUMN IF NOT EXISTS fingerprint TEXT`,
  `CREATE TABLE IF NOT EXISTS monitoring_performance (
     id TEXT PRIMARY KEY,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     path TEXT NOT NULL,
     method TEXT NOT NULL,
     duration INTEGER NOT NULL,
     status_code INTEGER NOT NULL,
     db_time INTEGER,
     render_time INTEGER,
     user_id TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS monitoring_uptime (
     id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
     checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     status TEXT NOT NULL CHECK (status IN ('up', 'down')),
     response_time INTEGER NOT NULL,
     status_code INTEGER NOT NULL,
     region TEXT NOT NULL DEFAULT 'default'
   )`,
  `CREATE INDEX IF NOT EXISTS monitoring_errors_created_at_idx ON monitoring_errors(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS monitoring_errors_level_idx ON monitoring_errors(level)`,
  `CREATE INDEX IF NOT EXISTS monitoring_errors_fingerprint_idx ON monitoring_errors(fingerprint)`,
  `CREATE INDEX IF NOT EXISTS monitoring_performance_created_at_idx ON monitoring_performance(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS monitoring_performance_path_idx ON monitoring_performance(path)`,
  `CREATE INDEX IF NOT EXISTS monitoring_uptime_checked_at_idx ON monitoring_uptime(checked_at DESC)`,
];

async function main() {
  loadEnvLocal();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Nothing was changed.");
    process.exitCode = 1;
    return;
  }

  const client = new pg.Client(postgresConnectionOptions(databaseUrl));
  await client.connect();

  try {
    // One transaction: either all three tables exist afterwards or none of them
    // does, so a half-applied set never has to be diagnosed.
    await client.query("BEGIN");
    for (const statement of STATEMENTS) {
      await client.query(statement);
    }
    await client.query("COMMIT");

    for (const table of ["monitoring_errors", "monitoring_performance", "monitoring_uptime"]) {
      const { rows } = await client.query(`SELECT count(*)::int AS rows FROM ${table}`);
      console.log(`${table.padEnd(24)} ready — ${rows[0].rows} rows`);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
