import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  backupExtensionTableSpecs,
  assetBackupTables,
  emptyBackupExtensionGroups,
  factoryBackupTables,
  productionAccountingBackupTables,
  validateBackupExtensionData,
} from "@/lib/backup-table-manifest.mjs";

const productionTables = [
  "production_items",
  "production_stage_rates",
  "production_worker_stage_rates",
  "production_item_materials",
  "production_cost_cards",
  "production_work_orders",
  "production_cctv_references",
  "production_material_consumptions",
  "production_stage_handovers",
  "production_work_entries",
  "worker_payments",
  "production_qc_postings",
];

const factoryTables = [
  "factory_workers",
  "factory_items",
  "factory_rates",
  "factory_daily_work",
  "factory_worker_ledger",
  "factory_weekly_advance",
  "factory_monthly_summary",
];
const assetTables = ["uploaded_images"];

function completeV15Backup() {
  const extensionData = emptyBackupExtensionGroups() as {
    productionAccounting: Record<string, Array<Record<string, unknown>>>;
    factory: Record<string, Array<Record<string, unknown>>>;
    assets: Record<string, Array<Record<string, unknown>>>;
  };
  return {
    schemaVersion: 15,
    source: "KRISHOE admin backup",
    containsSensitiveData: true,
    counts: {
      products: 0,
      orders: 0,
      orderItems: 0,
      messages: 0,
      users: 0,
      passwordResetTokens: 0,
      emailVerificationTokens: 0,
      operations: {
        rawMaterials: 0,
        materialConsumptions: 0,
        workerTasks: 0,
        productionBatches: 0,
        finishedStock: 0,
        vehicleDispatches: 0,
        vehicleDispatchItems: 0,
        customerLedgers: 0,
        stockMovements: 0,
        ledgerTransactions: 0,
      },
      paymentTransactions: 0,
      posInvoices: 0,
      purchasing: {
        supplierLedgers: 0,
        purchaseInvoices: 0,
        supplierTransactions: 0,
        purchaseInvoiceItems: 0,
      },
      costingSettings: 1,
      hr: { employees: 0, attendanceRecords: 0, payrollRecords: 0 },
      adminSettings: { company: 1, branches: 0, staff: 0 },
      audit: 0,
      notifications: 0,
      productionAccounting: Object.fromEntries(productionTables.map((table) => [table, 0])),
      factory: Object.fromEntries(factoryTables.map((table) => [table, 0])),
      assets: Object.fromEntries(assetTables.map((table) => [table, 0])),
    },
    data: {
      ...extensionData,
      products: [],
      orders: [] as Array<{ items: Array<Record<string, unknown>> }>,
      messages: [],
      users: [],
      passwordResetTokens: [],
      emailVerificationTokens: [],
      operations: {
        rawMaterials: [],
        materialConsumptions: [],
        workerTasks: [],
        productionBatches: [],
        finishedStock: [],
        vehicleDispatches: [],
        vehicleDispatchItems: [],
        customerLedgers: [],
        stockMovements: [],
        ledgerTransactions: [],
      },
      paymentTransactions: [],
      posInvoices: [],
      purchasing: {
        supplierLedgers: [],
        purchaseInvoices: [] as Array<{ items: Array<Record<string, unknown>> }>,
        supplierTransactions: [],
      },
      costingSettings: {},
      hr: { employees: [], attendanceRecords: [], payrollRecords: [] },
      adminSettings: { company: {}, branches: [], staff: [] },
      audit: [],
      notifications: [],
    },
  };
}

describe("admin backup schema v15 coverage", () => {
  it("has one dependency-ordered whitelist for 19 business tables and uploaded images", () => {
    const schema = readFileSync(path.join(process.cwd(), "docs", "schema.sql"), "utf8");

    expect(productionAccountingBackupTables.map(({ table }) => table)).toEqual(productionTables);
    expect(factoryBackupTables.map(({ table }) => table)).toEqual(factoryTables);
    expect(assetBackupTables.map(({ table }) => table)).toEqual(assetTables);
    expect(backupExtensionTableSpecs.map(({ table }) => table)).toEqual([
      ...productionTables,
      ...factoryTables,
      ...assetTables,
    ]);

    for (const spec of backupExtensionTableSpecs) {
      expect(spec.columns[0]).toBe("id");
      expect(new Set(spec.columns).size).toBe(spec.columns.length);
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${spec.table}`);
      const tableBlock = schema.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${spec.table} \\(([\\s\\S]*?)\\n\\);`),
      )?.[1];
      expect(tableBlock, `${spec.table} schema block`).toBeTruthy();
      for (const column of spec.columns) {
        const declaredInCreate = new RegExp(`^\\s*${column}\\s`, "m").test(tableBlock ?? "");
        const declaredByAlter = new RegExp(
          `ALTER TABLE ${spec.table}[^;]*ADD COLUMN IF NOT EXISTS ${column}\\s`,
        ).test(schema);
        expect(
          declaredInCreate || declaredByAlter,
          `${spec.table}.${column}`,
        ).toBe(true);
      }
    }
  });

  it("keeps v14 readable but requires complete, whitelisted v15 raw groups", () => {
    expect(() => validateBackupExtensionData({ schemaVersion: 14, data: {} })).not.toThrow();
    expect(() => validateBackupExtensionData(completeV15Backup())).not.toThrow();

    const unknownTable = completeV15Backup();
    Object.assign(unknownTable.data.factory, { injected_table: [] });
    expect(() => validateBackupExtensionData(unknownTable)).toThrow(/unapproved table/);

    const incompleteRow = completeV15Backup();
    incompleteRow.data.factory.factory_workers.push({ id: "worker-1" });
    incompleteRow.counts.factory.factory_workers = 1;
    expect(() => validateBackupExtensionData(incompleteRow)).toThrow(/missing column/);

    const unknownColumn = completeV15Backup();
    const workerSpec = factoryBackupTables[0];
    unknownColumn.data.factory.factory_workers.push({
      ...Object.fromEntries(
        workerSpec.columns.map((column) => [column, column === "id" ? "worker-1" : null]),
      ),
      sql: "not allowed",
    });
    unknownColumn.counts.factory.factory_workers = 1;
    expect(() => validateBackupExtensionData(unknownColumn)).toThrow(/unapproved column/);

    const wrongCount = completeV15Backup();
    wrongCount.counts.factory.factory_workers = 1;
    expect(() => validateBackupExtensionData(wrongCount)).toThrow(/count mismatch/);

    const missingCoreCollection = completeV15Backup();
    delete (missingCoreCollection.data as { products?: unknown }).products;
    expect(() => validateBackupExtensionData(missingCoreCollection)).toThrow(/data\.products/);

    const wrongCoreCount = completeV15Backup();
    wrongCoreCount.counts.products = 1;
    expect(() => validateBackupExtensionData(wrongCoreCount)).toThrow(/count mismatch for products/);

    const wrongOrderLineCount = completeV15Backup();
    wrongOrderLineCount.data.orders.push({ items: [{ productId: "product-1" }] });
    wrongOrderLineCount.counts.orders = 1;
    expect(() => validateBackupExtensionData(wrongOrderLineCount)).toThrow(/order item count mismatch/);

    const imageMismatch = completeV15Backup();
    imageMismatch.data.assets.uploaded_images.push({
      id: "image-1",
      content_type: "image/png",
      bytes: Buffer.from("image").toString("base64"),
      byte_size: 99,
      created_at: "2026-08-01T00:00:00.000Z",
    });
    imageMismatch.counts.assets.uploaded_images = 1;
    expect(() => validateBackupExtensionData(imageMismatch)).toThrow(/byte size/);

    const multilineImage = completeV15Backup();
    const imageBytes = Buffer.from("a long enough image payload for wrapped base64");
    const wrappedBase64 = imageBytes
      .toString("base64")
      .replace(/(.{20})/g, "$1\n");
    multilineImage.data.assets.uploaded_images.push({
      id: "image-2",
      content_type: "image/png",
      bytes: wrappedBase64,
      byte_size: imageBytes.byteLength,
      created_at: "2026-08-01T00:00:00.000Z",
    });
    multilineImage.counts.assets.uploaded_images = 1;
    expect(() => validateBackupExtensionData(multilineImage)).not.toThrow();
  });

  it("uses v15 and the shared whitelist in export, import, and smoke scripts", () => {
    const backupSource = readFileSync(path.join(process.cwd(), "lib", "backup.ts"), "utf8");
    const exportSource = readFileSync(
      path.join(process.cwd(), "scripts", "export-admin-backup.mjs"),
      "utf8",
    );
    const importSource = readFileSync(
      path.join(process.cwd(), "scripts", "import-backup-to-postgres.mjs"),
      "utf8",
    );
    const smokeSource = readFileSync(
      path.join(process.cwd(), "scripts", "postgres-smoke-check.mjs"),
      "utf8",
    );

    expect(backupSource).toContain("backupSchemaVersion = 15");
    expect(backupSource).toContain("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(exportSource).toContain("expectedBackupSchemaVersion = 15");
    expect(importSource).toContain("backupSchemaVersion = 15");
    expect(smokeSource).toContain("backupSchemaVersion = 15");
    expect(importSource).toContain("validateBackupExtensionData(backup)");
    expect(exportSource).toContain("validateBackupExtensionData(backup)");
    expect(exportSource).toContain("--confirm-database=VERIFY_DATABASE_NAME");
    expect(smokeSource).toContain("validateBackupExtensionData(backup)");
    expect(importSource).toContain("productionAccountingBackupTables");
    expect(importSource).toContain("factoryBackupTables");
    expect(importSource).toContain("assetBackupTables");
    expect(importSource).toContain("DELETE FROM order_items WHERE order_id = $1");
    expect(importSource).toContain("INSERT INTO purchase_invoice_items");
    expect(importSource).toContain("kind = EXCLUDED.kind");
    expect(importSource).toContain("size_run = EXCLUDED.size_run");
    expect(importSource).toContain("optionalString(invoice.materialId)");
    expect(importSource).toContain("cleanPreciseNonNegative(item.quantity)");
    expect(importSource).toContain("cleanPreciseNonNegative(item.rate)");
    expect(importSource).toContain('requiredString(row[column]).replace(/\\s/g, "")');
    expect(importSource).toContain("--confirm-database=");
    expect(importSource).toContain("backup.schemaVersion < backupSchemaVersion");
    expect(smokeSource).toContain('["orderItems", "order_items"]');
    expect(smokeSource).toContain('["purchaseInvoiceItems", "purchase_invoice_items"]');
    expect(smokeSource).toContain("backupExtensionTableSpecs.map");
  });
});
