-- A customer's ledger line can be taken back, and stays (owner, 2026-10-13).
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
