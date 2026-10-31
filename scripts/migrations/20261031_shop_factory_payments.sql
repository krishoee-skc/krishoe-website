-- What the shop pays the factory for the shoes it took on challans (owner,
-- 2026-10-31, two businesses, choice 2(a)). Additive: one new table, nothing
-- existing changes. A wrong entry is marked removed with a reason, never
-- deleted. Reversible: DROP TABLE shop_factory_payments.

CREATE TABLE IF NOT EXISTS shop_factory_payments (
  id text PRIMARY KEY,
  paid_on date NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash', 'Bank', 'Cheque')),
  note text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by text NOT NULL DEFAULT '',
  removed_reason text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS shop_factory_payments_paid_on_idx ON shop_factory_payments (paid_on DESC);
