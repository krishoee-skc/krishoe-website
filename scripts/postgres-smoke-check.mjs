#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const backupSchemaVersion = 13;
const supportedBackupSchemaVersions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, backupSchemaVersion];

const countTables = [
  ["products", "products"],
  ["users", "users"],
  ["passwordResetTokens", "password_reset_tokens"],
  ["orders", "orders"],
  ["paymentTransactions", "payment_transactions"],
  ["posInvoices", "pos_invoices"],
  ["supplierLedgers", "supplier_ledgers"],
  ["purchaseInvoices", "purchase_invoices"],
  ["supplierTransactions", "supplier_transactions"],
  ["costingSettings", "costing_settings"],
  ["hrEmployees", "hr_employees"],
  ["hrAttendance", "hr_attendance"],
  ["hrPayroll", "hr_payroll"],
  ["companySettings", "company_settings"],
  ["companyBranches", "company_branches"],
  ["adminStaffAccounts", "admin_staff_accounts"],
  ["messages", "contact_messages"],
  ["rawMaterials", "raw_materials"],
  ["materialConsumptions", "material_consumptions"],
  ["productionBatches", "production_batches"],
  ["workerTasks", "worker_tasks"],
  ["finishedStock", "finished_stock"],
  ["stockMovements", "stock_movements"],
  ["vehicleDispatches", "vehicle_dispatches"],
  ["vehicleDispatchItems", "vehicle_dispatch_items"],
  ["customerLedgers", "customer_ledgers"],
  ["ledgerTransactions", "ledger_transactions"],
  ["audit", "admin_audit_events"],
  ["notifications", "notification_events"],
  ["rateLimitAttempts", "rate_limit_attempts"],
];

function usage() {
  return [
    "Usage:",
    "  npm run db:smoke",
    "  npm run db:smoke -- path/to/krishoe-backup-v13.json",
    "",
    "Options:",
    "  --database-url=<postgres-url>  Override DATABASE_URL.",
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
    backupPath: "",
    databaseUrl: "",
  };

  for (const value of argv) {
    if (value.startsWith("--database-url=")) {
      args.databaseUrl = value.slice("--database-url=".length);
    } else if (!args.backupPath) {
      args.backupPath = value;
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

function numberValue(value) {
  return Number(value) || 0;
}

function ensureBackupShape(backup) {
  if (!backup || typeof backup !== "object") {
    throw new Error("Backup file is not a JSON object.");
  }

  if (!supportedBackupSchemaVersions.includes(backup.schemaVersion)) {
    throw new Error(
      `Expected backup schemaVersion ${supportedBackupSchemaVersions.join(" or ")}, got ${backup.schemaVersion}.`,
    );
  }
}

function expectedCountsFromBackup(backup) {
  const counts = backup.counts ?? {};
  const operations = counts.operations ?? {};
  const purchasing = counts.purchasing ?? {};
  const hr = counts.hr ?? {};
  const adminSettings = counts.adminSettings ?? {};

  return {
    products: counts.products,
    users: counts.users,
    passwordResetTokens: counts.passwordResetTokens,
    orders: counts.orders,
    paymentTransactions: counts.paymentTransactions,
    posInvoices: counts.posInvoices,
    supplierLedgers: purchasing.supplierLedgers,
    purchaseInvoices: purchasing.purchaseInvoices,
    supplierTransactions: purchasing.supplierTransactions,
    costingSettings: counts.costingSettings,
    hrEmployees: hr.employees,
    hrAttendance: hr.attendanceRecords,
    hrPayroll: hr.payrollRecords,
    companySettings: adminSettings.company,
    companyBranches: adminSettings.branches,
    adminStaffAccounts: adminSettings.staff,
    messages: counts.messages,
    rawMaterials: operations.rawMaterials,
    materialConsumptions: operations.materialConsumptions,
    productionBatches: operations.productionBatches,
    workerTasks: operations.workerTasks,
    finishedStock: operations.finishedStock,
    stockMovements: operations.stockMovements,
    vehicleDispatches: operations.vehicleDispatches,
    vehicleDispatchItems: operations.vehicleDispatchItems,
    customerLedgers: operations.customerLedgers,
    ledgerTransactions: operations.ledgerTransactions,
    audit: counts.audit,
    notifications: counts.notifications,
  };
}

async function countTable(client, tableName) {
  const result = await client.query(`SELECT count(*) AS count FROM ${tableName}`);
  return numberValue(result.rows[0]?.count);
}

async function getCounts(client) {
  const entries = await Promise.all(
    countTables.map(async ([key, tableName]) => [key, await countTable(client, tableName)]),
  );

  return Object.fromEntries(entries);
}

async function scalar(client, sql) {
  const result = await client.query(sql);
  return numberValue(result.rows[0]?.value);
}

async function getIntegrity(client) {
  return {
    duplicateLowercaseEmails: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM (
          SELECT lower(email)
          FROM users
          GROUP BY lower(email)
          HAVING count(*) > 1
        ) duplicates
      `,
    ),
    orphanPasswordResetTokens: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM password_reset_tokens tokens
        LEFT JOIN users ON lower(users.email) = lower(tokens.email)
        WHERE users.id IS NULL
      `,
    ),
    orphanOrderCustomerUsers: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM orders
        LEFT JOIN users ON users.id = orders.customer_user_id
        WHERE orders.customer_user_id IS NOT NULL
          AND users.id IS NULL
      `,
    ),
    duplicateLowercaseAdminEmails: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM (
          SELECT lower(email)
          FROM admin_staff_accounts
          GROUP BY lower(email)
          HAVING count(*) > 1
        ) duplicates
      `,
    ),
    orphanAdminStaffBranches: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM admin_staff_accounts staff
        LEFT JOIN company_branches branches ON branches.id = staff.branch_id
        WHERE branches.id IS NULL
      `,
    ),
    orphanLedgerTransactions: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM ledger_transactions transactions
        LEFT JOIN customer_ledgers ledgers ON ledgers.id = transactions.ledger_id
        WHERE ledgers.id IS NULL
      `,
    ),
    orphanMaterialConsumptionBatches: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM material_consumptions consumptions
        LEFT JOIN production_batches batches ON batches.id = consumptions.batch_id
        WHERE batches.id IS NULL
      `,
    ),
    orphanMaterialConsumptionMaterials: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM material_consumptions consumptions
        LEFT JOIN raw_materials materials ON materials.id = consumptions.material_id
        WHERE consumptions.material_id IS NOT NULL AND materials.id IS NULL
      `,
    ),
    orphanWorkerTaskBatches: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM worker_tasks tasks
        LEFT JOIN production_batches batches ON batches.id = tasks.batch_id
        WHERE tasks.batch_id IS NOT NULL AND batches.id IS NULL
      `,
    ),
    orphanVehicleDispatchItems: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM vehicle_dispatch_items items
        LEFT JOIN vehicle_dispatches dispatches ON dispatches.id = items.dispatch_id
        WHERE dispatches.id IS NULL
      `,
    ),
    orphanVehicleDispatchItemStockMovements: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM vehicle_dispatch_items items
        CROSS JOIN LATERAL unnest(items.stock_movement_ids) AS linked_movement(id)
        LEFT JOIN stock_movements movements ON movements.id = linked_movement.id
        WHERE movements.id IS NULL
      `,
    ),
    duplicatePaymentCallbackIds: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM (
          SELECT payment_callback_id
          FROM orders
          WHERE payment_callback_id IS NOT NULL AND payment_callback_id <> ''
          GROUP BY payment_callback_id
          HAVING count(*) > 1
        ) duplicates
      `,
    ),
    duplicatePaymentTransactionCallbackIds: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM (
          SELECT payment_callback_id
          FROM payment_transactions
          WHERE payment_callback_id IS NOT NULL AND payment_callback_id <> ''
          GROUP BY payment_callback_id
          HAVING count(*) > 1
        ) duplicates
      `,
    ),
    orphanPaymentTransactionOrders: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM payment_transactions transactions
        LEFT JOIN orders ON orders.id = transactions.order_id
        WHERE orders.id IS NULL
      `,
    ),
    orphanPaymentTransactionLedgers: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM payment_transactions transactions
        LEFT JOIN customer_ledgers ledgers ON ledgers.id = transactions.ledger_id
        WHERE transactions.ledger_id IS NOT NULL AND ledgers.id IS NULL
      `,
    ),
    orphanPaymentTransactionLedgerTransactions: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM payment_transactions transactions
        LEFT JOIN ledger_transactions ledger_transactions
          ON ledger_transactions.id = transactions.ledger_transaction_id
        WHERE transactions.ledger_transaction_id IS NOT NULL
          AND ledger_transactions.id IS NULL
      `,
    ),
    duplicatePosInvoiceNumbers: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM (
          SELECT invoice_number
          FROM pos_invoices
          GROUP BY invoice_number
          HAVING count(*) > 1
        ) duplicates
      `,
    ),
    orphanPosInvoiceLedgers: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM pos_invoices invoices
        LEFT JOIN customer_ledgers ledgers ON ledgers.id = invoices.ledger_id
        WHERE invoices.ledger_id IS NOT NULL AND ledgers.id IS NULL
      `,
    ),
    orphanPosInvoiceLedgerTransactions: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM pos_invoices invoices
        LEFT JOIN ledger_transactions transactions
          ON transactions.id = invoices.ledger_transaction_id
        WHERE invoices.ledger_transaction_id IS NOT NULL
          AND transactions.id IS NULL
      `,
    ),
    orphanPosInvoiceStockMovements: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM pos_invoices invoices
        CROSS JOIN LATERAL unnest(invoices.stock_movement_ids) AS linked_movement(id)
        LEFT JOIN stock_movements movements ON movements.id = linked_movement.id
        WHERE movements.id IS NULL
      `,
    ),
    duplicatePurchaseNumbers: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM (
          SELECT purchase_number
          FROM purchase_invoices
          GROUP BY purchase_number
          HAVING count(*) > 1
        ) duplicates
      `,
    ),
    orphanPurchaseInvoiceSupplierLedgers: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM purchase_invoices invoices
        LEFT JOIN supplier_ledgers suppliers ON suppliers.id = invoices.supplier_ledger_id
        WHERE suppliers.id IS NULL
      `,
    ),
    orphanPurchaseInvoiceRawMaterials: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM purchase_invoices invoices
        LEFT JOIN raw_materials materials ON materials.id = invoices.material_id
        WHERE materials.id IS NULL
      `,
    ),
    orphanPurchaseInvoiceSupplierTransactions: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM purchase_invoices invoices
        CROSS JOIN LATERAL unnest(invoices.supplier_transaction_ids) AS linked_transaction(id)
        LEFT JOIN supplier_transactions transactions ON transactions.id = linked_transaction.id
        WHERE transactions.id IS NULL
      `,
    ),
    orphanSupplierTransactions: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM supplier_transactions transactions
        LEFT JOIN supplier_ledgers suppliers ON suppliers.id = transactions.supplier_ledger_id
        WHERE suppliers.id IS NULL
      `,
    ),
    orphanHrAttendanceEmployees: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM hr_attendance attendance
        LEFT JOIN hr_employees employees ON employees.id = attendance.employee_id
        WHERE employees.id IS NULL
      `,
    ),
    orphanHrPayrollEmployees: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM hr_payroll payroll
        LEFT JOIN hr_employees employees ON employees.id = payroll.employee_id
        WHERE employees.id IS NULL
      `,
    ),
    stockMovementsWithoutStockRow: await scalar(
      client,
      `
        SELECT count(*) AS value
        FROM stock_movements movements
        LEFT JOIN finished_stock stock
          ON lower(stock.design) = lower(movements.design)
          AND stock.channel = movements.channel
        WHERE stock.id IS NULL
      `,
    ),
    negativeProductStock: await scalar(
      client,
      "SELECT count(*) AS value FROM products WHERE stock < 0 OR price_value < 0",
    ),
    negativeOperationsNumbers: await scalar(
      client,
      `
        SELECT
          (
            SELECT count(*) FROM raw_materials
            WHERE opening_stock < 0 OR used < 0 OR received < 0 OR reorder_level < 0
          ) +
          (
            SELECT count(*) FROM production_batches
            WHERE planned_pairs < 0 OR finished_pairs < 0 OR in_progress_pairs < 0 OR rejected_pairs < 0
          ) +
          (
            SELECT count(*) FROM worker_tasks
            WHERE target_pairs < 0 OR completed_pairs < 0
          ) +
          (
            SELECT count(*) FROM finished_stock
            WHERE stock_pairs < 0 OR sold_pairs < 0 OR returned_pairs < 0
          ) +
          (
            SELECT count(*) FROM vehicle_dispatches
            WHERE loaded_pairs < 0 OR returned_pairs < 0 OR cash_collected < 0 OR cheque_collected < 0 OR credit_amount < 0
          ) +
          (
            SELECT count(*) FROM vehicle_dispatch_items
            WHERE loaded_pairs < 0 OR sold_pairs < 0 OR returned_pairs < 0
              OR cash_collected < 0 OR cheque_collected < 0 OR credit_amount < 0
          ) +
          (
            SELECT count(*) FROM customer_ledgers
            WHERE cash_paid < 0 OR cheque_paid < 0 OR credit_given < 0 OR balance_due < 0
          ) +
          (
            SELECT count(*) FROM stock_movements
            WHERE pairs < 0
          ) +
          (
            SELECT count(*) FROM material_consumptions
            WHERE quantity < 0 OR wastage < 0
          ) +
          (
            SELECT count(*) FROM ledger_transactions
            WHERE amount < 0
          ) +
          (
            SELECT count(*) FROM payment_transactions
            WHERE amount < 0
          ) +
          (
            SELECT count(*) FROM pos_invoices
            WHERE subtotal < 0 OR discount < 0 OR tax < 0 OR total < 0
              OR paid_amount < 0 OR credit_amount < 0
          ) +
          (
            SELECT count(*) FROM supplier_ledgers
            WHERE total_purchase < 0 OR paid_amount < 0 OR balance_due < 0
          ) +
          (
            SELECT count(*) FROM supplier_transactions
            WHERE amount < 0
          ) +
          (
            SELECT count(*) FROM purchase_invoices
            WHERE quantity < 0 OR rate < 0 OR discount < 0 OR tax < 0
              OR total < 0 OR paid_amount < 0 OR credit_amount < 0
          ) +
          (
            SELECT count(*) FROM costing_settings
            WHERE factory_overhead_per_pair < 0 OR electricity_per_pair < 0
              OR rent_per_pair < 0 OR miscellaneous_per_pair < 0
              OR monthly_fixed_overhead < 0 OR monthly_capacity_pairs <= 0
          ) +
          (
            SELECT count(*) FROM hr_employees
            WHERE base_salary < 0 OR daily_wage < 0 OR piece_rate < 0
          ) +
          (
            SELECT count(*) FROM hr_attendance
            WHERE overtime_hours < 0
          ) +
          (
            SELECT count(*) FROM hr_payroll
            WHERE base_amount < 0 OR attendance_bonus < 0 OR piece_amount < 0
              OR overtime_amount < 0 OR deduction < 0 OR net_pay < 0
          ) AS value
      `,
    ),
  };
}

async function getOperationTotals(client) {
  const result = await client.query(
    `
      SELECT
        (SELECT coalesce(sum(planned_pairs), 0) FROM production_batches) AS planned_pairs,
        (SELECT coalesce(sum(finished_pairs), 0) FROM production_batches) AS finished_pairs,
        (SELECT coalesce(sum(in_progress_pairs), 0) FROM production_batches) AS in_progress_pairs,
        (SELECT coalesce(sum(rejected_pairs), 0) FROM production_batches) AS rejected_pairs,
        (SELECT coalesce(sum(stock_pairs), 0) FROM finished_stock) AS stock_pairs,
        (SELECT coalesce(sum(sold_pairs), 0) FROM finished_stock) AS sold_pairs,
        (SELECT coalesce(sum(returned_pairs), 0) FROM finished_stock) AS returned_pairs,
        (SELECT coalesce(sum(balance_due), 0) FROM customer_ledgers) AS receivable,
        (SELECT coalesce(sum(cash_collected), 0) FROM vehicle_dispatches) AS cash,
        (SELECT coalesce(sum(cheque_collected), 0) FROM vehicle_dispatches) AS cheque,
        (SELECT coalesce(sum(credit_amount), 0) FROM vehicle_dispatches) AS credit,
        (SELECT coalesce(sum(loaded_pairs), 0) FROM vehicle_dispatch_items) AS item_loaded_pairs,
        (SELECT coalesce(sum(sold_pairs), 0) FROM vehicle_dispatch_items) AS item_sold_pairs,
        (SELECT coalesce(sum(returned_pairs), 0) FROM vehicle_dispatch_items) AS item_returned_pairs,
        (SELECT coalesce(sum(cash_collected), 0) FROM vehicle_dispatch_items) AS item_cash,
        (SELECT coalesce(sum(cheque_collected), 0) FROM vehicle_dispatch_items) AS item_cheque,
        (SELECT coalesce(sum(credit_amount), 0) FROM vehicle_dispatch_items) AS item_credit
    `,
  );
  const row = result.rows[0] ?? {};

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, numberValue(value)]),
  );
}

function compareCounts(actual, expected) {
  return Object.entries(expected)
    .filter(([, expectedValue]) => typeof expectedValue === "number")
    .map(([key, expectedValue]) => ({
      key,
      expected: expectedValue,
      actual: actual[key],
      ok: actual[key] === expectedValue,
    }));
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

  let backup = null;

  if (args.backupPath) {
    const backupPath = path.resolve(process.cwd(), args.backupPath);
    backup = JSON.parse(await readFile(backupPath, "utf8"));
    ensureBackupShape(backup);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

  try {
    const counts = await getCounts(client);
    const comparisons = backup ? compareCounts(counts, expectedCountsFromBackup(backup)) : [];
    const integrity = await getIntegrity(client);
    const operationTotals = await getOperationTotals(client);
    const failures = [
      ...comparisons
        .filter((comparison) => !comparison.ok)
        .map(
          (comparison) =>
            `${comparison.key} count mismatch: expected ${comparison.expected}, got ${comparison.actual}`,
        ),
      ...Object.entries(integrity)
        .filter(([, value]) => value !== 0)
        .map(([key, value]) => `${key}=${value}`),
    ];

    const result = {
      ok: failures.length === 0,
      checkedAt: new Date().toISOString(),
      database: safeDatabaseLabel(databaseUrl),
      backupCompared: Boolean(backup),
      counts,
      comparisons,
      integrity,
      operationTotals,
      failures,
    };

    console.log(JSON.stringify(result, null, 2));

    if (!result.ok) {
      process.exitCode = 1;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
