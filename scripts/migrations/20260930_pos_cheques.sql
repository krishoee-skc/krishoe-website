-- Cheques taken on counter bills, until the bank has paid them.
--
-- A bill paid by cheque was marked Paid the moment it was saved, so a cheque
-- that bounced left the books saying the money was in (owner, 2026-09-30).
-- A cheque bill with no row here is waiting to clear. The row says what
-- happened to it:
--
--   state     'cleared'   the bank paid it
--             'bounced'   the bank returned it; the money is still owed
--             'recovered' after a bounce, the money was collected another way
--   noted_by  who said so
--
-- Additive: a new table, nothing existing is changed. Reversible (DROP TABLE).

CREATE TABLE IF NOT EXISTS pos_cheques (
  invoice_id text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('cleared', 'bounced', 'recovered')),
  noted_at timestamptz NOT NULL DEFAULT now(),
  noted_by text NOT NULL DEFAULT ''
);
