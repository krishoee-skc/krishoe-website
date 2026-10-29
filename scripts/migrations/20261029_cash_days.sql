-- The cash drawer's two numbers a day (owner, 2026-10-29): the cash in it in
-- the morning, and what was counted at the close. The Transactions page adds
-- the day's cash in and takes away the cash out to say what should be there.
-- One row a Nepal day; either number may be blank until it is written.
-- Additive: a new table, nothing existing is changed. Reversible (DROP TABLE cash_days).

CREATE TABLE IF NOT EXISTS cash_days (
  day date PRIMARY KEY,
  opening numeric(12, 2) CHECK (opening IS NULL OR opening >= 0),
  counted numeric(12, 2) CHECK (counted IS NULL OR counted >= 0),
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);
