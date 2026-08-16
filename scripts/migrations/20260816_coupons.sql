-- Discount codes, so a campaign can exist at all.
--
-- Nothing in the shop could take a code before this: no launch offer, no
-- Dashain discount, no "10% off if you order from the TikTok video" — which is
-- the way a small Nepali shop actually gets its first hundred customers.
--
-- Money rules live in the columns rather than in the person typing the coupon:
-- a minimum spend, a cap on how much a percentage can take, a window of dates,
-- and a ceiling on total redemptions. A code handed out on TikTok reaches more
-- people than intended roughly always, and the ceiling is what stops that being
-- expensive.

CREATE TABLE IF NOT EXISTS coupons (
  -- Stored uppercase and trimmed. The customer types "dashain10" on a phone
  -- keyboard; it has to find the same row as "DASHAIN10" on the poster.
  code text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('percent', 'amount')),
  -- percent: 1–100. amount: paisa, matching products.price_value.
  value integer NOT NULL CHECK (value > 0),
  min_order_paisa integer NOT NULL DEFAULT 0 CHECK (min_order_paisa >= 0),
  -- Ceiling for a percentage discount. A 20% code meeting a wholesale-sized
  -- basket should not quietly give away thousands.
  max_discount_paisa integer CHECK (max_discount_paisa IS NULL OR max_discount_paisa > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  -- NULL means unlimited.
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupons_status_idx ON coupons (status);

-- What an order was actually charged, and why. Without these the shop can tell
-- that a total looks low but not which code did it, and no campaign can ever be
-- measured.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_paisa integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS orders_coupon_code_idx ON orders (coupon_code)
  WHERE coupon_code IS NOT NULL;
