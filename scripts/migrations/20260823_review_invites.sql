-- Asking the customer what they thought, a week after the pair arrived.
--
-- The shop has seven products, real photographs on all of them, and zero
-- reviews. A shopper deciding between KRISHOE and a shop they already know has
-- nothing to go on but the photograph — and a Nepali shopper checks reviews on
-- Daraz before buying a two-hundred-rupee item. Nothing on the storefront is
-- worth more per hour of work than the first ten honest reviews, and none of
-- them arrive unless someone asks.
--
-- Asking has to cost the customer nothing. The review form already built opens
-- only to a signed-in customer who can be matched to a closed order, which is
-- correct and also why it has produced nothing: almost nobody makes an account
-- to praise a slipper. The invite carries a signed link instead — the signature
-- is the proof of purchase, so the customer taps it and writes.

-- Which order a review came from. Not a foreign key, for the same reason
-- product_id is not: the review outlives the row it was written against, and
-- losing it because an order was tidied away would be the wrong trade.
ALTER TABLE customer_voice ADD COLUMN IF NOT EXISTS order_id text NOT NULL DEFAULT '';

-- One review per pair per order, so a re-sent invite or a re-tapped link adds
-- nothing. Partial, because everything that is not a review has neither.
CREATE UNIQUE INDEX IF NOT EXISTS customer_voice_one_review_per_order_idx
  ON customer_voice (order_id, product_id)
  WHERE kind = 'review' AND order_id <> '';

-- When the invite went out. NULL means it has not, which is what the daily job
-- looks for; stamping it is what stops the shop asking the same customer every
-- morning for the rest of the year.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_invite_sent_at timestamptz;

-- The daily job asks for closed orders that have not been invited yet. Partial,
-- so the index holds only the handful still owing an invite rather than every
-- order the shop has ever taken.
CREATE INDEX IF NOT EXISTS orders_review_invite_pending_idx
  ON orders (created_at)
  WHERE review_invite_sent_at IS NULL;
