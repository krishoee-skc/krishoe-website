-- Every cheque the shop takes or gives, with its whole story (owner,
-- 2026-10-01): whose it is, which bank, the number, the amount, the date it
-- may be deposited, and what the bank did with it and when.
--
--   direction   'in'   taken from a customer on a counter bill
--               'out'  given to a supplier on a purchase bill
--   source      'bill' | 'purchase' | 'manual', with the bill's or purchase's
--               id in source_id (a manual cheque carries its own id there)
--   state       'waiting'    in hand (in) or handed over (out), not yet cashed
--               'deposited'  put in the bank, the bank still to pay (in only)
--               'cleared'    the bank paid it (in) or the supplier cashed it (out)
--               'bounced'    the bank returned it; the money is still owed
--               'recovered'  after a bounce, the money came in another way
--               'cancelled'  torn, replaced or handed back
--
-- pos_cheques stays as it is and is kept in step for bills, so nothing that
-- reads it changes. Additive: a new table, nothing existing is changed.
-- Reversible (DROP TABLE cheques).

CREATE TABLE IF NOT EXISTS cheques (
  id text PRIMARY KEY,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  source text NOT NULL CHECK (source IN ('bill', 'purchase', 'manual')),
  source_id text NOT NULL,
  source_number text NOT NULL DEFAULT '',
  party_name text NOT NULL DEFAULT '',
  party_phone text NOT NULL DEFAULT '',
  bank text NOT NULL DEFAULT '',
  cheque_no text NOT NULL DEFAULT '',
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  cheque_date date,
  name_on_cheque text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'waiting'
    CHECK (state IN ('waiting', 'deposited', 'cleared', 'bounced', 'recovered', 'cancelled')),
  deposited_on date,
  cleared_on date,
  bounced_on date,
  bounce_reason text NOT NULL DEFAULT '',
  bank_charge numeric(12, 2) NOT NULL DEFAULT 0 CHECK (bank_charge >= 0),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS cheques_one_per_source ON cheques (source, source_id);
CREATE INDEX IF NOT EXISTS cheques_open_by_date ON cheques (cheque_date)
  WHERE state IN ('waiting', 'deposited', 'bounced');
