#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

function usage() {
  return [
    "Usage:",
    "  npm run db:schema",
    "  npm run db:schema -- --database-url=postgres://...",
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
  };

  for (const value of argv) {
    if (value.startsWith("--database-url=")) {
      args.databaseUrl = value.slice("--database-url=".length);
    } else if (value.startsWith("--schema=")) {
      args.schemaPath = value.slice("--schema=".length);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

function shouldUseSsl(connectionString) {
  if (/localhost|127\.0\.0\.1/i.test(connectionString)) {
    return false;
  }

  return process.env.PGSSLMODE !== "disable";
}

function safeDatabaseLabel(connectionString) {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "configured";
  }
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
  const schemaSql = await readFile(schemaPath, "utf8");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(schemaSql);
    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          ok: true,
          appliedAt: new Date().toISOString(),
          database: safeDatabaseLabel(databaseUrl),
          schema: path.relative(process.cwd(), schemaPath),
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
