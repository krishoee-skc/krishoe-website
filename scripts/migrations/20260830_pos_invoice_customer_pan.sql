-- The customer's address and PAN on a POS bill.
--
-- A Nepal sales invoice names the buyer's address and, for a wholesale buyer
-- who claims it, their PAN. The bill layout already prints these lines; these
-- columns let the bill form capture them instead of leaving a write-on space.
--
-- Additive and defaulted, so every existing invoice keeps working and the older
-- ones simply read back empty.

ALTER TABLE pos_invoices ADD COLUMN IF NOT EXISTS customer_address TEXT NOT NULL DEFAULT '';
ALTER TABLE pos_invoices ADD COLUMN IF NOT EXISTS customer_pan TEXT NOT NULL DEFAULT '';
