import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  backupExtensionTableSpecs,
  exactCopyTables,
  validateBackupExtensionData,
} from "@/lib/backup-table-manifest.mjs";

const read = (path: string) => readFileSync(path, "utf8");

/**
 * The first real restore test (owner, 2026-10-26): a free test database, the
 * schema rebuilt from the repo, last night's backup put back, every table
 * compared with live. Each finding is pinned here so it cannot come back.
 */
describe("a rebuild from the repo", () => {
  const script = read("scripts/apply-postgres-schema.mjs");

  it("lets an empty database pass the migrations docs/schema.sql already holds", () => {
    expect(script).toContain("const freshBuild =");
    expect(script).toContain('SAVEPOINT migration');
    expect(script).toContain("supersededBySchema");
  });

  it("still stops on a failing migration anywhere else", () => {
    const loop = script.slice(script.indexOf("if (freshBuild) {"));
    expect(loop).toContain("} else {\n        await client.query(sql);".replace(/\n/g, script.includes("\r\n") ? "\r\n" : "\n"));
  });
});

describe("a backup since the HR module was dropped", () => {
  it("is not refused for having no data.hr", () => {
    const manifest = read("lib/backup-table-manifest.mjs");
    expect(manifest).toContain('if (dataPath[0] === "hr" && data?.hr === undefined) continue;');
  });
});

describe("what a backup carries", () => {
  it("carries the stage of every booked piece, and the new factory columns", () => {
    const work = backupExtensionTableSpecs.find(({ table }) => table === "factory_daily_work") as
      | { columns: string[]; optional?: string[] }
      | undefined;
    expect(work?.columns).toEqual(expect.arrayContaining(["stage", "reject_pairs", "size_counts"]));
    expect(work?.optional).toEqual(expect.arrayContaining(["stage", "reject_pairs", "size_counts"]));
    const items = backupExtensionTableSpecs.find(({ table }) => table === "factory_items");
    expect(items?.columns).toContain("material_cost_per_pair");
  });

  it("still accepts an older backup without those keys", () => {
    expect(read("lib/backup-table-manifest.mjs")).toContain("!(spec.optional ?? []).includes(column)");
    expect(validateBackupExtensionData({ schemaVersion: 14 })).toBeUndefined();
  });

  it("copies the core tables exactly, but no sessions or one-time tokens", () => {
    const tables = exactCopyTables.map(({ table }) => table);
    for (const table of ["products", "pos_invoices", "orders", "order_items", "finished_stock", "stock_movements", "purchase_invoices", "admin_staff_accounts"]) {
      expect(tables).toContain(table);
    }
    for (const table of ["admin_staff_sessions", "admin_staff_tokens", "password_reset_tokens", "rate_limit_attempts"]) {
      expect(tables).not.toContain(table);
    }
    // An order's lines are rebuilt by the shaped import with new ids.
    expect(exactCopyTables.find(({ table }) => table === "order_items")?.childrenOf).toEqual({ table: "orders", column: "order_id" });
  });

  it("is built with row_to_json, in one read-only snapshot", () => {
    const backup = read("lib/backup.ts");
    expect(backup).toContain("async function getExactCopyRows()");
    expect(backup).toContain("SELECT row_to_json(t) AS row FROM");
    expect(backup).toContain("exact,\n    },".replace(/\n/g, backup.includes("\r\n") ? "\r\n" : "\n"));
  });
});

describe("the restore", () => {
  const importer = read("scripts/import-backup-to-postgres.mjs");

  it("writes a staff account whole: no email for a worker, the Worker role, phone and link", () => {
    expect(importer).toContain('const staffRoles = ["Owner", "Manager", "Accountant", "HR", "Inventory", "Sales", "Factory", "Worker", "Viewer"];');
    expect(importer).toContain("email ? email.toLowerCase() : null");
    expect(importer).toContain("optionalString(staff.phone)");
    expect(importer).toContain("optionalString(staff.factoryWorkerId)");
    expect(importer).toContain("staff.mfaEnabled === true");
  });

  it("puts the factory's workers back before the work that points at them", () => {
    const workers = importer.indexOf("await importRawBackupTables(client, data, workersFirst, imported.factory);");
    const production = importer.indexOf("productionAccountingBackupTables,\n      imported.productionAccounting".replace(/\n/g, importer.includes("\r\n") ? "\r\n" : "\n"));
    expect(workers).toBeGreaterThan(-1);
    expect(workers).toBeLessThan(production);
  });

  it("lets a column the database requires take its default when the backup has none", () => {
    expect(importer).toContain('filledByDefault.has(column)) return "DEFAULT"');
  });

  it("writes the exact copy last, over the shaped rows", () => {
    const kept = importer.indexOf("imported.keptFromBeforeRestore = await putKeptTablesBack");
    const exact = importer.indexOf("imported.exact = await writeExactCopy(client, data.exact);");
    expect(exact).toBeGreaterThan(kept);
    expect(importer).toContain("json_populate_record(NULL::");
  });
});
