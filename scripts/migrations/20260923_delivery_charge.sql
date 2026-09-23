-- The owner's delivery charge, set from Settings instead of promised in copy.
--
-- The shop told customers "free delivery over NPR 2000" in three places and
-- "Free Shipping" in a fourth, while no code charged a fee or granted the free
-- one. These two numbers are what every screen and the checkout now read:
--
--   delivery_fee_paisa        flat courier charge; 0 = confirmed on the call
--   free_delivery_over_paisa  orders at or above this go free; 0 = no threshold
--
-- The defaults keep today's promise exactly: free over NPR 2000, anything under
-- it confirmed on the call. Additive, defaulted, reversible. The order's own
-- delivery charge needs no column: it is total - subtotal + discount.

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS delivery_fee_paisa bigint NOT NULL DEFAULT 0 CHECK (delivery_fee_paisa >= 0);
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS free_delivery_over_paisa bigint NOT NULL DEFAULT 200000 CHECK (free_delivery_over_paisa >= 0);
