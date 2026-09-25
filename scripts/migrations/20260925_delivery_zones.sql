-- Delivery charged by area, set by the owner in Settings.
--
-- One flat courier fee overcharged the customer next door and undercharged the
-- one across the country. The owner names up to eight areas, each with its own
-- fee (0 = free to that area), and the customer picks theirs at checkout:
--
--   delivery_zones  [{ "id": "z1", "name": "Inside Chitwan", "feePaisa": 0 }, …]
--
-- An empty list — the default — keeps the flat fee from
-- 20260923_delivery_charge.sql exactly as it is. Additive, defaulted,
-- reversible (DROP COLUMN delivery_zones).

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS delivery_zones jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(delivery_zones) = 'array');
