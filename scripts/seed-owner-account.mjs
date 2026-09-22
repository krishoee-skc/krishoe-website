#!/usr/bin/env node

/**
 * Give a newly built database the three rows it needs before anyone can sign in.
 *
 * A database created from docs/schema.sql has every table and no rows, which
 * leaves the owner outside their own shop: the sign-in form has no account to
 * match, and the recovery login — the one that works with the email left blank —
 * is a setup door, not a way to work. It also cannot be used from the phone the
 * owner actually reaches for, because it needs the environment password rather
 * than the address they know.
 *
 * Three rows fix that, and they are the same three the app writes for itself
 * when it first runs on an empty store:
 *
 *   1. the two default branches, Main Factory and Main Retail Shop, because
 *      admin_staff_accounts.branch_id is a foreign key and cannot be null
 *   2. the company settings row, which names the default branch
 *   3. one Active Owner, with a password hashed exactly the way the sign-in
 *      code hashes it — scrypt, a fresh 16-byte salt, a 64-byte key, stored as
 *      "scrypt:salt:key"
 *
 * The password is read from the environment, never from an argument, so it does
 * not survive in a shell history or in the process list.
 *
 *   OWNER_EMAIL=you@example.com OWNER_PASSWORD=… \
 *     node scripts/seed-owner-account.mjs --database-url=postgres://…
 *
 * Running it again on a database that already has an Owner changes nothing and
 * says so: this creates a first account, it does not overwrite one. To reset a
 * forgotten password on an account that already exists, pass --reset-password,
 * which updates only that account's password_hash.
 */

import { existsSync, readFileSync } from "node:fs";
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const { Client } = pg;
const scrypt = promisify(scryptCallback);

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

/** The format lib/admin-settings.ts stores and verifies. */
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

// The branches createDefaultBranches() writes, with the same ids, so a database
// seeded here and one the app set up for itself are the same database.
const DEFAULT_BRANCHES = [
  ["branch-factory-main", "Main Factory", "FACTORY", "Factory"],
  ["branch-retail-main", "Main Retail Shop", "RETAIL", "Retail"],
];

function parseArgs(argv) {
  const args = { dryRun: false, databaseUrl: "", resetPassword: false };
  for (const value of argv) {
    if (value === "--dry-run") args.dryRun = true;
    else if (value === "--reset-password") args.resetPassword = true;
    else if (value.startsWith("--database-url=")) {
      args.databaseUrl = value.slice("--database-url=".length);
    }
  }
  return args;
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  const databaseUrl = args.databaseUrl || process.env.DATABASE_URL || "";
  const email = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD || "";
  const name = (process.env.OWNER_NAME || "").trim() || "Owner";

  if (!databaseUrl) {
    console.error("A database is required: --database-url=… or DATABASE_URL.");
    process.exitCode = 1;
    return;
  }
  if (!email || !password) {
    console.error("OWNER_EMAIL and OWNER_PASSWORD must both be set.");
    process.exitCode = 1;
    return;
  }
  if (password.length < 10) {
    // The admin screens ask for at least this, and a seeded account should not
    // be weaker than one created through the app.
    console.error("OWNER_PASSWORD must be at least 10 characters.");
    process.exitCode = 1;
    return;
  }

  const client = new Client(postgresConnectionOptions(databaseUrl));
  await client.connect();

  const did = [];

  try {
    await client.query("BEGIN");

    for (const [id, branchName, code, type] of DEFAULT_BRANCHES) {
      const result = await client.query(
        `INSERT INTO company_branches (id, name, code, type, status)
         VALUES ($1, $2, $3, $4, 'Active')
         ON CONFLICT (id) DO NOTHING`,
        [id, branchName, code, type],
      );
      if (result.rowCount > 0) did.push(`branch ${code}`);
    }

    const settings = await client.query(
      `INSERT INTO company_settings (id, company_name, legal_name, currency, timezone, default_branch_id)
       VALUES ('default', 'KRISHOE', 'KRISHOE', 'NPR', 'Asia/Kathmandu', $1)
       ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_BRANCHES[0][0]],
    );
    if (settings.rowCount > 0) did.push("company settings");

    const existing = await client.query(
      "SELECT id, role, status FROM admin_staff_accounts WHERE lower(email) = $1",
      [email],
    );

    if (existing.rows.length > 0) {
      if (args.resetPassword) {
        await client.query(
          `UPDATE admin_staff_accounts
              SET password_hash = $2,
                  status = 'Active',
                  failed_login_count = 0,
                  must_change_password = FALSE,
                  password_changed_at = now(),
                  updated_at = now()
            WHERE lower(email) = $1`,
          [email, await hashPassword(password)],
        );
        did.push("password reset for the existing account");
      } else {
        did.push("account already exists — left alone (pass --reset-password to change it)");
      }
    } else {
      await client.query(
        `INSERT INTO admin_staff_accounts
           (id, name, email, role, branch_id, status, password_hash,
            must_change_password, password_changed_at, invitation_accepted_at)
         VALUES ($1, $2, $3, 'Owner', $4, 'Active', $5, FALSE, now(), now())`,
        [randomUUID(), name, email, DEFAULT_BRANCHES[0][0], await hashPassword(password)],
      );
      did.push("Owner account created");
    }

    await client.query(args.dryRun ? "ROLLBACK" : "COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  // The address is echoed so the operator can see which account this was for.
  // The password is never printed.
  console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, email, did }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
