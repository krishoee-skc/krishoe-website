-- Goods first put on the books from the counter bill.
--
-- The shop had pairs on its shelves that were never entered — no purchase
-- bill, sometimes a bill still to come — and the counter could not sell them.
-- Such goods are now added from the bill itself; this table remembers how each
-- arrived, what one pair cost when that is known, who added it, and whether
-- the Owner has looked at it. The pairs themselves are ordinary stock rows and
-- movements; nothing here is counted twice.
--
--   how            'old' (already on the shelf), 'pending_bill' (arrived, bill
--                  to come), 'factory' (made here)
--   supplier_name  who it came from, for a bill still to come
--   cost_per_pair  rupees; 0 when not known ("cost to come")
--   reviewed_at    when the Owner looked at it; NULL until then
--   bill_linked_at when the supplier's bill was matched to it; NULL until then
--
-- Additive: a new table, nothing existing is changed. Reversible (DROP TABLE).

CREATE TABLE IF NOT EXISTS counter_items (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  design text NOT NULL,
  product_id text NOT NULL DEFAULT '',
  how text NOT NULL DEFAULT 'old' CHECK (how IN ('old', 'pending_bill', 'factory')),
  supplier_name text NOT NULL DEFAULT '',
  supplier_bill_no text NOT NULL DEFAULT '',
  pairs integer NOT NULL DEFAULT 0 CHECK (pairs >= 0),
  size_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  retail_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (retail_price >= 0),
  cost_per_pair numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_per_pair >= 0),
  created_by text NOT NULL DEFAULT '',
  reviewed_at timestamptz DEFAULT NULL,
  reviewed_by text NOT NULL DEFAULT '',
  bill_linked_at timestamptz DEFAULT NULL,
  purchase_invoice_id text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS counter_items_design_idx ON counter_items (lower(design));
CREATE INDEX IF NOT EXISTS counter_items_open_idx ON counter_items (created_at) WHERE reviewed_at IS NULL;
