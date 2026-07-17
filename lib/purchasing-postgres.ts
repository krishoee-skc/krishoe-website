import { queryPostgres, transactionPostgres, type PostgresExecutor } from "@/lib/postgres/client";
import { insertStockMovement } from "@/lib/operations-postgres";
import type { BusinessChannel } from "@/lib/operations";
import { billKindFromLines, billTotals, shareBillAcrossLines } from "@/lib/purchase-bill";
import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoice,
  PurchaseInvoiceItem,
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
  kind: PurchaseInvoice["kind"] | null;
  material_id: string | null;
  material_name: string;
  design: string | null;
  channel: PurchaseInvoice["channel"] | null;
  size_run: string | null;
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

type PurchaseInvoiceItemRow = {
  id: string;
  purchase_invoice_id: string;
  line_no: number | string;
  kind: PurchaseInvoiceItem["kind"];
  material_id: string | null;
  item_name: string;
  design: string | null;
  channel: PurchaseInvoiceItem["channel"] | null;
  size_run: string | null;
  unit: PurchaseInvoiceItem["unit"];
  quantity: number | string;
  rate: number | string;
  line_subtotal: number | string;
  line_total: number | string;
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

function purchaseInvoiceItemFromRow(row: PurchaseInvoiceItemRow): PurchaseInvoiceItem {
  return {
    id: row.id,
    lineNo: cleanNumber(row.line_no),
    kind: row.kind === "Trading Goods" ? "Trading Goods" : "Raw Material",
    materialId: row.material_id ?? "",
    itemName: row.item_name,
    design: row.design ?? "",
    channel: row.channel ?? "",
    sizeRun: row.size_run ?? "Mixed",
    unit: row.unit,
    quantity: cleanNumber(row.quantity),
    rate: cleanNumber(row.rate),
    lineSubtotal: cleanNumber(row.line_subtotal),
    lineTotal: cleanNumber(row.line_total),
    note: row.note,
  };
}

// A bill written before purchase_invoice_items existed has no rows there, so it
// reads back as the single line its summary columns describe. Callers can then
// treat every bill the same.
function purchaseItemsFromRows(row: PurchaseInvoiceRow, itemRows: PurchaseInvoiceItemRow[]) {
  if (itemRows.length > 0) {
    return itemRows
      .slice()
      .sort((a, b) => cleanNumber(a.line_no) - cleanNumber(b.line_no))
      .map(purchaseInvoiceItemFromRow);
  }

  const quantity = cleanNumber(row.quantity);

  if (quantity <= 0) {
    return [];
  }

  const rate = cleanNumber(row.rate);

  return [
    purchaseInvoiceItemFromRow({
      id: `${row.id}-L1`,
      purchase_invoice_id: row.id,
      line_no: 1,
      kind: row.kind === "Trading Goods" ? "Trading Goods" : "Raw Material",
      material_id: row.material_id,
      item_name: row.material_name,
      design: row.design,
      channel: row.channel,
      size_run: row.size_run,
      unit: row.unit,
      quantity,
      rate,
      line_subtotal: quantity * rate,
      // The bill was this one line, so it carried the whole total.
      line_total: cleanNumber(row.total),
      note: "",
    }),
  ];
}

function purchaseInvoiceFromRow(
  row: PurchaseInvoiceRow,
  itemRows: PurchaseInvoiceItemRow[] = [],
): PurchaseInvoice {
  const items = purchaseItemsFromRows(row, itemRows);

  return {
    id: row.id,
    purchaseNumber: row.purchase_number,
    createdAt: isoDate(row.created_at),
    supplierLedgerId: row.supplier_ledger_id,
    supplierName: row.supplier_name,
    // Read from the lines, so a bill from before they existed still answers.
    kind: items.length > 0 ? billKindFromLines(items) : "Raw Material",
    items,
    materialId: row.material_id ?? "",
    materialName: row.material_name,
    design: row.design ?? "",
    channel: row.channel ?? "",
    sizeRun: row.size_run ?? "Mixed",
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
  const [supplierLedgers, purchaseInvoices, purchaseInvoiceItems, supplierTransactions] = await Promise.all([
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
          kind, material_id, material_name, design, channel, size_run, unit,
          quantity, rate, discount, tax, total,
          paid_amount, credit_amount, payment_method, payment_reference, status,
          posting_status, supplier_transaction_ids, note
        FROM purchase_invoices
        ORDER BY created_at DESC
      `,
    ),
    // Every line in one query, grouped in memory. A query per bill would be one
    // round trip per bill, and a bill list is the busiest page in Purchasing.
    queryPostgres<PurchaseInvoiceItemRow>(
      "purchasing",
      `
        SELECT id, purchase_invoice_id, line_no, kind, material_id, item_name,
          design, channel, size_run, unit, quantity, rate,
          line_subtotal, line_total, note
        FROM purchase_invoice_items
        ORDER BY purchase_invoice_id, line_no
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

  const itemsByInvoice = new Map<string, PurchaseInvoiceItemRow[]>();

  for (const item of purchaseInvoiceItems) {
    const existing = itemsByInvoice.get(item.purchase_invoice_id);

    if (existing) {
      existing.push(item);
    } else {
      itemsByInvoice.set(item.purchase_invoice_id, [item]);
    }
  }

  return {
    supplierLedgers: supplierLedgers.map(supplierLedgerFromRow),
    purchaseInvoices: purchaseInvoices.map((row) =>
      purchaseInvoiceFromRow(row, itemsByInvoice.get(row.id) ?? []),
    ),
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
    const paidInputAmount = cleanNumber(input.paidAmount);
    // Already cleaned and checked line by line by createPurchaseInvoice.
    const lines = input.items;

    if (lines.length === 0) {
      throw new Error("Add at least one item to the purchase.");
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

    // Look every material up in one go, ordered, and lock them. Ordering by id
    // keeps two bills touching the same materials from deadlocking each other,
    // and resolving all of them before anything posts means a bad line fails
    // the whole bill rather than half of it.
    const materialIds = [
      ...new Set(lines.filter((line) => line.kind === "Raw Material").map((line) => line.materialId)),
    ].sort();
    const materialRows = materialIds.length
      ? await db.query<RawMaterialRow>(
          `
            SELECT id, name, unit
            FROM raw_materials
            WHERE id = ANY($1)
            ORDER BY id
            FOR UPDATE
          `,
          [materialIds],
        )
      : [];
    const materialsById = new Map(materialRows.map((row) => [row.id, row]));

    const resolved = lines.map((line, index) => {
      const material = line.kind === "Raw Material" ? materialsById.get(line.materialId) : undefined;

      if (line.kind === "Raw Material" && !material) {
        throw new Error(`Item ${index + 1}: raw material was not found.`);
      }

      return {
        line,
        material,
        // Trading goods are bought and sold by the pair.
        itemName: material ? material.name : cleanText(line.design),
        unit: (material ? material.unit : "pair") as PurchaseInvoice["unit"],
      };
    });

    const shares = shareBillAcrossLines(lines, input);
    const totals = billTotals(lines, input);
    const itemName = resolved[0].itemName;
    const unit = resolved[0].unit;

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
          itemName,
          today(),
        ],
      );
      ledger = supplierLedgerFromRow(createdLedgers[0]);
    }

    const total = totals.total;
    const paidAmount = Math.min(paidInputAmount, total);
    const creditAmount = Math.max(0, total - paidAmount);
    // Needed before the insert: the line ids are built from it.
    const invoiceId = createId("PUR");
    const purchaseNumber = input.purchaseNumber || `KR-PUR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
    const transactionIds: string[] = [];

    // One bill, one ledger entry, whatever the line count.
    const billTransaction = await insertSupplierTransaction(
      db,
      ledger,
      "Purchase Bill",
      total,
      `${purchaseNumber} purchase, ${lines.length} item(s).`,
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

    // Each line posts where its kind belongs. All of it shares this
    // transaction, so the bill, its lines, the material received and the pairs
    // in stock commit together or not at all.
    for (const row of resolved) {
      if (row.material) {
        await db.query<RawMaterialRow>(
          `
            UPDATE raw_materials
            SET received = received + $2
            WHERE id = $1
            RETURNING id
          `,
          [row.material.id, row.line.quantity],
        );
      } else {
        await insertStockMovement(db, {
          design: row.line.design,
          channel: row.line.channel as BusinessChannel,
          sizeRun: row.line.sizeRun,
          type: "Purchase In",
          pairs: row.line.quantity,
          note: `${purchaseNumber} purchased from ${ledger.supplierName}.`,
        });
      }
    }

    const rows = await db.query<PurchaseInvoiceRow>(
      `
        INSERT INTO purchase_invoices (
          id, purchase_number, created_at, supplier_ledger_id, supplier_name,
          kind, material_id, material_name, design, channel, size_run,
          unit, quantity, rate, discount, tax,
          total, paid_amount, credit_amount, payment_method, payment_reference,
          status, posting_status, supplier_transaction_ids, note
        )
        VALUES (
          $1, $2, now(), $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, 'Posted', $22, $23
        )
        RETURNING id, purchase_number, created_at, supplier_ledger_id, supplier_name,
          kind, material_id, material_name, design, channel, size_run, unit,
          quantity, rate, discount, tax, total,
          paid_amount, credit_amount, payment_method, payment_reference, status,
          posting_status, supplier_transaction_ids, note
      `,
      [
        invoiceId,
        purchaseNumber,
        ledger.id,
        ledger.supplierName,
        billKindFromLines(lines),
        // The summary columns describe the first line, for the lists and
        // exports written when a bill could only hold one item. Null rather
        // than "" so the raw material foreign key stays satisfied.
        resolved[0].material ? resolved[0].material.id : null,
        itemName,
        lines[0].kind === "Trading Goods" ? lines[0].design : "",
        lines[0].kind === "Trading Goods" ? lines[0].channel : null,
        lines[0].sizeRun,
        unit,
        lines[0].quantity,
        lines[0].rate,
        totals.discount,
        totals.tax,
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

    const itemRows: PurchaseInvoiceItemRow[] = [];

    for (const [index, row] of resolved.entries()) {
      const inserted = await db.query<PurchaseInvoiceItemRow>(
        `
          INSERT INTO purchase_invoice_items (
            id, purchase_invoice_id, line_no, kind, material_id, item_name,
            design, channel, size_run, unit, quantity, rate,
            line_subtotal, line_total, note
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id, purchase_invoice_id, line_no, kind, material_id, item_name,
            design, channel, size_run, unit, quantity, rate,
            line_subtotal, line_total, note
        `,
        [
          `${invoiceId}-L${index + 1}`,
          invoiceId,
          index + 1,
          row.line.kind,
          row.material ? row.material.id : null,
          row.itemName,
          row.line.design,
          row.line.kind === "Trading Goods" ? row.line.channel : null,
          row.line.sizeRun,
          row.unit,
          row.line.quantity,
          row.line.rate,
          shares[index].lineSubtotal,
          shares[index].lineTotal,
          row.line.note,
        ],
      );
      itemRows.push(inserted[0]);
    }

    return purchaseInvoiceFromRow(rows[0], itemRows);
  });
}
