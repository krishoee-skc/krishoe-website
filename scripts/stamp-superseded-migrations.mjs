#!/usr/bin/env node

/**
 * Mark the migrations that today's schema.sql has already superseded.
 *
 * A fresh database is built by applying docs/schema.sql and then replaying the
 * migration history on top. Most of that history replays cleanly, but six
 * files cannot: they were written against a shape of the database that no
 * longer exists, and re-running them on a database built from today's snapshot
 * asks for tables the snapshot correctly does not have.
 *
 * The clearest case is the HR module. `20260826_drop_hr_module.sql` deliberately
 * removed hr_employees, hr_attendance and hr_payroll — they never held a row,
 * yet sixteen tables carried foreign keys into them, so production screens
 * could not save. Every reference was repointed at factory_workers. The three
 * migrations written *before* that drop still expect hr_employees to exist,
 * and the drop itself expects tables that have since been renamed.
 *
 * Their effects are already in docs/schema.sql — that file is the snapshot of
 * what the history produced. Replaying them would not add anything; it only
 * fails. So they are recorded as applied, with the checksum the runner
 * computes, which is exactly the state a database that had lived through the
 * history would be in.
 *
 * This writes only to schema_migrations. It creates no table, drops nothing,
 * and touches no business row. Run it once against a newly built database,
 * before `npm run db:schema`.
 *
 *   node scripts/stamp-superseded-migrations.mjs --database-url=postgres://…
 *   node scripts/stamp-superseded-migrations.mjs --dry-run --database-url=…
 */

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const { Client } = pg;

/**
 * The six, and why each cannot replay.
 *
 * Named one by one rather than discovered by trying them, so that a migration
 * that starts failing for a new reason is a loud failure rather than something
 * this quietly stamps past.
 */
const SUPERSEDED = [
  ["20260801_factory_schema_v1.sql", "predates the HR drop; expects hr_employees"],
  ["20260802_admin_access_v1.sql", "predates the HR drop; expects hr_employees"],
  ["20260802_branch_access_v1.sql", "its required-table list names hr_employees"],
  ["20260826_drop_hr_module.sql", "drops tables today's snapshot never creates"],
  ["20260827_dispatch_branch_scope.sql", "needs the branch functions the snapshot now defines itself"],
  ["20260916_branch_wall_preflight.sql", "needs the branch functions the snapshot now defines itself"],
];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const at = trimmed.indexOf("=");
    if (at <= 0) continue;
    const key = trimmed.slice(0, at).trim();
    let value = trimmed.slice(at + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/**
 * The same fingerprint the schema runner computes.
 *
 * CR is stripped before hashing because git rewrites line endings on Windows,
 * and a file that only changed newline would otherwise look edited.
 */
function migrationChecksum(sql) {
  return createHash("sha256").update(sql.replace(/\r/g, ""), "utf8").digest("hex");
}

function parseArgs(argv) {
  const args = { dryRun: false, databaseUrl: "" };
  for (const value of argv) {
    if (value === "--dry-run") args.dryRun = true;
    else if (value.startsWith("--database-url=")) args.databaseUrl = value.slice("--database-url=".length);
  }
  return args;
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = args.databaseUrl || process.env.DATABASE_URL || "";

  if (!databaseUrl) {
    console.error("A database is required: --database-url=… or DATABASE_URL.");
    process.exitCode = 1;
    return;
  }

  const directory = path.join(process.cwd(), "scripts", "migrations");
  const client = new Client(postgresConnectionOptions(databaseUrl));
  await client.connect();

  const stamped = [];
  const alreadyThere = [];

  try {
    await client.query("BEGIN");

    // The runner creates this too; creating it here means this can run first.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    for (const [name, reason] of SUPERSEDED) {
      const file = path.join(directory, name);
      if (!existsSync(file)) {
        throw new Error(`${name} is named here but is not in scripts/migrations.`);
      }

      const sql = await readFile(file, "utf8");
      const checksum = migrationChecksum(sql);

      const existing = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
      if (existing.rows.length > 0) {
        alreadyThere.push(name);
        continue;
      }

      await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
        name,
        checksum,
      ]);
      stamped.push({ name, reason });
    }

    await client.query(args.dryRun ? "ROLLBACK" : "COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log(
    JSON.stringify(
      { ok: true, dryRun: args.dryRun, stamped, alreadyRecorded: alreadyThere },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
