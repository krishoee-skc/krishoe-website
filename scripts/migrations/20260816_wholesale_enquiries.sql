-- Shops asking to buy in bulk.
--
-- Every product already carries a trade rate and a minimum order quantity, and
-- the POS already sells on a Wholesale channel — all of it built, none of it
-- reachable. A shopkeeper landing on krishoe.com had no way to learn that
-- KRISHOE sells wholesale at all.
--
-- For a factory this is the larger money: a retail customer buys one pair, a
-- shop buys fifty. The rate itself stays off the storefront, which is a
-- decision already made in the product page — publishing trade rates teaches
-- retail customers what the shop paid.

CREATE TABLE IF NOT EXISTS wholesale_enquiries (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  shop_name text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  -- What they are after, in their own words. A dropdown of designs would be
  -- wrong here: a shop asks for "ladies chappal, 200 pairs a month", not for
  -- one SKU.
  requirement text NOT NULL DEFAULT '',
  monthly_pairs integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Customer', 'Closed')),
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wholesale_enquiries_status_idx
  ON wholesale_enquiries (status, created_at DESC);
