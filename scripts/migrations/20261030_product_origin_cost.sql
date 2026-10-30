-- What a bought shoe cost a pair (owner, 2026-10-30), for one already on the
-- shelf with no purchase bill. 0 means not said. Additive: one column with a
-- default, nothing existing is changed. Reversible
-- (ALTER TABLE product_origins DROP COLUMN cost_per_pair).

ALTER TABLE product_origins
  ADD COLUMN IF NOT EXISTS cost_per_pair numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_per_pair >= 0);
