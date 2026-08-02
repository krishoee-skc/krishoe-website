import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), "utf8");

const factoryTables = [
  "factory_workers",
  "factory_items",
  "factory_rates",
  "factory_daily_work",
  "factory_worker_ledger",
  "factory_weekly_advance",
  "factory_monthly_summary",
];

describe("canonical Factory database migration", () => {
  it("includes every Factory table in the main schema with decimal money and no demo rows", () => {
    const schema = read("docs", "schema.sql");

    factoryTables.forEach((table) => {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    });

    expect(schema).toContain("rate_per_pair NUMERIC(12, 2)");
    expect(schema).toContain("amount_earned NUMERIC(12, 2)");
    expect(schema).toContain("payment_given NUMERIC(12, 2)");
    expect(schema).toContain("ON DELETE RESTRICT");
    expect(schema).not.toContain("seed-worker-upper-1");
    expect(schema).not.toContain("seed-item-flatpatta");
  });

  it("keeps the compatibility migration non-destructive, checked and runner-owned", () => {
    const migration = read("scripts", "migrations", "20260801_factory_schema_v1.sql");

    expect(migration).toContain("Factory migration blocked:");
    expect(migration).toContain("submission_key");
    expect(migration).toContain("source_work_id");
    expect(migration).toContain("TYPE NUMERIC(12, 2)");
    expect(migration).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toContain("seed-worker-");
    expect(migration).not.toContain("seed-item-");
  });

  it("adds staff salary-period attribution without deleting or seeding rows", () => {
    const migration = read(
      "scripts",
      "migrations",
      "20260801_factory_schema_v2_salary_period.sql",
    );

    expect(migration).toContain("salary_period_month");
    expect(migration).toContain("worker_type IN ('monthly_staff', 'daily_staff')");
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im);
    expect(migration).not.toContain("seed-worker-");
  });

  it("adds duplicate-safe Factory payment synchronization without changing business rows", () => {
    const migration = read(
      "scripts",
      "migrations",
      "20260803_worker_payment_sync_v1.sql",
    );

    expect(migration).toContain("source_submission_key");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
    expect(migration).not.toMatch(/\b(DELETE|UPDATE|INSERT)\s+/i);
    expect(migration).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im);
  });

  it("tracks ordered migration checksums and rejects edited applied files", () => {
    const runner = read("scripts", "apply-postgres-schema.mjs");

    expect(runner).toContain("scripts/migrations");
    expect(runner).toContain("schema_migrations");
    expect(runner).toContain("Migration checksum mismatch");
    expect(runner).toContain("postgresConnectionOptions");
    expect(runner).toContain('args.dryRun ? "ROLLBACK" : "COMMIT"');
    expect(runner).toContain('mode: args.migrationsOnly ? "migrations-only"');
  });

  it("retires the conflicting standalone schemas and their automatic demo seed", () => {
    const docsCopy = read("docs", "factory-schema.sql");
    const setupCopy = read("scripts", "setup-factory-tables.sql");

    expect(docsCopy).not.toMatch(/CREATE TABLE|INSERT INTO/i);
    expect(setupCopy).not.toMatch(/CREATE TABLE|INSERT INTO/i);
    expect(`${docsCopy}\n${setupCopy}`).toContain("npm run db:schema");
  });

  it("uses certificate validation by default in database maintenance scripts", () => {
    const options = read("scripts", "postgres-connection-options.mjs");
    const apply = read("scripts", "apply-postgres-schema.mjs");
    const importer = read("scripts", "import-backup-to-postgres.mjs");
    const smoke = read("scripts", "postgres-smoke-check.mjs");

    expect(options).toContain('process.env.PGSSL_INSECURE !== "true"');
    expect(options).toContain("connectionStringWithoutLegacySslMode");
    expect(apply).toContain("postgresConnectionOptions(databaseUrl)");
    expect(importer).toContain("postgresConnectionOptions(databaseUrl)");
    expect(smoke).toContain("postgresConnectionOptions(databaseUrl)");
    expect(`${apply}\n${importer}\n${smoke}`).not.toContain("rejectUnauthorized: false");
  });
});
