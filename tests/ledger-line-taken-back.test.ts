import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The owner's choice, 2026-10-13 (sample 7ख, क and ख): proof of money is never
 * removed. A line on a customer's account is taken back and kept, crossed out
 * with its reason; and the money on the account moves only by such a line —
 * no box sets "Balance due" by hand.
 */
describe("room to keep a line taken back", () => {
  it("is two columns added, nothing removed, from one Settings button", async () => {
    const sql = await read("scripts/migrations/20261013_ledger_transactions_reversed.sql");
    expect(sql).toContain("ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;");
    expect(sql).toContain("ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS reversal_reason TEXT NOT NULL DEFAULT '';");
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b|\bUPDATE\b/);
    const lib = await read("lib/ledger-reversal-database.ts");
    // The button runs the migration word for word.
    expect(lib).toContain(sql.trim().split("\n")[0]);
    expect(lib).toContain("ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS reversal_reason TEXT NOT NULL DEFAULT '';");
    const schema = await read("docs/schema.sql");
    expect(schema).toContain("  reversed_at TIMESTAMPTZ,\n  reversal_reason TEXT NOT NULL DEFAULT ''\n);");
    const settings = await read("app/admin/settings/page.tsx");
    expect(settings).toContain('<section id="ledger-reversal"');
    expect(settings).toContain("<form action={prepareLedgerReversalAction}");
  });

  it("reads the same before the button is pressed", async () => {
    const postgres = await read("lib/operations-postgres.ts");
    // Through to_jsonb, so an absent column reads as nothing rather than failing.
    expect(postgres).toContain("(to_jsonb(ledger_transactions) ->> 'reversed_at') AS reversed_at");
  });
});

describe("taking a line back", () => {
  it("keeps the line, moves the account back, and deletes nothing", async () => {
    const postgres = await read("lib/operations-postgres.ts");
    const start = postgres.indexOf("export async function reverseLedgerTransactionInPostgres");
    const body = postgres.slice(start, postgres.indexOf("async function deleteMaterialConsumption", start));
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("FOR UPDATE");
    expect(body).toContain("reverseLedgerTransaction(customerLedgerFromRow(ledgerRows[0]), transaction)");
    expect(body).toContain("UPDATE ledger_transactions SET reversed_at = now(), reversal_reason = $2 WHERE id = $1 AND reversed_at IS NULL");
    expect(body).toContain("has already been taken back");
    expect(body).not.toContain("DELETE FROM");
  });

  it("asks why, on both backends", async () => {
    const operations = await read("lib/operations.ts");
    expect(operations).toContain('if (why.length < 5) throw new Error("Write a clear reason for taking this line back.");');
    expect(operations).toContain("postgres: () => reverseLedgerTransactionInPostgres(id, why, reversedBy),");
  });

  it("is counted by no sum, and a bill whose credit was taken back says so", async () => {
    const operations = await read("lib/operations.ts");
    expect(operations).toContain("    if (transaction.reversedAt) continue;\n    ledgerTransactionTotals[transaction.type] += transaction.amount;");
    expect(operations).toContain("transactionCount: transactions.filter((transaction) => !transaction.reversedAt).length,");
    const pos = await read("lib/pos.ts");
    expect(pos).toContain("    !transaction.reversedAt &&\n    transaction.ledgerId === invoice.ledgerId &&");
    expect(pos).toContain("(transaction) => transaction.id === invoice.ledgerTransactionId && !transaction.reversedAt,");
  });

  it("is the only way off the account: the delete path refuses a ledger line", async () => {
    const actions = await read("app/admin/operations/actions.ts");
    const del = actions.slice(actions.indexOf("export async function deleteOperationRecordAction"));
    expect(del.indexOf('if (kind === "ledgerTransaction") {')).toBeLessThan(del.indexOf("await deleteOperationRecord(kind, id);"));
    const page = await read("app/admin/operations/ledger/[id]/page.tsx");
    expect(page).not.toContain("deleteOperationRecordAction");
    expect(page).toContain("<form action={reverseLedgerTransactionAction}");
    const records = await read("app/admin/operations/_components/OperationsRecords.tsx");
    expect(records).not.toContain('<DeleteRecordForm kind="ledgerTransaction"');
  });
});

describe("the money on an account", () => {
  it("moves only by a line, never by a box", async () => {
    const actions = await read("app/admin/operations/actions.ts");
    const update = actions.slice(
      actions.indexOf("export async function updateCustomerLedgerAction"),
      actions.indexOf("export async function createStockMovementAction"),
    );
    for (const field of ["cashPaid", "chequePaid", "creditGiven", "balanceDue"]) expect(update).not.toContain(`"${field}"`);
    const postgres = await read("lib/operations-postgres.ts");
    expect(postgres).toContain("SET customer_name = $2, channel = $3, phone = $4, credit_limit = $5, last_transaction = $6, updated_at = now()");
    for (const file of ["app/admin/operations/ledger/[id]/page.tsx", "app/admin/operations/_components/OperationsRecords.tsx"]) {
      const source = await read(file);
      expect(source, file).not.toContain('name="balanceDue" type="number" min="0" className={inputClass} defaultValue={ledger.balanceDue}');
      expect(source, file).not.toContain('name="balanceDue" type="number" min="0" className={compactInputClass} defaultValue={ledger.balanceDue}');
    }
  });
});

describe("the account page, as the sample", () => {
  it("is in both languages, three figures, four tabs, Call and WhatsApp", async () => {
    const page = await read("app/admin/operations/ledger/[id]/page.tsx");
    expect((page.match(/[ऀ-ॿ]+/g) ?? []).length).toBeGreaterThan(100);
    expect(page).toContain('id="customer-ledger"');
    for (const key of ["collect", "history", "orders", "details"]) expect(page).toContain(`key: "${key}"`);
    expect(page).toContain('{ en: "to collect", ne: "उठाउन बाँकी", value: summary.balanceDue, money: true');
    expect(page).toContain("href={`tel:${ledger.phone}`}");
    expect(page).toContain("href={whatsappToUrl(ledger.phone, reminder)}");
  });
});
