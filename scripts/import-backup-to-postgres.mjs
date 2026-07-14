#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const backupSchemaVersion = 13;
const supportedBackupSchemaVersions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, backupSchemaVersion];
const hashedResetTokenPrefix = "sha256:";
const productionStations = ["Cutting", "Stitching", "Sole Press", "Finishing", "Packing", "QC"];
const hrDepartments = [...productionStations, "Administration", "Sales", "Marketing", "Dispatch"];
const appTables = [
  "rate_limit_attempts",
  "payment_transactions",
  "pos_invoices",
  "purchase_invoices",
  "supplier_transactions",
  "costing_settings",
  "hr_payroll",
  "hr_attendance",
  "password_reset_tokens",
  "ledger_transactions",
  "stock_movements",
  "material_consumptions",
  "notification_events",
  "admin_audit_events",
  "admin_staff_accounts",
  "company_settings",
  "company_branches",
  "contact_messages",
  "orders",
  "worker_tasks",
  "vehicle_dispatch_items",
  "production_batches",
  "vehicle_dispatches",
  "finished_stock",
  "raw_materials",
  "customer_ledgers",
  "supplier_ledgers",
  "hr_employees",
  "products",
  "users",
];

function usage() {
  return [
    "Usage:",
    "  npm run db:import -- path/to/krishoe-backup-v13.json",
    "  npm run db:import -- path/to/krishoe-backup-v13.json --dry-run",
    "  npm run db:import -- path/to/krishoe-backup-v13.json --replace --confirm-replace",
    "",
    "Options:",
    "  --dry-run           Validate backup shape and print import counts without connecting to Postgres.",
    "  --replace           Truncate app tables before import. Requires --confirm-replace.",
    "  --confirm-replace   Explicit confirmation for destructive preview/restore imports.",
    "  --database-url=...  Override DATABASE_URL.",
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
    replace: false,
    confirmReplace: false,
    dryRun: false,
    databaseUrl: "",
  };

  for (const value of argv) {
    if (value === "--replace") {
      args.replace = true;
    } else if (value === "--confirm-replace") {
      args.confirmReplace = true;
    } else if (value === "--dry-run") {
      args.dryRun = true;
    } else if (value.startsWith("--database-url=")) {
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

function backupCountSummary(backup) {
  const counts = backup.counts ?? {};
  const operations = counts.operations ?? {};
  const purchasing = counts.purchasing ?? {};
  const hr = counts.hr ?? {};
  const adminSettings = counts.adminSettings ?? {};

  return {
    products: counts.products ?? 0,
    users: counts.users ?? 0,
    passwordResetTokens: counts.passwordResetTokens ?? 0,
    orders: counts.orders ?? 0,
    messages: counts.messages ?? 0,
    paymentTransactions: counts.paymentTransactions ?? 0,
    posInvoices: counts.posInvoices ?? 0,
    audit: counts.audit ?? 0,
    notifications: counts.notifications ?? 0,
    operationsRows: Object.values(operations).reduce((sum, value) => sum + (Number(value) || 0), 0),
    purchasingRows: Object.values(purchasing).reduce((sum, value) => sum + (Number(value) || 0), 0),
    hrRows: Object.values(hr).reduce((sum, value) => sum + (Number(value) || 0), 0),
    companyBranches: adminSettings.branches ?? 0,
    adminStaffAccounts: adminSettings.staff ?? 0,
  };
}

function requiredString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function storagePasswordResetToken(value) {
  const token = requiredString(value);

  if (!token || token.startsWith(hashedResetTokenPrefix)) {
    return token;
  }

  return `${hashedResetTokenPrefix}${createHash("sha256").update(token).digest("hex")}`;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
}

function cleanNumber(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function cleanDecimal(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric * 100) / 100) : 0;
}

function cleanWholeNumber(value, fallback = 1) {
  return Math.max(1, Math.round(Number(value) || fallback));
}

function allowedValue(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

function paymentProviderFromPreference(payment) {
  const normalized = requiredString(payment).toLowerCase();

  if (normalized.includes("esewa") && !normalized.includes("khalti")) {
    return "esewa";
  }

  if (normalized.includes("khalti") && !normalized.includes("esewa")) {
    return "khalti";
  }

  if (normalized.includes("bank") || normalized.includes("qr")) {
    return "bank";
  }

  if (normalized.includes("cod") || normalized.includes("cash on delivery")) {
    return "cod";
  }

  if (normalized.includes("cash") || normalized.includes("pickup")) {
    return "cash";
  }

  return "manual";
}

function dateValue(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function optionalDateValue(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function jsonString(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function laborRates(value) {
  const source = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    productionStations.map((station) => [station, cleanDecimal(source[station])]),
  );
}

async function upsertCostingSettings(client, settings = {}) {
  await client.query(
    `
      INSERT INTO costing_settings (
        id, updated_at, labor_rates, factory_overhead_per_pair,
        electricity_per_pair, rent_per_pair, miscellaneous_per_pair,
        monthly_fixed_overhead, monthly_capacity_pairs, note
      )
      VALUES ('default', $1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        updated_at = EXCLUDED.updated_at,
        labor_rates = EXCLUDED.labor_rates,
        factory_overhead_per_pair = EXCLUDED.factory_overhead_per_pair,
        electricity_per_pair = EXCLUDED.electricity_per_pair,
        rent_per_pair = EXCLUDED.rent_per_pair,
        miscellaneous_per_pair = EXCLUDED.miscellaneous_per_pair,
        monthly_fixed_overhead = EXCLUDED.monthly_fixed_overhead,
        monthly_capacity_pairs = EXCLUDED.monthly_capacity_pairs,
        note = EXCLUDED.note
    `,
    [
      dateValue(settings.updatedAt),
      jsonString(laborRates(settings.laborRates), {}),
      cleanDecimal(settings.factoryOverheadPerPair),
      cleanDecimal(settings.electricityPerPair),
      cleanDecimal(settings.rentPerPair),
      cleanDecimal(settings.miscellaneousPerPair),
      cleanDecimal(settings.monthlyFixedOverhead),
      cleanWholeNumber(settings.monthlyCapacityPairs),
      requiredString(settings.note),
    ],
  );
}

async function upsertHrEmployee(client, employee) {
  await client.query(
    `
      INSERT INTO hr_employees (
        id, created_at, name, phone, role, department, employment_type,
        salary_type, base_salary, daily_wage, piece_rate, status, joined_at,
        fingerprint_id, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        employment_type = EXCLUDED.employment_type,
        salary_type = EXCLUDED.salary_type,
        base_salary = EXCLUDED.base_salary,
        daily_wage = EXCLUDED.daily_wage,
        piece_rate = EXCLUDED.piece_rate,
        status = EXCLUDED.status,
        joined_at = EXCLUDED.joined_at,
        fingerprint_id = EXCLUDED.fingerprint_id,
        note = EXCLUDED.note
    `,
    [
      requiredString(employee.id),
      dateValue(employee.createdAt),
      requiredString(employee.name, "Unnamed employee"),
      requiredString(employee.phone),
      requiredString(employee.role),
      allowedValue(employee.department, hrDepartments, "Cutting"),
      allowedValue(employee.employmentType, ["Full Time", "Part Time", "Contract"], "Full Time"),
      allowedValue(employee.salaryType, ["Monthly", "Daily", "Piece Rate"], "Monthly"),
      cleanDecimal(employee.baseSalary),
      cleanDecimal(employee.dailyWage),
      cleanDecimal(employee.pieceRate),
      allowedValue(employee.status, ["Active", "Inactive"], "Active"),
      dateOnly(employee.joinedAt),
      requiredString(employee.fingerprintId),
      requiredString(employee.note),
    ],
  );
}

async function upsertHrAttendance(client, record) {
  await client.query(
    `
      INSERT INTO hr_attendance (
        id, created_at, employee_id, employee_name, work_date, status,
        check_in, check_out, overtime_hours, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        employee_id = EXCLUDED.employee_id,
        employee_name = EXCLUDED.employee_name,
        work_date = EXCLUDED.work_date,
        status = EXCLUDED.status,
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        overtime_hours = EXCLUDED.overtime_hours,
        note = EXCLUDED.note
    `,
    [
      requiredString(record.id),
      dateValue(record.createdAt),
      requiredString(record.employeeId),
      requiredString(record.employeeName, "Unnamed employee"),
      dateOnly(record.workDate),
      allowedValue(record.status, ["Present", "Half Day", "Leave", "Absent"], "Present"),
      requiredString(record.checkIn),
      requiredString(record.checkOut),
      cleanDecimal(record.overtimeHours),
      requiredString(record.note),
    ],
  );
}

async function upsertHrPayroll(client, record) {
  const baseAmount = cleanDecimal(record.baseAmount);
  const attendanceBonus = cleanDecimal(record.attendanceBonus);
  const pieceAmount = cleanDecimal(record.pieceAmount);
  const overtimeAmount = cleanDecimal(record.overtimeAmount);
  const deduction = cleanDecimal(record.deduction);
  const netPay = Math.max(0, baseAmount + attendanceBonus + pieceAmount + overtimeAmount - deduction);

  await client.query(
    `
      INSERT INTO hr_payroll (
        id, created_at, period_label, employee_id, employee_name, base_amount,
        attendance_bonus, piece_amount, overtime_amount, deduction, net_pay,
        status, paid_at, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        period_label = EXCLUDED.period_label,
        employee_id = EXCLUDED.employee_id,
        employee_name = EXCLUDED.employee_name,
        base_amount = EXCLUDED.base_amount,
        attendance_bonus = EXCLUDED.attendance_bonus,
        piece_amount = EXCLUDED.piece_amount,
        overtime_amount = EXCLUDED.overtime_amount,
        deduction = EXCLUDED.deduction,
        net_pay = EXCLUDED.net_pay,
        status = EXCLUDED.status,
        paid_at = EXCLUDED.paid_at,
        note = EXCLUDED.note
    `,
    [
      requiredString(record.id),
      dateValue(record.createdAt),
      requiredString(record.periodLabel),
      requiredString(record.employeeId),
      requiredString(record.employeeName, "Unnamed employee"),
      baseAmount,
      attendanceBonus,
      pieceAmount,
      overtimeAmount,
      deduction,
      netPay,
      allowedValue(record.status, ["Draft", "Approved", "Paid", "Locked"], "Draft"),
      optionalDateValue(record.paidAt),
      requiredString(record.note),
    ],
  );
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

  if (!backup.data || typeof backup.data !== "object") {
    throw new Error("Backup file is missing data.");
  }
}

async function upsertProduct(client, product) {
  await client.query(
    `
      INSERT INTO products (
        id, sku, name, category, category_slug, price, price_value, image, gallery, badge,
        rating, description, long_description, material, fit, colors, sizes, stock, highlights,
        care, reviews, status, featured, best_seller, new_arrival,
        wholesale_price_value, min_wholesale_qty, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21::jsonb, $22, $23, $24, $25, $26, $27, now()
      )
      ON CONFLICT (id) DO UPDATE SET
        sku = EXCLUDED.sku,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        category_slug = EXCLUDED.category_slug,
        price = EXCLUDED.price,
        price_value = EXCLUDED.price_value,
        image = EXCLUDED.image,
        gallery = EXCLUDED.gallery,
        badge = EXCLUDED.badge,
        rating = EXCLUDED.rating,
        description = EXCLUDED.description,
        long_description = EXCLUDED.long_description,
        material = EXCLUDED.material,
        fit = EXCLUDED.fit,
        colors = EXCLUDED.colors,
        sizes = EXCLUDED.sizes,
        stock = EXCLUDED.stock,
        highlights = EXCLUDED.highlights,
        care = EXCLUDED.care,
        reviews = EXCLUDED.reviews,
        status = EXCLUDED.status,
        featured = EXCLUDED.featured,
        best_seller = EXCLUDED.best_seller,
        new_arrival = EXCLUDED.new_arrival,
        wholesale_price_value = EXCLUDED.wholesale_price_value,
        min_wholesale_qty = EXCLUDED.min_wholesale_qty,
        updated_at = now()
    `,
    [
      requiredString(product.id),
      requiredString(product.sku, requiredString(product.id).toUpperCase()),
      requiredString(product.name),
      requiredString(product.category),
      requiredString(product.categorySlug),
      requiredString(product.price),
      cleanNumber(product.priceValue),
      requiredString(product.image),
      textArray(product.gallery),
      optionalString(product.badge),
      requiredString(product.rating, "4.8"),
      requiredString(product.description),
      requiredString(product.longDescription),
      requiredString(product.material),
      requiredString(product.fit),
      textArray(product.colors),
      textArray(product.sizes),
      cleanNumber(product.stock),
      textArray(product.highlights),
      textArray(product.care),
      jsonString(Array.isArray(product.reviews) ? product.reviews : [], []),
      product.status === "Draft" ? "Draft" : "Active",
      Boolean(product.featured),
      Boolean(product.bestSeller),
      Boolean(product.newArrival),
      cleanNumber(product.wholesalePriceValue),
      Math.max(1, cleanNumber(product.minWholesaleQty) || 1),
    ],
  );
}

async function upsertUser(client, user) {
  await client.query(
    `
      INSERT INTO users (id, name, email, password_hash, phone, address, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        updated_at = now()
    `,
    [
      requiredString(user.id),
      requiredString(user.name),
      requiredString(user.email).toLowerCase(),
      requiredString(user.passwordHash),
      optionalString(user.phone),
      optionalString(user.address),
      dateValue(user.createdAt),
    ],
  );
}

async function upsertPasswordResetToken(client, token) {
  await client.query(
    `
      INSERT INTO password_reset_tokens (token, email, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (token) DO UPDATE SET
        email = EXCLUDED.email,
        expires_at = EXCLUDED.expires_at
    `,
    [
      storagePasswordResetToken(token.token),
      requiredString(token.email).toLowerCase(),
      dateValue(token.expiresAt),
    ],
  );
}

async function upsertOrder(client, order) {
  const payment = requiredString(order.payment);

  await client.query(
    `
      INSERT INTO orders (
        id,
        created_at,
        customer_user_id,
        name,
        email,
        phone,
        address,
        delivery,
        payment,
        order_text,
        total,
        status,
        payment_status,
        payment_provider,
        payment_reference,
        payment_transaction_id,
        payment_callback_id,
        payment_verified_at,
        payment_ledger_id,
        payment_ledger_transaction_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        customer_user_id = EXCLUDED.customer_user_id,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        delivery = EXCLUDED.delivery,
        payment = EXCLUDED.payment,
        order_text = EXCLUDED.order_text,
        total = EXCLUDED.total,
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        payment_provider = EXCLUDED.payment_provider,
        payment_reference = EXCLUDED.payment_reference,
        payment_transaction_id = EXCLUDED.payment_transaction_id,
        payment_callback_id = EXCLUDED.payment_callback_id,
        payment_verified_at = EXCLUDED.payment_verified_at,
        payment_ledger_id = EXCLUDED.payment_ledger_id,
        payment_ledger_transaction_id = EXCLUDED.payment_ledger_transaction_id
    `,
    [
      requiredString(order.id),
      dateValue(order.createdAt),
      optionalString(order.customerUserId),
      requiredString(order.name),
      optionalString(order.email),
      requiredString(order.phone),
      requiredString(order.address),
      requiredString(order.delivery),
      payment,
      requiredString(order.order),
      requiredString(order.total),
      ["New", "Contacted", "Closed"].includes(order.status) ? order.status : "New",
      allowedValue(order.paymentStatus, ["Unpaid", "Pending", "Paid", "Failed", "Refunded"], "Unpaid"),
      allowedValue(
        order.paymentProvider,
        ["manual", "cod", "esewa", "khalti", "bank", "cash"],
        paymentProviderFromPreference(payment),
      ),
      requiredString(order.paymentReference),
      requiredString(order.paymentTransactionId),
      optionalString(order.paymentCallbackId),
      optionalDateValue(order.paymentVerifiedAt),
      optionalString(order.paymentLedgerId),
      optionalString(order.paymentLedgerTransactionId),
    ],
  );
}

async function upsertContactMessage(client, message) {
  await client.query(
    `
      INSERT INTO contact_messages (id, created_at, name, email, message, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        message = EXCLUDED.message,
        status = EXCLUDED.status
    `,
    [
      requiredString(message.id),
      dateValue(message.createdAt),
      requiredString(message.name),
      requiredString(message.email),
      requiredString(message.message),
      message.status === "Replied" ? "Replied" : "New",
    ],
  );
}

async function upsertRawMaterial(client, material) {
  await client.query(
    `
      INSERT INTO raw_materials (id, name, unit, opening_stock, used, received, reorder_level)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        unit = EXCLUDED.unit,
        opening_stock = EXCLUDED.opening_stock,
        used = EXCLUDED.used,
        received = EXCLUDED.received,
        reorder_level = EXCLUDED.reorder_level
    `,
    [
      requiredString(material.id),
      requiredString(material.name),
      material.unit,
      cleanNumber(material.openingStock),
      cleanNumber(material.used),
      cleanNumber(material.received),
      cleanNumber(material.reorderLevel),
    ],
  );
}

async function upsertProductionBatch(client, batch) {
  await client.query(
    `
      INSERT INTO production_batches (
        id, design, planned_pairs, finished_pairs, in_progress_pairs, rejected_pairs,
        raw_material_used, status, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      ON CONFLICT (id) DO UPDATE SET
        design = EXCLUDED.design,
        planned_pairs = EXCLUDED.planned_pairs,
        finished_pairs = EXCLUDED.finished_pairs,
        in_progress_pairs = EXCLUDED.in_progress_pairs,
        rejected_pairs = EXCLUDED.rejected_pairs,
        raw_material_used = EXCLUDED.raw_material_used,
        status = EXCLUDED.status,
        updated_at = now()
    `,
    [
      requiredString(batch.id),
      requiredString(batch.design),
      cleanNumber(batch.plannedPairs),
      cleanNumber(batch.finishedPairs),
      cleanNumber(batch.inProgressPairs),
      cleanNumber(batch.rejectedPairs),
      textArray(batch.rawMaterialUsed),
      ["Planning", "Cutting", "Making", "QC", "Packed"].includes(batch.status) ? batch.status : "Planning",
    ],
  );
}

async function upsertMaterialConsumption(client, consumption) {
  await client.query(
    `
      INSERT INTO material_consumptions (
        id, created_at, batch_id, batch_design, material_id, material_name, unit, quantity, wastage, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        batch_id = EXCLUDED.batch_id,
        batch_design = EXCLUDED.batch_design,
        material_id = EXCLUDED.material_id,
        material_name = EXCLUDED.material_name,
        unit = EXCLUDED.unit,
        quantity = EXCLUDED.quantity,
        wastage = EXCLUDED.wastage,
        note = EXCLUDED.note
    `,
    [
      requiredString(consumption.id),
      dateValue(consumption.createdAt),
      requiredString(consumption.batchId),
      requiredString(consumption.batchDesign),
      optionalString(consumption.materialId),
      requiredString(consumption.materialName),
      allowedValue(consumption.unit, ["kg", "meter", "pair", "piece", "liter"], "piece"),
      cleanNumber(consumption.quantity),
      cleanNumber(consumption.wastage),
      requiredString(consumption.note),
    ],
  );
}

async function upsertWorkerTask(client, task) {
  await client.query(
    `
      INSERT INTO worker_tasks (
        id, worker_name, station, batch_id, design, target_pairs, completed_pairs, status, camera_zone, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
      ON CONFLICT (id) DO UPDATE SET
        worker_name = EXCLUDED.worker_name,
        station = EXCLUDED.station,
        batch_id = EXCLUDED.batch_id,
        design = EXCLUDED.design,
        target_pairs = EXCLUDED.target_pairs,
        completed_pairs = EXCLUDED.completed_pairs,
        status = EXCLUDED.status,
        camera_zone = EXCLUDED.camera_zone,
        updated_at = now()
    `,
    [
      requiredString(task.id),
      requiredString(task.workerName),
      task.station,
      optionalString(task.batchId),
      requiredString(task.design),
      cleanNumber(task.targetPairs),
      cleanNumber(task.completedPairs),
      ["Not Started", "In Progress", "Paused", "Done"].includes(task.status) ? task.status : "Not Started",
      requiredString(task.cameraZone),
    ],
  );
}

async function upsertFinishedStock(client, stock) {
  await client.query(
    `
      INSERT INTO finished_stock (
        id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT (id) DO UPDATE SET
        design = EXCLUDED.design,
        channel = EXCLUDED.channel,
        size_run = EXCLUDED.size_run,
        stock_pairs = EXCLUDED.stock_pairs,
        sold_pairs = EXCLUDED.sold_pairs,
        returned_pairs = EXCLUDED.returned_pairs,
        updated_at = now()
    `,
    [
      requiredString(stock.id),
      requiredString(stock.design),
      stock.channel,
      requiredString(stock.sizeRun, "Mixed"),
      cleanNumber(stock.stockPairs),
      cleanNumber(stock.soldPairs),
      cleanNumber(stock.returnedPairs),
    ],
  );
}

async function upsertStockMovement(client, movement) {
  await client.query(
    `
      INSERT INTO stock_movements (id, created_at, design, channel, size_run, type, pairs, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        design = EXCLUDED.design,
        channel = EXCLUDED.channel,
        size_run = EXCLUDED.size_run,
        type = EXCLUDED.type,
        pairs = EXCLUDED.pairs,
        note = EXCLUDED.note
    `,
    [
      requiredString(movement.id),
      dateValue(movement.createdAt),
      requiredString(movement.design),
      movement.channel,
      requiredString(movement.sizeRun, "Mixed"),
      movement.type,
      cleanNumber(movement.pairs),
      requiredString(movement.note),
    ],
  );
}

async function upsertVehicleDispatch(client, dispatch) {
  await client.query(
    `
      INSERT INTO vehicle_dispatches (
        id, vehicle_number, driver_name, market_route, loaded_pairs, returned_pairs,
        cash_collected, cheque_collected, credit_amount, status, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      ON CONFLICT (id) DO UPDATE SET
        vehicle_number = EXCLUDED.vehicle_number,
        driver_name = EXCLUDED.driver_name,
        market_route = EXCLUDED.market_route,
        loaded_pairs = EXCLUDED.loaded_pairs,
        returned_pairs = EXCLUDED.returned_pairs,
        cash_collected = EXCLUDED.cash_collected,
        cheque_collected = EXCLUDED.cheque_collected,
        credit_amount = EXCLUDED.credit_amount,
        status = EXCLUDED.status,
        updated_at = now()
    `,
    [
      requiredString(dispatch.id),
      requiredString(dispatch.vehicleNumber),
      requiredString(dispatch.driverName),
      requiredString(dispatch.marketRoute),
      cleanNumber(dispatch.loadedPairs),
      cleanNumber(dispatch.returnedPairs),
      cleanNumber(dispatch.cashCollected),
      cleanNumber(dispatch.chequeCollected),
      cleanNumber(dispatch.creditAmount),
      dispatch.status,
    ],
  );
}

async function upsertVehicleDispatchItem(client, item) {
  await client.query(
    `
      INSERT INTO vehicle_dispatch_items (
        id, created_at, dispatch_id, vehicle_number, market_route, design, channel, size_run,
        loaded_pairs, sold_pairs, returned_pairs, cash_collected, cheque_collected, credit_amount, stock_movement_ids, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        dispatch_id = EXCLUDED.dispatch_id,
        vehicle_number = EXCLUDED.vehicle_number,
        market_route = EXCLUDED.market_route,
        design = EXCLUDED.design,
        channel = EXCLUDED.channel,
        size_run = EXCLUDED.size_run,
        loaded_pairs = EXCLUDED.loaded_pairs,
        sold_pairs = EXCLUDED.sold_pairs,
        returned_pairs = EXCLUDED.returned_pairs,
        cash_collected = EXCLUDED.cash_collected,
        cheque_collected = EXCLUDED.cheque_collected,
        credit_amount = EXCLUDED.credit_amount,
        stock_movement_ids = EXCLUDED.stock_movement_ids,
        note = EXCLUDED.note
    `,
    [
      requiredString(item.id),
      dateValue(item.createdAt),
      requiredString(item.dispatchId),
      requiredString(item.vehicleNumber),
      requiredString(item.marketRoute),
      requiredString(item.design),
      allowedValue(item.channel, ["Wholesale", "Retail", "Online"], "Wholesale"),
      requiredString(item.sizeRun, "Mixed"),
      cleanNumber(item.loadedPairs),
      cleanNumber(item.soldPairs),
      cleanNumber(item.returnedPairs),
      cleanNumber(item.cashCollected),
      cleanNumber(item.chequeCollected),
      cleanNumber(item.creditAmount),
      textArray(item.stockMovementIds),
      requiredString(item.note),
    ],
  );
}

async function upsertCustomerLedger(client, ledger) {
  await client.query(
    `
      INSERT INTO customer_ledgers (
        id, customer_name, channel, phone, cash_paid, cheque_paid, credit_given,
        balance_due, credit_limit, last_transaction, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      ON CONFLICT (id) DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        channel = EXCLUDED.channel,
        phone = EXCLUDED.phone,
        cash_paid = EXCLUDED.cash_paid,
        cheque_paid = EXCLUDED.cheque_paid,
        credit_given = EXCLUDED.credit_given,
        balance_due = EXCLUDED.balance_due,
        credit_limit = EXCLUDED.credit_limit,
        last_transaction = EXCLUDED.last_transaction,
        updated_at = now()
    `,
    [
      requiredString(ledger.id),
      requiredString(ledger.customerName),
      ledger.channel,
      requiredString(ledger.phone),
      cleanNumber(ledger.cashPaid),
      cleanNumber(ledger.chequePaid),
      cleanNumber(ledger.creditGiven),
      cleanNumber(ledger.balanceDue),
      cleanNumber(ledger.creditLimit),
      dateOnly(ledger.lastTransaction),
    ],
  );
}

async function upsertLedgerTransaction(client, transaction) {
  await client.query(
    `
      INSERT INTO ledger_transactions (id, created_at, ledger_id, customer_name, type, amount, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        ledger_id = EXCLUDED.ledger_id,
        customer_name = EXCLUDED.customer_name,
        type = EXCLUDED.type,
        amount = EXCLUDED.amount,
        note = EXCLUDED.note
    `,
    [
      requiredString(transaction.id),
      dateValue(transaction.createdAt),
      requiredString(transaction.ledgerId),
      requiredString(transaction.customerName),
      transaction.type,
      cleanNumber(transaction.amount),
      requiredString(transaction.note),
    ],
  );
}

async function upsertSupplierLedger(client, supplier) {
  await client.query(
    `
      INSERT INTO supplier_ledgers (
        id, supplier_name, phone, material_focus, total_purchase, paid_amount,
        balance_due, last_transaction, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      ON CONFLICT (id) DO UPDATE SET
        supplier_name = EXCLUDED.supplier_name,
        phone = EXCLUDED.phone,
        material_focus = EXCLUDED.material_focus,
        total_purchase = EXCLUDED.total_purchase,
        paid_amount = EXCLUDED.paid_amount,
        balance_due = EXCLUDED.balance_due,
        last_transaction = EXCLUDED.last_transaction,
        updated_at = now()
    `,
    [
      requiredString(supplier.id),
      requiredString(supplier.supplierName),
      requiredString(supplier.phone),
      requiredString(supplier.materialFocus),
      cleanNumber(supplier.totalPurchase),
      cleanNumber(supplier.paidAmount),
      cleanNumber(supplier.balanceDue),
      dateOnly(supplier.lastTransaction),
    ],
  );
}

async function upsertSupplierTransaction(client, transaction) {
  await client.query(
    `
      INSERT INTO supplier_transactions (
        id, created_at, supplier_ledger_id, supplier_name, type, amount, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        supplier_ledger_id = EXCLUDED.supplier_ledger_id,
        supplier_name = EXCLUDED.supplier_name,
        type = EXCLUDED.type,
        amount = EXCLUDED.amount,
        note = EXCLUDED.note
    `,
    [
      requiredString(transaction.id),
      dateValue(transaction.createdAt),
      requiredString(transaction.supplierLedgerId),
      requiredString(transaction.supplierName),
      allowedValue(
        transaction.type,
        [
          "Purchase Bill",
          "Cash Payment",
          "Cheque Payment",
          "Bank Payment",
          "Return Adjustment",
          "Manual Adjustment",
        ],
        "Manual Adjustment",
      ),
      cleanNumber(transaction.amount),
      requiredString(transaction.note),
    ],
  );
}

async function upsertPurchaseInvoice(client, invoice) {
  await client.query(
    `
      INSERT INTO purchase_invoices (
        id,
        purchase_number,
        created_at,
        supplier_ledger_id,
        supplier_name,
        material_id,
        material_name,
        unit,
        quantity,
        rate,
        discount,
        tax,
        total,
        paid_amount,
        credit_amount,
        payment_method,
        payment_reference,
        status,
        posting_status,
        supplier_transaction_ids,
        note
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21
      )
      ON CONFLICT (id) DO UPDATE SET
        purchase_number = EXCLUDED.purchase_number,
        created_at = EXCLUDED.created_at,
        supplier_ledger_id = EXCLUDED.supplier_ledger_id,
        supplier_name = EXCLUDED.supplier_name,
        material_id = EXCLUDED.material_id,
        material_name = EXCLUDED.material_name,
        unit = EXCLUDED.unit,
        quantity = EXCLUDED.quantity,
        rate = EXCLUDED.rate,
        discount = EXCLUDED.discount,
        tax = EXCLUDED.tax,
        total = EXCLUDED.total,
        paid_amount = EXCLUDED.paid_amount,
        credit_amount = EXCLUDED.credit_amount,
        payment_method = EXCLUDED.payment_method,
        payment_reference = EXCLUDED.payment_reference,
        status = EXCLUDED.status,
        posting_status = EXCLUDED.posting_status,
        supplier_transaction_ids = EXCLUDED.supplier_transaction_ids,
        note = EXCLUDED.note
    `,
    [
      requiredString(invoice.id),
      requiredString(invoice.purchaseNumber),
      dateValue(invoice.createdAt),
      requiredString(invoice.supplierLedgerId),
      requiredString(invoice.supplierName),
      requiredString(invoice.materialId),
      requiredString(invoice.materialName),
      allowedValue(invoice.unit, ["kg", "meter", "pair", "piece", "liter"], "piece"),
      cleanNumber(invoice.quantity),
      cleanNumber(invoice.rate),
      cleanNumber(invoice.discount),
      cleanNumber(invoice.tax),
      cleanNumber(invoice.total),
      cleanNumber(invoice.paidAmount),
      cleanNumber(invoice.creditAmount),
      allowedValue(invoice.paymentMethod, ["Cash", "Cheque", "Bank", "Credit"], "Cash"),
      requiredString(invoice.paymentReference),
      allowedValue(invoice.status, ["Paid", "Partial", "Credit"], "Paid"),
      allowedValue(invoice.postingStatus, ["Posted", "Needs Review"], "Needs Review"),
      textArray(invoice.supplierTransactionIds),
      requiredString(invoice.note),
    ],
  );
}

async function upsertPosInvoice(client, invoice) {
  await client.query(
    `
      INSERT INTO pos_invoices (
        id,
        invoice_number,
        created_at,
        channel,
        kind,
        customer_name,
        phone,
        cashier,
        payment_method,
        payment_reference,
        ledger_id,
        subtotal,
        discount,
        tax,
        total,
        paid_amount,
        credit_amount,
        status,
        posting_status,
        items,
        stock_movement_ids,
        ledger_transaction_id,
        barcode_value,
        qr_payload,
        note
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20::jsonb, $21, $22, $23, $24, $25
      )
      ON CONFLICT (id) DO UPDATE SET
        invoice_number = EXCLUDED.invoice_number,
        created_at = EXCLUDED.created_at,
        channel = EXCLUDED.channel,
        kind = EXCLUDED.kind,
        customer_name = EXCLUDED.customer_name,
        phone = EXCLUDED.phone,
        cashier = EXCLUDED.cashier,
        payment_method = EXCLUDED.payment_method,
        payment_reference = EXCLUDED.payment_reference,
        ledger_id = EXCLUDED.ledger_id,
        subtotal = EXCLUDED.subtotal,
        discount = EXCLUDED.discount,
        tax = EXCLUDED.tax,
        total = EXCLUDED.total,
        paid_amount = EXCLUDED.paid_amount,
        credit_amount = EXCLUDED.credit_amount,
        status = EXCLUDED.status,
        posting_status = EXCLUDED.posting_status,
        items = EXCLUDED.items,
        stock_movement_ids = EXCLUDED.stock_movement_ids,
        ledger_transaction_id = EXCLUDED.ledger_transaction_id,
        barcode_value = EXCLUDED.barcode_value,
        qr_payload = EXCLUDED.qr_payload,
        note = EXCLUDED.note
    `,
    [
      requiredString(invoice.id),
      requiredString(invoice.invoiceNumber),
      dateValue(invoice.createdAt),
      allowedValue(invoice.channel, ["Retail", "Wholesale", "Online"], "Retail"),
      allowedValue(invoice.kind, ["Sale", "Return"], "Sale"),
      requiredString(invoice.customerName, "Walk-in Customer"),
      requiredString(invoice.phone),
      requiredString(invoice.cashier, "Admin"),
      allowedValue(invoice.paymentMethod, ["Cash", "Cheque", "Credit", "QR", "eSewa", "Khalti", "Bank"], "Cash"),
      requiredString(invoice.paymentReference),
      optionalString(invoice.ledgerId),
      cleanNumber(invoice.subtotal),
      cleanNumber(invoice.discount),
      cleanNumber(invoice.tax),
      cleanNumber(invoice.total),
      cleanNumber(invoice.paidAmount),
      cleanNumber(invoice.creditAmount),
      allowedValue(invoice.status, ["Paid", "Partial", "Credit", "Returned", "Voided"], "Paid"),
      allowedValue(invoice.postingStatus, ["Posted", "Needs Review"], "Needs Review"),
      jsonString(Array.isArray(invoice.items) ? invoice.items : [], []),
      textArray(invoice.stockMovementIds),
      optionalString(invoice.ledgerTransactionId),
      requiredString(invoice.barcodeValue, requiredString(invoice.invoiceNumber)),
      requiredString(invoice.qrPayload),
      requiredString(invoice.note),
    ],
  );
}

async function upsertPaymentTransaction(client, transaction) {
  await client.query(
    `
      INSERT INTO payment_transactions (
        id,
        created_at,
        order_id,
        customer_name,
        amount,
        payment_status,
        payment_provider,
        payment_reference,
        payment_transaction_id,
        payment_callback_id,
        ledger_id,
        ledger_transaction_id,
        source,
        note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        order_id = EXCLUDED.order_id,
        customer_name = EXCLUDED.customer_name,
        amount = EXCLUDED.amount,
        payment_status = EXCLUDED.payment_status,
        payment_provider = EXCLUDED.payment_provider,
        payment_reference = EXCLUDED.payment_reference,
        payment_transaction_id = EXCLUDED.payment_transaction_id,
        payment_callback_id = EXCLUDED.payment_callback_id,
        ledger_id = EXCLUDED.ledger_id,
        ledger_transaction_id = EXCLUDED.ledger_transaction_id,
        source = EXCLUDED.source,
        note = EXCLUDED.note
    `,
    [
      requiredString(transaction.id),
      dateValue(transaction.createdAt),
      requiredString(transaction.orderId),
      requiredString(transaction.customerName),
      cleanNumber(transaction.amount),
      allowedValue(transaction.paymentStatus, ["Unpaid", "Pending", "Paid", "Failed", "Refunded"], "Pending"),
      allowedValue(
        transaction.paymentProvider,
        ["manual", "cod", "esewa", "khalti", "bank", "cash"],
        "manual",
      ),
      requiredString(transaction.paymentReference),
      requiredString(transaction.paymentTransactionId),
      optionalString(transaction.paymentCallbackId),
      optionalString(transaction.ledgerId),
      optionalString(transaction.ledgerTransactionId),
      allowedValue(transaction.source, ["admin", "gateway", "system"], "system"),
      requiredString(transaction.note),
    ],
  );
}

async function upsertAuditEvent(client, event) {
  await client.query(
    `
      INSERT INTO admin_audit_events (
        id, created_at, action, detail, status,
        actor_id, actor_name, actor_email, actor_role, actor_branch_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        action = EXCLUDED.action,
        detail = EXCLUDED.detail,
        status = EXCLUDED.status,
        actor_id = EXCLUDED.actor_id,
        actor_name = EXCLUDED.actor_name,
        actor_email = EXCLUDED.actor_email,
        actor_role = EXCLUDED.actor_role,
        actor_branch_id = EXCLUDED.actor_branch_id
    `,
    [
      requiredString(event.id),
      dateValue(event.createdAt),
      requiredString(event.action),
      requiredString(event.detail),
      event.status === "warning" ? "warning" : "success",
      requiredString(event.actorId),
      requiredString(event.actorName),
      requiredString(event.actorEmail),
      requiredString(event.actorRole),
      requiredString(event.actorBranchId),
    ],
  );
}

async function upsertNotificationEvent(client, event) {
  await client.query(
    `
      INSERT INTO notification_events (
        id,
        created_at,
        type,
        title,
        payload,
        delivery_status,
        delivery_attempts,
        delivered_at,
        last_delivery_error,
        last_delivery_channel
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        payload = EXCLUDED.payload,
        delivery_status = EXCLUDED.delivery_status,
        delivery_attempts = EXCLUDED.delivery_attempts,
        delivered_at = EXCLUDED.delivered_at,
        last_delivery_error = EXCLUDED.last_delivery_error,
        last_delivery_channel = EXCLUDED.last_delivery_channel
    `,
    [
      requiredString(event.id),
      dateValue(event.createdAt),
        allowedValue(event.type, ["order", "contact", "password-reset"], "order"),
      requiredString(event.title),
      jsonString(event.payload, {}),
      allowedValue(event.deliveryStatus, ["pending", "sent", "failed", "skipped"], "pending"),
      cleanNumber(event.deliveryAttempts),
      event.deliveredAt ? dateValue(event.deliveredAt) : null,
      requiredString(event.lastDeliveryError),
      requiredString(event.lastDeliveryChannel),
    ],
  );
}

async function upsertCompanySettings(client, settings = {}) {
  await client.query(
    `
      INSERT INTO company_settings (
        id, company_name, legal_name, phone, email, address, pan_vat_number,
        currency, timezone, default_branch_id, updated_at
      )
      VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        legal_name = EXCLUDED.legal_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        pan_vat_number = EXCLUDED.pan_vat_number,
        currency = EXCLUDED.currency,
        timezone = EXCLUDED.timezone,
        default_branch_id = EXCLUDED.default_branch_id,
        updated_at = EXCLUDED.updated_at
    `,
    [
      requiredString(settings.companyName, "KRISHOE"),
      requiredString(settings.legalName, "KRISHOE"),
      requiredString(settings.phone),
      requiredString(settings.email),
      requiredString(settings.address),
      requiredString(settings.panVatNumber),
      requiredString(settings.currency, "NPR").toUpperCase().slice(0, 3),
      requiredString(settings.timezone, "Asia/Kathmandu"),
      requiredString(settings.defaultBranchId),
      dateValue(settings.updatedAt),
    ],
  );
}

async function upsertCompanyBranch(client, branch) {
  await client.query(
    `
      INSERT INTO company_branches (id, name, code, type, phone, address, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        type = EXCLUDED.type,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `,
    [
      requiredString(branch.id),
      requiredString(branch.name, "Branch"),
      requiredString(branch.code, requiredString(branch.name, "BRANCH").toUpperCase().slice(0, 12)),
      allowedValue(branch.type, ["Factory", "Wholesale", "Retail", "Online", "Office"], "Office"),
      requiredString(branch.phone),
      requiredString(branch.address),
      allowedValue(branch.status, ["Active", "Inactive"], "Active"),
      dateValue(branch.createdAt),
      dateValue(branch.updatedAt),
    ],
  );
}

async function upsertAdminStaffAccount(client, staff) {
  await client.query(
    `
      INSERT INTO admin_staff_accounts (
        id, name, email, role, branch_id, status, password_hash, created_at, updated_at, last_login_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        branch_id = EXCLUDED.branch_id,
        status = EXCLUDED.status,
        password_hash = EXCLUDED.password_hash,
        updated_at = EXCLUDED.updated_at,
        last_login_at = EXCLUDED.last_login_at
    `,
    [
      requiredString(staff.id),
      requiredString(staff.name, "Admin Staff"),
      requiredString(staff.email).toLowerCase(),
      allowedValue(staff.role, ["Owner", "Manager", "Accountant", "HR", "Inventory", "Sales", "Viewer"], "Viewer"),
      requiredString(staff.branchId),
      allowedValue(staff.status, ["Active", "Disabled"], "Active"),
      requiredString(staff.passwordHash),
      dateValue(staff.createdAt),
      dateValue(staff.updatedAt),
      optionalDateValue(staff.lastLoginAt),
    ],
  );
}

async function importBackup(client, backup, replace) {
  const data = backup.data;
  const operations = data.operations ?? {};
  const purchasing = data.purchasing ?? {};
  const hr = data.hr ?? {};
  const adminSettings = data.adminSettings ?? {};
  const imported = {
    products: 0,
    users: 0,
    passwordResetTokens: 0,
    orders: 0,
    messages: 0,
    rawMaterials: 0,
    materialConsumptions: 0,
    productionBatches: 0,
    workerTasks: 0,
    finishedStock: 0,
    stockMovements: 0,
    vehicleDispatches: 0,
    vehicleDispatchItems: 0,
    customerLedgers: 0,
    ledgerTransactions: 0,
    supplierLedgers: 0,
    purchaseInvoices: 0,
    supplierTransactions: 0,
    costingSettings: 0,
    hrEmployees: 0,
    hrAttendance: 0,
    hrPayroll: 0,
    companyBranches: 0,
    adminStaffAccounts: 0,
    companySettings: 0,
    paymentTransactions: 0,
    posInvoices: 0,
    audit: 0,
    notifications: 0,
  };

  await client.query("BEGIN");

  try {
    if (replace) {
      await client.query(`TRUNCATE TABLE ${appTables.join(", ")} RESTART IDENTITY CASCADE`);
    }

    for (const product of data.products ?? []) {
      await upsertProduct(client, product);
      imported.products += 1;
    }

    for (const user of data.users ?? []) {
      await upsertUser(client, user);
      imported.users += 1;
    }

    for (const branch of adminSettings.branches ?? []) {
      await upsertCompanyBranch(client, branch);
      imported.companyBranches += 1;
    }

    if (adminSettings.company) {
      await upsertCompanySettings(client, adminSettings.company);
      imported.companySettings = 1;
    }

    for (const staff of adminSettings.staff ?? []) {
      await upsertAdminStaffAccount(client, staff);
      imported.adminStaffAccounts += 1;
    }

    for (const material of operations.rawMaterials ?? []) {
      await upsertRawMaterial(client, material);
      imported.rawMaterials += 1;
    }

    for (const stock of operations.finishedStock ?? []) {
      await upsertFinishedStock(client, stock);
      imported.finishedStock += 1;
    }

    for (const ledger of operations.customerLedgers ?? []) {
      await upsertCustomerLedger(client, ledger);
      imported.customerLedgers += 1;
    }

    for (const supplier of purchasing.supplierLedgers ?? []) {
      await upsertSupplierLedger(client, supplier);
      imported.supplierLedgers += 1;
    }

    if (data.costingSettings) {
      await upsertCostingSettings(client, data.costingSettings);
      imported.costingSettings = 1;
    }

    for (const employee of hr.employees ?? []) {
      await upsertHrEmployee(client, employee);
      imported.hrEmployees += 1;
    }

    for (const order of data.orders ?? []) {
      await upsertOrder(client, order);
      imported.orders += 1;
    }

    for (const message of data.messages ?? []) {
      await upsertContactMessage(client, message);
      imported.messages += 1;
    }

    for (const token of data.passwordResetTokens ?? []) {
      await upsertPasswordResetToken(client, token);
      imported.passwordResetTokens += 1;
    }

    for (const batch of operations.productionBatches ?? []) {
      await upsertProductionBatch(client, batch);
      imported.productionBatches += 1;
    }

    for (const consumption of operations.materialConsumptions ?? []) {
      await upsertMaterialConsumption(client, consumption);
      imported.materialConsumptions += 1;
    }

    for (const task of operations.workerTasks ?? []) {
      await upsertWorkerTask(client, task);
      imported.workerTasks += 1;
    }

    for (const dispatch of operations.vehicleDispatches ?? []) {
      await upsertVehicleDispatch(client, dispatch);
      imported.vehicleDispatches += 1;
    }

    for (const item of operations.vehicleDispatchItems ?? []) {
      await upsertVehicleDispatchItem(client, item);
      imported.vehicleDispatchItems += 1;
    }

    for (const movement of operations.stockMovements ?? []) {
      await upsertStockMovement(client, movement);
      imported.stockMovements += 1;
    }

    for (const transaction of operations.ledgerTransactions ?? []) {
      await upsertLedgerTransaction(client, transaction);
      imported.ledgerTransactions += 1;
    }

    for (const transaction of purchasing.supplierTransactions ?? []) {
      await upsertSupplierTransaction(client, transaction);
      imported.supplierTransactions += 1;
    }

    for (const invoice of purchasing.purchaseInvoices ?? []) {
      await upsertPurchaseInvoice(client, invoice);
      imported.purchaseInvoices += 1;
    }

    for (const invoice of data.posInvoices ?? []) {
      await upsertPosInvoice(client, invoice);
      imported.posInvoices += 1;
    }

    for (const record of hr.attendanceRecords ?? []) {
      await upsertHrAttendance(client, record);
      imported.hrAttendance += 1;
    }

    for (const record of hr.payrollRecords ?? []) {
      await upsertHrPayroll(client, record);
      imported.hrPayroll += 1;
    }

    for (const transaction of data.paymentTransactions ?? []) {
      await upsertPaymentTransaction(client, transaction);
      imported.paymentTransactions += 1;
    }

    for (const event of data.audit ?? []) {
      await upsertAuditEvent(client, event);
      imported.audit += 1;
    }

    for (const event of data.notifications ?? []) {
      await upsertNotificationEvent(client, event);
      imported.notifications += 1;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return imported;
}

async function main() {
  loadEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = args.databaseUrl || process.env.DATABASE_URL;

  if (!args.backupPath || (!databaseUrl && !args.dryRun)) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  if (args.replace && !args.confirmReplace) {
    throw new Error(
      "--replace truncates app tables before import. Add --confirm-replace only when DATABASE_URL points to a preview database or confirmed restore target.",
    );
  }

  const backupPath = path.resolve(process.cwd(), args.backupPath);
  const backup = JSON.parse(await readFile(backupPath, "utf8"));
  ensureBackupShape(backup);

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          checkedAt: new Date().toISOString(),
          backupPath,
          schemaVersion: backup.schemaVersion,
          exportedAt: backup.exportedAt,
          containsSensitiveData: backup.containsSensitiveData === true,
          counts: backupCountSummary(backup),
          note: "No Postgres connection was opened and no data was written.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

  try {
    const imported = await importBackup(client, backup, args.replace);
    console.log(JSON.stringify({ ok: true, replace: args.replace, imported }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
