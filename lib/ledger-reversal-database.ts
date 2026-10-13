import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Room on a customer's ledger line to be taken back, from one Owner button
 * (owner, 2026-10-13: proof of money is never removed). The button runs the SQL
 * of scripts/migrations/20261013_ledger_transactions_reversed.sql word for
 * word. Until it is pressed the account reads as before and taking a line back
 * says to press it first; nothing is deleted either way.
 */
export const ledgerReversalMigration = {
  name: "20261013_ledger_transactions_reversed.sql",
  label: {
    en: "Let a line on a customer's account be taken back and kept, instead of deleted (2 columns added)",
    ne: "ग्राहकको खाताको लाइन मेट्नुको सट्टा फिर्ता गरेर राख्न दिने (२ column थपिन्छन्)",
  },
  sql: `-- A customer's ledger line can be taken back, and stays (owner, 2026-10-13).
--
-- A line on a customer's account — cash taken, a cheque, a credit sale — was
-- deleted outright from the account screen, and with it the only record that
-- the money ever moved. The owner chose that proof of money is never removed:
-- a line is now marked reversed, with the reason, and every sum skips it.
--
-- Two columns, added; nothing removed, no row changed. A line with no
-- reversed_at is exactly what it was.

ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS reversal_reason TEXT NOT NULL DEFAULT '';
`,
} as const;

const STORE = "ledger reversal";

export type LedgerReversalStatus = { ready: boolean; label: { en: string; ne: string } };

/** Whether the live table has the two columns. Ready off Postgres. */
export async function ledgerReversalStatus(): Promise<LedgerReversalStatus> {
  const label = ledgerReversalMigration.label;
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, label };
  const rows = await queryPostgres<{ column_name: string }>(
    STORE,
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'ledger_transactions'
        AND column_name IN ('reversed_at', 'reversal_reason')`,
  );
  return { ready: rows.length === 2, label };
}

/** Adds the two columns, stamped as applied. Safe to press twice. */
export async function prepareLedgerReversal() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: false };
  const { ready } = await ledgerReversalStatus();
  if (ready) return { applied: false };
  await transactionPostgres(STORE, async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(ledgerReversalMigration.sql);
    await db.query(
      "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
      [ledgerReversalMigration.name, migrationChecksum(ledgerReversalMigration.sql)],
    );
  });
  return { applied: true };
}
