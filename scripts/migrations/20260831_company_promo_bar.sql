-- An owner-controlled promo line for the storefront's top bar.
--
-- The bar was a hard-coded "This week — free delivery over NPR 2000" that only a
-- developer could change. This lets the owner write their own — a welcome code,
-- a Dashain offer, a delivery threshold — and turn it on or off, from Settings.
-- When it is off or blank the storefront falls back to its built-in line, so the
-- bar is never empty. Additive, defaulted, reversible.

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS promo_text text NOT NULL DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS promo_enabled boolean NOT NULL DEFAULT false;
