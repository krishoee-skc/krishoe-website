#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const { Pool } = pg;

function usage() {
  return [
    "Usage:",
    "  npm run db:schema",
    "  npm run db:schema -- --database-url=postgres://...",
    "  npm run db:migrate:factory -- --dry-run",
    "",
    "Environment:",
    "  DATABASE_URL must point to the preview Postgres database.",
    "  PGSSLMODE=disable can be used for local Postgres.",
  ].join("\n");
}

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {
    databaseUrl: "",
    schemaPath: "docs/schema.sql",
    dryRun: false,
    migrationsOnly: false,
  };

  for (const value of argv) {
    if (value === "--dry-run") {
      args.dryRun = true;
    } else if (value === "--migrations-only") {
      args.migrationsOnly = true;
    } else if (value.startsWith("--database-url=")) {
      args.databaseUrl = value.slice("--database-url=".length);
    } else if (value.startsWith("--schema=")) {
      args.schemaPath = value.slice("--schema=".length);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

function safeDatabaseLabel(connectionString) {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "configured";
  }
}

async function migrationFiles(schemaPath, migrationsOnly) {
  const canonicalSchema = path.resolve(process.cwd(), "docs/schema.sql");

  if (!migrationsOnly && schemaPath !== canonicalSchema) {
    return [];
  }

  const directory = path.resolve(process.cwd(), "scripts/migrations");
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * A migration's fingerprint, blind to how the lines end.
 *
 * git rewrites line endings on a Windows checkout, so the same untouched file
 * hashes differently on different days. That was already true of one applied
 * migration here: 27 of 28 matched as-is and one matched only with LF endings,
 * and NONE of them had actually been edited. The next migration run would have
 * refused the whole batch over it — the same silence that once left weeks of
 * migrations unapplied, this time for no change at all.
 *
 * CR is stripped before hashing. A migration means the same thing either way.
 */
function migrationChecksum(sql) {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

/** What the fingerprint used to be, before line endings stopped counting. */
function legacyMigrationChecksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

async function main() {
  loadEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = args.databaseUrl || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const schemaPath = path.resolve(process.cwd(), args.schemaPath);
  const schemaSql = args.migrationsOnly ? "" : await readFile(schemaPath, "utf8");
  const migrations = await migrationFiles(schemaPath, args.migrationsOnly);
  const pool = new Pool(postgresConnectionOptions(databaseUrl));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    if (schemaSql) {
      await client.query(schemaSql);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = [];
    const skipped = [];

    for (const migrationPath of migrations) {
      const name = path.basename(migrationPath);
      const sql = await readFile(migrationPath, "utf8");
      const checksum = migrationChecksum(sql);
      const existing = await client.query(
        "SELECT checksum FROM schema_migrations WHERE name = $1",
        [name],
      );

      if (existing.rows.length > 0) {
        const recorded = existing.rows[0].checksum;

        if (recorded !== checksum) {
          // Stamped before line endings stopped counting: the file is
          // unchanged, only its fingerprint recipe is. Re-stamp it and carry
          // on rather than refusing the batch over a CR.
          if (recorded === legacyMigrationChecksum(sql)) {
            await client.query(
              "UPDATE schema_migrations SET checksum = $2 WHERE name = $1",
              [name, checksum],
            );
          } else {
            throw new Error(`Migration checksum mismatch for ${name}. Never edit an applied migration.`);
          }
        }

        skipped.push(name);
        continue;
      }

      if (/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(sql)) {
        throw new Error(`Migration ${name} must not manage its own transaction.`);
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [name, checksum],
      );
      applied.push(name);
    }

    await client.query(args.dryRun ? "ROLLBACK" : "COMMIT");

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: args.dryRun,
          mode: args.migrationsOnly ? "migrations-only" : "schema-and-migrations",
          appliedAt: new Date().toISOString(),
          database: safeDatabaseLabel(databaseUrl),
          schema: path.relative(process.cwd(), schemaPath),
          migrations: { applied, skipped },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
