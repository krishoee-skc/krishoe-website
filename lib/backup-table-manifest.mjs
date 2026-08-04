import { Buffer } from "node:buffer";

export const productionAccountingBackupTables = [
  {
    group: "productionAccounting",
    table: "production_items",
    columns: [
      "id",
      "created_at",
      "updated_at",
      "name",
      "category",
      "production_type",
      "size_group",
      "status",
      "note",
      "catalog_product_id",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_stage_rates",
    columns: [
      "id",
      "created_at",
      "updated_at",
      "item_id",
      "stage",
      "rate_per_pair",
      "effective_from",
      "status",
      "note",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_worker_stage_rates",
    columns: [
      "id",
      "created_at",
      "updated_at",
      "employee_id",
      "employee_name_snapshot",
      "item_id",
      "stage",
      "rate_per_pair",
      "effective_from",
      "status",
      "note",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_item_materials",
    columns: [
      "id",
      "created_at",
      "updated_at",
      "item_id",
      "material_id",
      "material_name_snapshot",
      "unit_snapshot",
      "quantity_per_pair",
      "wastage_percent",
      "note",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_cost_cards",
    columns: [
      "id",
      "created_at",
      "effective_from",
      "item_id",
      "item_name_snapshot",
      "material_cost_per_pair",
      "labor_cost_per_pair",
      "other_direct_cost_per_pair",
      "making_cost_per_pair",
      "wholesale_profit_percent",
      "wholesale_price",
      "retail_extra_amount",
      "retail_price",
      "approved_by",
      "note",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_work_orders",
    columns: [
      "id",
      "created_at",
      "updated_at",
      "work_order_number",
      "item_id",
      "item_name_snapshot",
      "colour",
      "size_breakdown",
      "planned_pairs",
      "due_date",
      "priority",
      "current_stage",
      "status",
      "created_by",
      "note",
      "cancelled_at",
      "cancellation_reason",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_cctv_references",
    columns: [
      "id",
      "created_at",
      "work_order_id",
      "work_order_number_snapshot",
      "stage",
      "camera_zone",
      "window_start",
      "window_end",
      "cctv_reference",
      "evidence_reference",
      "recorded_by",
      "note",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_material_consumptions",
    columns: [
      "id",
      "created_at",
      "consumption_date",
      "work_order_id",
      "work_order_number_snapshot",
      "material_id",
      "material_name_snapshot",
      "unit_snapshot",
      "quantity",
      "wastage",
      "approved_by",
      "note",
      "reversed_at",
      "reversal_reason",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_stage_handovers",
    columns: [
      "id",
      "created_at",
      "handover_date",
      "work_order_id",
      "work_order_number_snapshot",
      "from_stage",
      "to_stage",
      "from_employee_id",
      "from_employee_name_snapshot",
      "to_employee_id",
      "to_employee_name_snapshot",
      "sent_pairs",
      "received_pairs",
      "approved_by",
      "note",
      "received_size_breakdown",
      "reversed_at",
      "reversal_reason",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_work_entries",
    columns: [
      "id",
      "created_at",
      "work_date",
      "employee_id",
      "employee_name_snapshot",
      "item_id",
      "item_name_snapshot",
      "stage",
      "total_pairs",
      "size_breakdown",
      "rejected_pairs",
      "rework_pairs",
      "rate_per_pair_snapshot",
      "earned_wage",
      "status",
      "approved_by",
      "approved_at",
      "note",
      "work_order_id",
      "reversed_at",
      "reversal_reason",
      "source_submission_key",
    ],
  },
  {
    group: "productionAccounting",
    table: "worker_payments",
    columns: [
      "id",
      "created_at",
      "payment_date",
      "employee_id",
      "employee_name_snapshot",
      "payment_type",
      "direction",
      "amount",
      "payment_method",
      "receipt_number",
      "approved_by",
      "approved_at",
      "note",
      "reversed_at",
      "reversal_reason",
      "source_submission_key",
    ],
  },
  {
    group: "productionAccounting",
    table: "production_qc_postings",
    columns: [
      "id",
      "created_at",
      "qc_date",
      "approval_reference",
      "work_order_id",
      "item_id",
      "item_name_snapshot",
      "catalog_product_id",
      "catalog_product_name_snapshot",
      "packing_employee_id",
      "packing_employee_name_snapshot",
      "total_pairs",
      "rejected_pairs",
      "size_breakdown",
      "stock_movement_id",
      "stock_posted_at",
      "approved_by",
      "note",
      "reversed_at",
      "reversal_reason",
      "reversal_stock_movement_id",
    ],
  },
];

export const factoryBackupTables = [
  {
    group: "factory",
    table: "factory_workers",
    columns: [
      "id",
      "hr_employee_id",
      "name",
      "worker_type",
      "category",
      "monthly_salary",
      "weekly_advance",
      "status",
      "created_at",
      "updated_at",
    ],
  },
  {
    group: "factory",
    table: "factory_items",
    columns: [
      "id",
      "production_item_id",
      "name",
      "code",
      "status",
      "created_at",
      "updated_at",
    ],
  },
  {
    group: "factory",
    table: "factory_rates",
    columns: [
      "id",
      "item_id",
      "worker_category",
      "rate_per_pair",
      "effective_date",
      "created_at",
    ],
  },
  {
    group: "factory",
    table: "factory_daily_work",
    columns: [
      "id",
      "submission_key",
      "date",
      "worker_id",
      "item_id",
      "color",
      "size",
      "pairs_count",
      "status",
      "rate_applied",
      "amount_earned",
      "work_order_id",
      "created_at",
      "updated_at",
    ],
  },
  {
    group: "factory",
    table: "factory_worker_ledger",
    columns: [
      "id",
      "submission_key",
      "source_work_id",
      "worker_id",
      "date",
      "entry_type",
      "work_pairs",
      "amount_earned",
      "payment_given",
      "running_balance",
      "status",
      "notes",
      "salary_period_month",
      "created_at",
      "updated_at",
    ],
  },
  {
    group: "factory",
    table: "factory_weekly_advance",
    columns: [
      "id",
      "submission_key",
      "worker_id",
      "week_of_date",
      "advance_amount",
      "date_given",
      "notes",
      "salary_period_month",
      "created_at",
      "updated_at",
    ],
  },
  {
    group: "factory",
    table: "factory_monthly_summary",
    columns: [
      "id",
      "month",
      "worker_id",
      "total_pairs",
      "total_earned",
      "total_paid",
      "final_balance",
      "status",
      "created_at",
      "updated_at",
    ],
  },
];

export const assetBackupTables = [
  {
    group: "assets",
    table: "uploaded_images",
    columns: ["id", "content_type", "bytes", "byte_size", "created_at"],
  },
];

// This order is also the restore order. Every referenced master row appears
// before its dependent rows. production_qc_postings is deliberately after
// worker_payments because its stock_movement link is imported before this
// manifest is processed by the restore script.
export const backupExtensionTableSpecs = [
  ...productionAccountingBackupTables,
  ...factoryBackupTables,
  ...assetBackupTables,
];

export function emptyBackupExtensionGroups() {
  return {
    productionAccounting: Object.fromEntries(
      productionAccountingBackupTables.map(({ table }) => [table, []]),
    ),
    factory: Object.fromEntries(factoryBackupTables.map(({ table }) => [table, []])),
    assets: Object.fromEntries(assetBackupTables.map(({ table }) => [table, []])),
  };
}

export function validateBackupExtensionData(backup) {
  if (Number(backup?.schemaVersion) < 15) {
    return;
  }

  const data = backup?.data;

  if (backup?.source !== "KRISHOE admin backup" || backup?.containsSensitiveData !== true) {
    throw new Error("Backup v15 source or sensitive-data marker is invalid.");
  }

  const coreCollections = [
    [["products"], ["products"]],
    [["orders"], ["orders"]],
    [["messages"], ["messages"]],
    [["users"], ["users"]],
    [["passwordResetTokens"], ["passwordResetTokens"]],
    [["emailVerificationTokens"], ["emailVerificationTokens"]],
    [["operations", "rawMaterials"], ["operations", "rawMaterials"]],
    [["operations", "materialConsumptions"], ["operations", "materialConsumptions"]],
    [["operations", "workerTasks"], ["operations", "workerTasks"]],
    [["operations", "productionBatches"], ["operations", "productionBatches"]],
    [["operations", "finishedStock"], ["operations", "finishedStock"]],
    [["operations", "vehicleDispatches"], ["operations", "vehicleDispatches"]],
    [["operations", "vehicleDispatchItems"], ["operations", "vehicleDispatchItems"]],
    [["operations", "customerLedgers"], ["operations", "customerLedgers"]],
    [["operations", "stockMovements"], ["operations", "stockMovements"]],
    [["operations", "ledgerTransactions"], ["operations", "ledgerTransactions"]],
    [["paymentTransactions"], ["paymentTransactions"]],
    [["posInvoices"], ["posInvoices"]],
    [["purchasing", "supplierLedgers"], ["purchasing", "supplierLedgers"]],
    [["purchasing", "purchaseInvoices"], ["purchasing", "purchaseInvoices"]],
    [["purchasing", "supplierTransactions"], ["purchasing", "supplierTransactions"]],
    [["hr", "employees"], ["hr", "employees"]],
    [["hr", "attendanceRecords"], ["hr", "attendanceRecords"]],
    [["hr", "payrollRecords"], ["hr", "payrollRecords"]],
    [["adminSettings", "branches"], ["adminSettings", "branches"]],
    [["adminSettings", "staff"], ["adminSettings", "staff"]],
    [["audit"], ["audit"]],
    [["notifications"], ["notifications"]],
  ];
  const atPath = (root, path) => path.reduce((value, key) => value?.[key], root);

  for (const [dataPath, countPath] of coreCollections) {
    const rows = atPath(data, dataPath);
    const count = atPath(backup?.counts, countPath);
    const label = dataPath.join(".");
    if (!Array.isArray(rows)) {
      throw new Error(`Backup v15 is missing data.${label}.`);
    }
    if (!Number.isInteger(count) || count !== rows.length) {
      throw new Error(`Backup v15 count mismatch for ${label}: expected ${rows.length}, got ${count}.`);
    }
  }

  if (!data?.costingSettings || typeof data.costingSettings !== "object" || Array.isArray(data.costingSettings)) {
    throw new Error("Backup v15 is missing data.costingSettings.");
  }
  if (backup?.counts?.costingSettings !== 1) {
    throw new Error("Backup v15 costing settings count must be 1.");
  }
  if (
    !data?.adminSettings?.company ||
    typeof data.adminSettings.company !== "object" ||
    Array.isArray(data.adminSettings.company)
  ) {
    throw new Error("Backup v15 is missing data.adminSettings.company.");
  }
  if (backup?.counts?.adminSettings?.company !== 1) {
    throw new Error("Backup v15 company settings count must be 1.");
  }

  const groupNames = [...new Set(backupExtensionTableSpecs.map(({ group }) => group))];

  for (const groupName of groupNames) {
    const group = data?.[groupName];
    const allowedTables = new Set(
      backupExtensionTableSpecs
        .filter(({ group: specGroup }) => specGroup === groupName)
        .map(({ table }) => table),
    );

    if (!group || typeof group !== "object" || Array.isArray(group)) {
      throw new Error(`Backup v15 is missing data.${groupName}.`);
    }

    for (const tableName of Object.keys(group)) {
      if (!allowedTables.has(tableName)) {
        throw new Error(`Backup v15 contains unapproved table data.${groupName}.${tableName}.`);
      }
    }
  }

  for (const spec of backupExtensionTableSpecs) {
    const rows = data?.[spec.group]?.[spec.table];

    if (!Array.isArray(rows)) {
      throw new Error(`Backup v15 is missing data.${spec.group}.${spec.table}.`);
    }

    const declaredCount = backup?.counts?.[spec.group]?.[spec.table];
    if (!Number.isInteger(declaredCount) || declaredCount !== rows.length) {
      throw new Error(
        `Backup v15 count mismatch for ${spec.group}.${spec.table}: expected ${rows.length}, got ${declaredCount}.`,
      );
    }

    const allowedColumns = new Set(spec.columns);

    rows.forEach((row, index) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error(`Backup v15 ${spec.table}[${index}] is not an object.`);
      }

      for (const column of Object.keys(row)) {
        if (!allowedColumns.has(column)) {
          throw new Error(`Backup v15 ${spec.table}[${index}] contains unapproved column ${column}.`);
        }
      }

      for (const column of spec.columns) {
        if (!Object.hasOwn(row, column)) {
          throw new Error(`Backup v15 ${spec.table}[${index}] is missing column ${column}.`);
        }
      }

      if (typeof row.id !== "string" || !row.id.trim()) {
        throw new Error(`Backup v15 ${spec.table}[${index}] has an invalid id.`);
      }

      if (spec.table === "uploaded_images") {
        const normalizedBytes = typeof row.bytes === "string" ? row.bytes.replace(/\s/g, "") : "";
        if (
          typeof row.bytes !== "string" ||
          normalizedBytes.length % 4 !== 0 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedBytes)
        ) {
          throw new Error(`Backup v15 uploaded_images[${index}] has invalid base64 bytes.`);
        }
        const decodedSize = Buffer.from(normalizedBytes, "base64").byteLength;
        if (!Number.isInteger(row.byte_size) || row.byte_size < 0 || decodedSize !== row.byte_size) {
          throw new Error(`Backup v15 uploaded_images[${index}] byte size does not match.`);
        }
      }
    });
  }

  const orders = data?.orders;
  const purchaseInvoices = data?.purchasing?.purchaseInvoices;
  if (!Array.isArray(orders) || !Array.isArray(purchaseInvoices)) {
    throw new Error("Backup v15 is missing orders or purchasing.purchaseInvoices.");
  }
  if (orders.some((order) => !Array.isArray(order?.items))) {
    throw new Error("Backup v15 contains an order without an items array.");
  }
  if (purchaseInvoices.some((invoice) => !Array.isArray(invoice?.items))) {
    throw new Error("Backup v15 contains a purchase invoice without an items array.");
  }

  const orderItemCount = orders.reduce((sum, order) => sum + order.items.length, 0);
  const purchaseItemCount = purchaseInvoices.reduce(
    (sum, invoice) => sum + invoice.items.length,
    0,
  );
  if (backup?.counts?.orderItems !== orderItemCount) {
    throw new Error(
      `Backup v15 order item count mismatch: expected ${orderItemCount}, got ${backup?.counts?.orderItems}.`,
    );
  }
  if (backup?.counts?.purchasing?.purchaseInvoiceItems !== purchaseItemCount) {
    throw new Error(
      `Backup v15 purchase item count mismatch: expected ${purchaseItemCount}, got ${backup?.counts?.purchasing?.purchaseInvoiceItems}.`,
    );
  }
}
