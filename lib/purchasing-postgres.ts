import { queryPostgres, transactionPostgres, type PostgresExecutor } from "@/lib/postgres/client";
import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoice,
  SupplierLedger,
  SupplierPaymentMethod,
  SupplierTransaction,
  SupplierTransactionType,
  PurchasingData,
} from "@/lib/purchasing";

type SupplierLedgerRow = {
  id: string;
  supplier_name: string;
  phone: string;
  material_focus: string;
  total_purchase: number | string;
  paid_amount: number | string;
  balance_due: number | string;
  last_transaction: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

type PurchaseInvoiceRow = {
  id: string;
  purchase_number: string;
  created_at: Date | string;
  supplier_ledger_id: string;
  supplier_name: string;
  material_id: string;
  material_name: string;
  unit: PurchaseInvoice["unit"];
  quantity: number | string;
  rate: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
  paid_amount: number | string;
  credit_amount: number | string;
  payment_method: SupplierPaymentMethod;
  payment_reference: string;
  status: PurchaseInvoice["status"];
  posting_status: PurchaseInvoice["postingStatus"];
  supplier_transaction_ids: string[] | null;
  note: string;
};

type SupplierTransactionRow = {
  id: string;
  created_at: Date | string;
  supplier_ledger_id: string;
  supplier_name: string;
  type: SupplierTransactionType;
  amount: number | string;
  note: string;
};

type RawMaterialRow = {
  id: string;
  name: string;
  unit: PurchaseInvoice["unit"];
};

function createId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function cleanText(value: string) {
  return value.trim();
}

function cleanNumber(value: number | string) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isSupplierPaymentType(type: SupplierTransactionType) {
  return type === "Cash Payment" || type === "Cheque Payment" || type === "Bank Payment";
}

function assertSupplierTransactionAllowed(
  ledger: SupplierLedger,
  transaction: Pick<SupplierTransaction, "type" | "amount">,
) {
  if (transaction.amount <= 0) {
    throw new Error("Supplier transaction amount must be greater than zero.");
  }

  if ((isSupplierPaymentType(transaction.type) || transaction.type === "Return Adjustment") && transaction.amount > ledger.balanceDue) {
    throw new Error(
      `${ledger.supplierName} has only Rs. ${ledger.balanceDue} supplier due. Cannot post Rs. ${transaction.amount}.`,
    );
  }
}

function supplierLedgerFromRow(row: SupplierLedgerRow): SupplierLedger {
  return {
    id: row.id,
    supplierName: row.supplier_name,
    phone: row.phone,
    materialFocus: row.material_focus,
    totalPurchase: cleanNumber(row.total_purchase),
    paidAmount: cleanNumber(row.paid_amount),
    balanceDue: cleanNumber(row.balance_due),
    lastTransaction: dateOnly(row.last_transaction),
  };
}

function purchaseInvoiceFromRow(row: PurchaseInvoiceRow): PurchaseInvoice {
  return {
    id: row.id,
    purchaseNumber: row.purchase_number,
    createdAt: isoDate(row.created_at),
    supplierLedgerId: row.supplier_ledger_id,
    supplierName: row.supplier_name,
    materialId: row.material_id,
    materialName: row.material_name,
    unit: row.unit,
    quantity: cleanNumber(row.quantity),
    rate: cleanNumber(row.rate),
    discount: cleanNumber(row.discount),
    tax: cleanNumber(row.tax),
    total: cleanNumber(row.total),
    paidAmount: cleanNumber(row.paid_amount),
    creditAmount: cleanNumber(row.credit_amount),
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    status: row.status,
    postingStatus: row.posting_status,
    supplierTransactionIds: Array.isArray(row.supplier_transaction_ids)
      ? row.supplier_transaction_ids
      : [],
    note: row.note,
  };
}

function supplierTransactionFromRow(row: SupplierTransactionRow): SupplierTransaction {
  return {
    id: row.id,
    createdAt: isoDate(row.created_at),
    supplierLedgerId: row.supplier_ledger_id,
    supplierName: row.supplier_name,
    type: row.type,
    amount: cleanNumber(row.amount),
    note: row.note,
  };
}

export async function getPurchasingDataFromPostgres(): Promise<PurchasingData> {
  const [supplierLedgers, purchaseInvoices, supplierTransactions] = await Promise.all([
    queryPostgres<SupplierLedgerRow>(
      "purchasing",
      `
        SELECT id, supplier_name, phone, material_focus, total_purchase, paid_amount,
          balance_due, last_transaction, created_at, updated_at
        FROM supplier_ledgers
        ORDER BY updated_at DESC
      `,
    ),
    queryPostgres<PurchaseInvoiceRow>(
      "purchasing",
      `
        SELECT id, purchase_number, created_at, supplier_ledger_id, supplier_name,
          material_id, material_name, unit, quantity, rate, discount, tax, total,
          paid_amount, credit_amount, payment_method, payment_reference, status,
          posting_status, supplier_transaction_ids, note
        FROM purchase_invoices
        ORDER BY created_at DESC
      `,
    ),
    queryPostgres<SupplierTransactionRow>(
      "purchasing",
      `
        SELECT id, created_at, supplier_ledger_id, supplier_name, type, amount, note
        FROM supplier_transactions
        ORDER BY created_at DESC
      `,
    ),
  ]);

  return {
    supplierLedgers: supplierLedgers.map(supplierLedgerFromRow),
    purchaseInvoices: purchaseInvoices.map(purchaseInvoiceFromRow),
    supplierTransactions: supplierTransactions.map(supplierTransactionFromRow),
  };
}

async function updateSupplierLedgerTotals(db: PostgresExecutor, ledger: SupplierLedger) {
  await db.query<SupplierLedgerRow>(
    `
      UPDATE supplier_ledgers
      SET total_purchase = $2,
        paid_amount = $3,
        balance_due = $4,
        last_transaction = $5,
        updated_at = now()
      WHERE id = $1
      RETURNING id
    `,
    [
      ledger.id,
      ledger.totalPurchase,
      ledger.paidAmount,
      ledger.balanceDue,
      ledger.lastTransaction,
    ],
  );
}

function applySupplierTransaction(
  ledger: SupplierLedger,
  transaction: Pick<SupplierTransaction, "type" | "amount">,
) {
  assertSupplierTransactionAllowed(ledger, transaction);

  const nextLedger = { ...ledger };

  if (transaction.type === "Purchase Bill") {
    nextLedger.totalPurchase += transaction.amount;
    nextLedger.balanceDue += transaction.amount;
  }

  if (isSupplierPaymentType(transaction.type)) {
    nextLedger.paidAmount += transaction.amount;
    nextLedger.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Return Adjustment") {
    nextLedger.totalPurchase -= transaction.amount;
    nextLedger.balanceDue -= transaction.amount;
  }

  if (transaction.type === "Manual Adjustment") {
    nextLedger.balanceDue += transaction.amount;
  }

  nextLedger.lastTransaction = today();
  return nextLedger;
}

async function insertSupplierTransaction(
  db: PostgresExecutor,
  ledger: SupplierLedger,
  type: SupplierTransactionType,
  amount: number,
  note: string,
) {
  const record: SupplierTransaction = {
    id: createId("SUPTXN"),
    createdAt: new Date().toISOString(),
    supplierLedgerId: ledger.id,
    supplierName: ledger.supplierName,
    type,
    amount: cleanNumber(amount),
    note: cleanText(note),
  };

  await updateSupplierLedgerTotals(db, applySupplierTransaction(ledger, record));

  const rows = await db.query<SupplierTransactionRow>(
    `
      INSERT INTO supplier_transactions (
        id, created_at, supplier_ledger_id, supplier_name, type, amount, note
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at, supplier_ledger_id, supplier_name, type, amount, note
    `,
    [
      record.id,
      new Date(record.createdAt),
      record.supplierLedgerId,
      record.supplierName,
      record.type,
      record.amount,
      record.note,
    ],
  );

  return supplierTransactionFromRow(rows[0]);
}

export async function addSupplierLedgerToPostgres(
  ledger: Omit<SupplierLedger, "id" | "totalPurchase" | "paidAmount" | "balanceDue" | "lastTransaction">,
) {
  const rows = await queryPostgres<SupplierLedgerRow>(
    "purchasing",
    `
      INSERT INTO supplier_ledgers (
        id, supplier_name, phone, material_focus, total_purchase, paid_amount,
        balance_due, last_transaction, updated_at
      )
      VALUES ($1, $2, $3, $4, 0, 0, 0, $5, now())
      RETURNING id, supplier_name, phone, material_focus, total_purchase, paid_amount,
        balance_due, last_transaction, created_at, updated_at
    `,
    [
      createId("SUP"),
      cleanText(ledger.supplierName),
      cleanText(ledger.phone),
      cleanText(ledger.materialFocus),
      today(),
    ],
  );

  return supplierLedgerFromRow(rows[0]);
}

export async function addSupplierTransactionToPostgres(
  transaction: Omit<SupplierTransaction, "id" | "createdAt" | "supplierName">,
) {
  return transactionPostgres("purchasing", async (db) => {
    const ledgerRows = await db.query<SupplierLedgerRow>(
      `
        SELECT id, supplier_name, phone, material_focus, total_purchase, paid_amount,
          balance_due, last_transaction, created_at, updated_at
        FROM supplier_ledgers
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [transaction.supplierLedgerId],
    );

    if (!ledgerRows[0]) {
      throw new Error("Supplier ledger was not found.");
    }

    return insertSupplierTransaction(
      db,
      supplierLedgerFromRow(ledgerRows[0]),
      transaction.type,
      transaction.amount,
      transaction.note,
    );
  });
}

function paymentTransactionType(paymentMethod: SupplierPaymentMethod): SupplierTransactionType {
  if (paymentMethod === "Cheque") return "Cheque Payment";
  if (paymentMethod === "Bank") return "Bank Payment";
  return "Cash Payment";
}

function purchaseStatus(total: number, paidAmount: number): PurchaseInvoice["status"] {
  const creditAmount = Math.max(0, total - paidAmount);

  if (creditAmount > 0 && paidAmount > 0) return "Partial";
  if (creditAmount > 0) return "Credit";
  return "Paid";
}

export async function createPurchaseInvoiceInPostgres(input: CreatePurchaseInvoiceInput) {
  return transactionPostgres("purchasing", async (db) => {
    const supplierLedgerId = cleanText(input.supplierLedgerId);
    const supplierName = cleanText(input.supplierName);
    const paymentReference = cleanText(input.paymentReference);
    const quantity = cleanNumber(input.quantity);
    const rate = cleanNumber(input.rate);
    const paidInputAmount = cleanNumber(input.paidAmount);

    if (!input.materialId || quantity <= 0 || rate <= 0) {
      throw new Error("Raw material, quantity, and rate are required.");
    }

    if (!supplierLedgerId && !supplierName) {
      throw new Error("Choose an existing supplier or enter a new supplier name.");
    }

    if (input.paymentMethod === "Credit" && paidInputAmount > 0) {
      throw new Error("Credit purchase cannot have paid amount. Use Cash, Cheque, or Bank for payments.");
    }

    if (
      (input.paymentMethod === "Cheque" || input.paymentMethod === "Bank") &&
      paidInputAmount > 0 &&
      !paymentReference
    ) {
      throw new Error("Cheque or bank payment reference is required when paid amount is entered.");
    }

    const materialRows = await db.query<RawMaterialRow>(
      `
        SELECT id, name, unit
        FROM raw_materials
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.materialId],
    );

    if (!materialRows[0]) {
      throw new Error("Raw material was not found.");
    }

    let ledger: SupplierLedger | null = null;

    if (supplierLedgerId) {
      const ledgerRows = await db.query<SupplierLedgerRow>(
        `
          SELECT id, supplier_name, phone, material_focus, total_purchase, paid_amount,
            balance_due, last_transaction, created_at, updated_at
          FROM supplier_ledgers
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [supplierLedgerId],
      );

      if (!ledgerRows[0]) {
        throw new Error("Supplier ledger was not found.");
      }

      ledger = supplierLedgerFromRow(ledgerRows[0]);
    } else {
      const createdLedgers = await db.query<SupplierLedgerRow>(
        `
          INSERT INTO supplier_ledgers (
            id, supplier_name, phone, material_focus, total_purchase, paid_amount,
            balance_due, last_transaction, updated_at
          )
          VALUES ($1, $2, $3, $4, 0, 0, 0, $5, now())
          RETURNING id, supplier_name, phone, material_focus, total_purchase, paid_amount,
            balance_due, last_transaction, created_at, updated_at
        `,
        [
          createId("SUP"),
          supplierName,
          cleanText(input.phone),
          materialRows[0].name,
          today(),
        ],
      );
      ledger = supplierLedgerFromRow(createdLedgers[0]);
    }

    const discount = Math.min(cleanNumber(input.discount), quantity * rate);
    const tax = cleanNumber(input.tax);
    const total = Math.max(0, quantity * rate - discount + tax);
    const paidAmount = Math.min(paidInputAmount, total);
    const creditAmount = Math.max(0, total - paidAmount);
    const purchaseNumber = input.purchaseNumber || `KR-PUR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
    const transactionIds: string[] = [];

    const billTransaction = await insertSupplierTransaction(
      db,
      ledger,
      "Purchase Bill",
      total,
      `${purchaseNumber} raw material purchase.`,
    );
    transactionIds.push(billTransaction.id);
    ledger = applySupplierTransaction(ledger, billTransaction);

    if (paidAmount > 0 && input.paymentMethod !== "Credit") {
      const paymentTransaction = await insertSupplierTransaction(
        db,
        ledger,
        paymentTransactionType(input.paymentMethod),
        paidAmount,
        `${purchaseNumber} payment ${paymentReference}`.trim(),
      );
      transactionIds.push(paymentTransaction.id);
    }

    await db.query<RawMaterialRow>(
      `
        UPDATE raw_materials
        SET received = received + $2
        WHERE id = $1
        RETURNING id
      `,
      [materialRows[0].id, quantity],
    );

    const rows = await db.query<PurchaseInvoiceRow>(
      `
        INSERT INTO purchase_invoices (
          id, purchase_number, created_at, supplier_ledger_id, supplier_name,
          material_id, material_name, unit, quantity, rate, discount, tax,
          total, paid_amount, credit_amount, payment_method, payment_reference,
          status, posting_status, supplier_transaction_ids, note
        )
        VALUES (
          $1, $2, now(), $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, 'Posted', $18, $19
        )
        RETURNING id, purchase_number, created_at, supplier_ledger_id, supplier_name,
          material_id, material_name, unit, quantity, rate, discount, tax, total,
          paid_amount, credit_amount, payment_method, payment_reference, status,
          posting_status, supplier_transaction_ids, note
      `,
      [
        createId("PUR"),
        purchaseNumber,
        ledger.id,
        ledger.supplierName,
        materialRows[0].id,
        materialRows[0].name,
        materialRows[0].unit,
        quantity,
        rate,
        discount,
        tax,
        total,
        paidAmount,
        creditAmount,
        input.paymentMethod,
        paymentReference,
        purchaseStatus(total, paidAmount),
        transactionIds,
        cleanText(input.note),
      ],
    );

    return purchaseInvoiceFromRow(rows[0]);
  });
}
