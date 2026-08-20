-- Customers bringing customers.
--
-- In Nepal a shop this size grows on somebody telling somebody. That already
-- happens and the shop has never been able to see it, reward it, or tell it
-- apart from luck.
--
-- Both sides get 5% — the friend at checkout, which is the reason to use the
-- code at all, and the referrer only once the friend's order has actually been
-- delivered. That asymmetry is the whole fraud story: a discount taken on goods
-- you pay for cannot be farmed, but a reward paid on orders that merely exist
-- can be, by anyone willing to place orders they never accept.

CREATE TABLE IF NOT EXISTS referral_codes (
  -- Stored uppercase, like coupon codes: the friend types it on a phone
  -- keyboard and it has to find the same row either way.
  code text PRIMARY KEY,
  -- One code per customer, forever. A customer who could mint codes could hand
  -- a fresh one to every acquaintance and collect on all of them.
  customer_user_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per order that arrived through somebody's code.
--
-- Recorded when the order is placed, rewarded only when it is delivered, which
-- is why claiming and rewarding are two columns rather than one row that
-- appears late. A claim that never gets rewarded is itself worth seeing: it is
-- either an order that fell through or somebody testing the system.
CREATE TABLE IF NOT EXISTS referral_claims (
  order_id text PRIMARY KEY,
  code text NOT NULL REFERENCES referral_codes(code),
  referrer_user_id text NOT NULL,
  -- Nullable: a friend can order without an account, and refusing the discount
  -- to guests would remove most of the people the referrer can actually reach.
  friend_user_id text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  -- The coupon issued to the referrer, and when. Null until the goods arrive.
  reward_code text,
  rewarded_at timestamptz
);

CREATE INDEX IF NOT EXISTS referral_claims_referrer_idx
  ON referral_claims (referrer_user_id);
CREATE INDEX IF NOT EXISTS referral_claims_pending_idx
  ON referral_claims (rewarded_at) WHERE rewarded_at IS NULL;
