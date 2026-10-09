-- Goods sold at the counter before their stock was put in.
--
-- The counter used to ask for every pair on the shelf before a new shoe could
-- be sold (owner, 2026-10-09: "we know the pairs when we enter the purchase
-- bill — at the counter, write how many are sold and cut the bill"). Now a new
-- shoe is added with only the pairs being sold; this table remembers that its
-- stock is still to be filled, and how it was filled — from the supplier's
-- purchase bill, or by counting the shelf.
--
--   counter_item_id  the counter_items row the shoe was added as
--   sold_pairs       pairs sold when it was added (its stock-in so far)
--   sold_sizes       the same, by size
--   filled_at        when the stock was filled; NULL until then
--   filled_how       'bill' (purchase bill) or 'count' (counted on the shelf)
--   filled_pairs     pairs the fill added
--
-- Additive: a new table, nothing existing is changed. Reversible (DROP TABLE).

CREATE TABLE IF NOT EXISTS counter_sold_first (
  counter_item_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  sold_pairs integer NOT NULL DEFAULT 0 CHECK (sold_pairs >= 0),
  sold_sizes jsonb NOT NULL DEFAULT '{}'::jsonb,
  filled_at timestamptz DEFAULT NULL,
  filled_how text NOT NULL DEFAULT '' CHECK (filled_how IN ('', 'bill', 'count')),
  filled_pairs integer NOT NULL DEFAULT 0 CHECK (filled_pairs >= 0),
  filled_by text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS counter_sold_first_open_idx ON counter_sold_first (created_at) WHERE filled_at IS NULL;
