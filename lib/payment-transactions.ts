import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "node:path";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";
import {
  paymentProviders,
  paymentStatuses,
  type PaymentProvider,
  type PaymentStatus,
} from "@/lib/submissions";

export type PaymentTransactionSource = "admin" | "gateway" | "system";

export type PaymentTransaction = {
  id: string;
  createdAt: string;
  orderId: string;
  customerName: string;
  amount: number;
  paymentStatus: PaymentStatus;
  paymentProvider: PaymentProvider;
  paymentReference?: string;
  paymentTransactionId?: string;
  paymentCallbackId?: string;
  ledgerId?: string;
  ledgerTransactionId?: string;
  source: PaymentTransactionSource;
  note: string;
};

export const paymentTransactionSources = ["admin", "gateway", "system"] as const;

const dataDirectory = path.join(process.cwd(), "data");
const paymentTransactionsPath = path.join(dataDirectory, "payment-transactions.json");

type PaymentTransactionRow = {
  id: string;
  created_at: Date | string;
  order_id: string;
  customer_name: string;
  amount: number | string;
  payment_status: string;
  payment_provider: string;
  payment_reference: string;
  payment_transaction_id: string;
  payment_callback_id: string | null;
  ledger_id: string | null;
  ledger_transaction_id: string | null;
  source: string;
  note: string;
};

function createId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function cleanNumber(value: number) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function cleanText(value: string) {
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  return paymentStatuses.includes(value as PaymentStatus) ? (value as PaymentStatus) : "Pending";
}

function normalizePaymentProvider(value: unknown): PaymentProvider {
  return paymentProviders.includes(value as PaymentProvider) ? (value as PaymentProvider) : "manual";
}

function normalizeSource(value: unknown): PaymentTransactionSource {
  return paymentTransactionSources.includes(value as PaymentTransactionSource)
    ? (value as PaymentTransactionSource)
    : "system";
}

function normalizePaymentTransaction(transaction: PaymentTransaction): PaymentTransaction {
  return {
    ...transaction,
    amount: cleanNumber(transaction.amount),
    paymentStatus: normalizePaymentStatus(transaction.paymentStatus),
    paymentProvider: normalizePaymentProvider(transaction.paymentProvider),
    paymentReference: optionalText(transaction.paymentReference),
    paymentTransactionId: optionalText(transaction.paymentTransactionId),
    paymentCallbackId: optionalText(transaction.paymentCallbackId),
    ledgerId: optionalText(transaction.ledgerId),
    ledgerTransactionId: optionalText(transaction.ledgerTransactionId),
    source: normalizeSource(transaction.source),
    note: cleanText(transaction.note),
  };
}

function paymentTransactionFromRow(row: PaymentTransactionRow): PaymentTransaction {
  return {
    id: row.id,
    createdAt: isoDate(row.created_at),
    orderId: row.order_id,
    customerName: row.customer_name,
    amount: cleanNumber(Number(row.amount)),
    paymentStatus: normalizePaymentStatus(row.payment_status),
    paymentProvider: normalizePaymentProvider(row.payment_provider),
    paymentReference: optionalText(row.payment_reference),
    paymentTransactionId: optionalText(row.payment_transaction_id),
    paymentCallbackId: optionalText(row.payment_callback_id),
    ledgerId: optionalText(row.ledger_id),
    ledgerTransactionId: optionalText(row.ledger_transaction_id),
    source: normalizeSource(row.source),
    note: row.note,
  };
}

async function getPaymentTransactionsFromLocalJson() {
  const transactions = await readJsonFile<PaymentTransaction[]>(paymentTransactionsPath, []);
  return transactions.map(normalizePaymentTransaction);
}

async function getPaymentTransactionsFromPostgres() {
  const rows = await queryPostgres<PaymentTransactionRow>(
    "payment transactions",
    `
      SELECT
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
      FROM payment_transactions
      ORDER BY created_at DESC
    `,
  );

  return rows.map(paymentTransactionFromRow);
}

export async function getPaymentTransactions() {
  return runWithDataBackend({
    storeName: "payment transactions",
    localJson: getPaymentTransactionsFromLocalJson,
    postgres: getPaymentTransactionsFromPostgres,
  });
}

export async function getPaymentTransactionsByOrderIds(orderIds: string[]) {
  const ids = orderIds.filter(Boolean);

  if (ids.length === 0) {
    return [];
  }

  return runWithDataBackend({
    storeName: "payment transactions",
    localJson: async () => {
      const transactions = await getPaymentTransactionsFromLocalJson();
      return transactions.filter((transaction) => ids.includes(transaction.orderId));
    },
    postgres: async () => {
      const rows = await queryPostgres<PaymentTransactionRow>(
        "payment transactions",
        `
          SELECT
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
          FROM payment_transactions
          WHERE order_id = ANY($1)
          ORDER BY created_at DESC
        `,
        [ids],
      );

      return rows.map(paymentTransactionFromRow);
    },
  });
}

export async function getPaymentTransactionsByLedgerId(ledgerId: string) {
  return runWithDataBackend({
    storeName: "payment transactions",
    localJson: async () => {
      const transactions = await getPaymentTransactionsFromLocalJson();
      return transactions.filter((transaction) => transaction.ledgerId === ledgerId);
    },
    postgres: async () => {
      const rows = await queryPostgres<PaymentTransactionRow>(
        "payment transactions",
        `
          SELECT
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
          FROM payment_transactions
          WHERE ledger_id = $1
          ORDER BY created_at DESC
        `,
        [ledgerId],
      );

      return rows.map(paymentTransactionFromRow);
    },
  });
}

export async function getPaymentTransactionByCallbackId(callbackId: string) {
  const normalizedCallbackId = optionalText(callbackId);

  if (!normalizedCallbackId) {
    return null;
  }

  return runWithDataBackend({
    storeName: "payment transactions",
    localJson: async () => {
      const transactions = await getPaymentTransactionsFromLocalJson();
      return (
        transactions.find(
          (transaction) => transaction.paymentCallbackId === normalizedCallbackId,
        ) ?? null
      );
    },
    postgres: async () => {
      const rows = await queryPostgres<PaymentTransactionRow>(
        "payment transactions",
        `
          SELECT
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
          FROM payment_transactions
          WHERE payment_callback_id = $1
          LIMIT 1
        `,
        [normalizedCallbackId],
      );

      return rows[0] ? paymentTransactionFromRow(rows[0]) : null;
    },
  });
}

export async function recordPaymentTransaction(
  transaction: Omit<PaymentTransaction, "id" | "createdAt">,
) {
  const record: PaymentTransaction = normalizePaymentTransaction({
    ...transaction,
    id: createId("PAY"),
    createdAt: new Date().toISOString(),
  });

  return runWithDataBackend({
    storeName: "payment transactions",
    localJson: async () => {
      const transactions = await getPaymentTransactionsFromLocalJson();
      await writeJsonFile(paymentTransactionsPath, [record, ...transactions]);
      return record;
    },
    postgres: async () => {
      const rows = await queryPostgres<PaymentTransactionRow>(
        "payment transactions",
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
          ON CONFLICT (payment_callback_id)
            WHERE payment_callback_id IS NOT NULL AND payment_callback_id <> ''
            DO NOTHING
          RETURNING
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
        `,
        [
          record.id,
          new Date(record.createdAt),
          record.orderId,
          record.customerName,
          record.amount,
          record.paymentStatus,
          record.paymentProvider,
          record.paymentReference ?? "",
          record.paymentTransactionId ?? "",
          record.paymentCallbackId ?? null,
          record.ledgerId ?? null,
          record.ledgerTransactionId ?? null,
          record.source,
          record.note,
        ],
      );

      if (rows[0]) {
        return paymentTransactionFromRow(rows[0]);
      }

      // ON CONFLICT DO NOTHING returned no row: this callback id was already
      // recorded by a concurrent/retried call. Return that existing
      // transaction so payment recording stays idempotent.
      if (record.paymentCallbackId) {
        const existing = await getPaymentTransactionByCallbackId(record.paymentCallbackId);
        if (existing) {
          return existing;
        }
      }

      throw new Error("Payment transaction could not be recorded.");
    },
  });
}
