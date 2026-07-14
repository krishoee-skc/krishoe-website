#!/usr/bin/env node

import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const defaultBaseUrl = "http://localhost:3002";
const expectedBackupSchemaVersion = 13;
const adminSessionCookieName = "krishoe_admin_session";

function usage() {
  return [
    "Usage:",
    "  npm run backup:export",
    "  npm run backup:export -- --url=http://localhost:3002",
    "  npm run backup:export -- --out=backups/krishoe-backup-v13-preview.json",
    "",
    "Options:",
    "  --url=<base-url>         Running app URL. Defaults to http://localhost:3002.",
    "  --out=<path>             Output backup JSON path. Defaults to backups/krishoe-backup-v13-<timestamp>.json.",
    "  --timeout-ms=<number>    Request timeout. Defaults to 20000.",
    "  --check-only             Validate the backup response without writing a file.",
    "",
    "Environment:",
    "  ADMIN_SESSION_SECRET must be configured in .env.local or the shell environment.",
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
    url: process.env.NEXT_PUBLIC_SITE_URL || defaultBaseUrl,
    out: "",
    timeoutMs: 20_000,
    checkOnly: false,
  };

  for (const value of argv) {
    if (value === "--help" || value === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (value === "--check-only") {
      args.checkOnly = true;
    } else if (value.startsWith("--url=")) {
      args.url = value.slice("--url=".length);
    } else if (value.startsWith("--out=")) {
      args.out = value.slice("--out=".length);
    } else if (value.startsWith("--timeout-ms=")) {
      args.timeoutMs = Math.max(1000, Number(value.slice("--timeout-ms=".length)) || args.timeoutMs);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function createAdminSessionToken(secret) {
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: "admin",
      exp: Date.now() + 5 * 60 * 1000,
      name: "Migration CLI",
      email: "migration-cli@krishoe.local",
      role: "Owner",
    }),
  );
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");

  return `${payload}.${signature}`;
}

function normalizeBaseUrl(value) {
  return (value || defaultBaseUrl).replace(/\/+$/, "");
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function defaultOutputPath(schemaVersion) {
  return path.join("backups", `krishoe-backup-v${schemaVersion}-${timestamp()}.json`);
}

function collectNonEmptyArrays(value, prefix = "integrity") {
  if (Array.isArray(value)) {
    return value.length > 0 ? [`${prefix}=${value.length}`] : [];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, childValue]) =>
    collectNonEmptyArrays(childValue, `${prefix}.${key}`),
  );
}

function getActiveOwnerCount(backup) {
  const value = backup?.integrity?.adminSettings?.staff?.activeOwnerCount;
  return typeof value === "number" ? value : null;
}

function summarizeCounts(backup) {
  const counts = backup.counts ?? {};
  const operations = counts.operations ?? {};
  const purchasing = counts.purchasing ?? {};
  const hr = counts.hr ?? {};
  const adminSettings = counts.adminSettings ?? {};

  return {
    products: counts.products ?? 0,
    orders: counts.orders ?? 0,
    messages: counts.messages ?? 0,
    users: counts.users ?? 0,
    audit: counts.audit ?? 0,
    notifications: counts.notifications ?? 0,
    operationsRows: Object.values(operations).reduce((sum, value) => sum + (Number(value) || 0), 0),
    purchasingRows: Object.values(purchasing).reduce((sum, value) => sum + (Number(value) || 0), 0),
    hrRows: Object.values(hr).reduce((sum, value) => sum + (Number(value) || 0), 0),
    branches: adminSettings.branches ?? 0,
    staff: adminSettings.staff ?? 0,
  };
}

function validateBackup(backup) {
  const errors = [];
  const warnings = [];

  if (!backup || typeof backup !== "object") {
    errors.push("Backup response is not a JSON object.");
    return { errors, warnings, integrityIssues: [] };
  }

  if (backup.schemaVersion !== expectedBackupSchemaVersion) {
    errors.push(
      `Backup schemaVersion expected ${expectedBackupSchemaVersion}, got ${backup.schemaVersion}.`,
    );
  }

  if (backup.source !== "KRISHOE admin backup") {
    warnings.push("Backup source label is different than expected.");
  }

  if (backup.containsSensitiveData !== true) {
    errors.push("Backup must be marked containsSensitiveData=true.");
  }

  if (!backup.counts || typeof backup.counts !== "object") {
    errors.push("Backup counts section is missing.");
  }

  if (!backup.data || typeof backup.data !== "object") {
    errors.push("Backup data section is missing.");
  }

  const activeOwnerCount = getActiveOwnerCount(backup);

  if (activeOwnerCount === 0) {
    warnings.push("No active Owner staff account found in backup integrity metadata.");
  }

  const integrityIssues = collectNonEmptyArrays(backup.integrity);

  return { errors, warnings, integrityIssues };
}

async function fetchBackup({ baseUrl, timeoutMs }) {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is missing. Set it in .env.local before exporting backup.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/admin/backup`, {
      headers: {
        Cookie: `${adminSessionCookieName}=${createAdminSessionToken(secret)}`,
      },
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Backup endpoint returned HTTP ${response.status}: ${text.slice(0, 180)}`);
    }

    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function writeBackup(outputPath, backup) {
  const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");
  return resolvedOutputPath;
}

async function main() {
  loadEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.url);
  const backup = await fetchBackup({ baseUrl, timeoutMs: args.timeoutMs });
  const validation = validateBackup(backup);
  const outputPath = args.out || defaultOutputPath(backup.schemaVersion ?? expectedBackupSchemaVersion);
  const savedPath = args.checkOnly ? "" : await writeBackup(outputPath, backup);
  const result = {
    ok: validation.errors.length === 0 && validation.integrityIssues.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrl,
    savedPath,
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt,
    containsSensitiveData: backup.containsSensitiveData === true,
    counts: summarizeCounts(backup),
    warnings: validation.warnings,
    errors: validation.errors,
    integrityIssues: validation.integrityIssues,
    nextCommands: [
      "DATABASE_URL=\"postgres://...\" npm run db:schema",
      `DATABASE_URL="postgres://..." npm run db:import -- ${savedPath || outputPath} --replace --confirm-replace`,
      `DATABASE_URL="postgres://..." npm run db:smoke -- ${savedPath || outputPath}`,
    ],
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
