-- The factory and the shop as two businesses (owner, 2026-10-31). Additive:
-- new columns with defaults, nothing existing is changed; every old bill reads
-- as the shop's, every old challan line as unpriced. Reversible: drop each
-- column below.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS factory_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS factory_pan text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS factory_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_vehicles boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS product_origins (
  product_id text PRIMARY KEY,
  origin text NOT NULL CHECK (origin IN ('made', 'bought')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);
ALTER TABLE product_origins
  ADD COLUMN IF NOT EXISTS factory_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (factory_price >= 0);

ALTER TABLE pos_invoices
  ADD COLUMN IF NOT EXISTS business text NOT NULL DEFAULT 'shop' CHECK (business IN ('shop', 'factory')),
  ADD COLUMN IF NOT EXISTS bill_group text NOT NULL DEFAULT '';

ALTER TABLE stock_transfer_items
  ADD COLUMN IF NOT EXISTS unit_price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0);
