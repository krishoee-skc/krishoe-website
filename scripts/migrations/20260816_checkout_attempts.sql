-- Someone who reached checkout, gave an email, and did not finish.
--
-- There is no cart table to recover from: the cart lives in the browser. What
-- the shop can see is the moment a customer identifies themselves on the
-- checkout page — at that point they have chosen the pairs, typed their
-- address, and stopped. One reminder at that point is the cheapest order this
-- shop will ever take, because everything except the last tap already happened.
--
-- Only what is needed to send that one message and to recognise the order when
-- it arrives. No browsing history, nothing about pages viewed.

CREATE TABLE IF NOT EXISTS checkout_attempts (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Lowercased. The same shopper coming back to the page updates their row
  -- rather than adding another, so a reminder is never sent twice for one
  -- basket.
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  item_count integer NOT NULL DEFAULT 0,
  total_paisa integer NOT NULL DEFAULT 0,
  -- A short human line: "Doctor Chappal × 2, bag open × 1". Enough for the
  -- email to name what was left behind without storing the whole cart.
  summary text NOT NULL DEFAULT '',
  reminded_at timestamptz,
  -- Set when an order later arrives from this address, so the row stops being
  -- a candidate and the shop can count what the reminder actually recovered.
  recovered_order_id text
);

CREATE UNIQUE INDEX IF NOT EXISTS checkout_attempts_email_idx
  ON checkout_attempts (lower(email));

-- The reminder query: open attempts, oldest first.
CREATE INDEX IF NOT EXISTS checkout_attempts_open_idx
  ON checkout_attempts (created_at)
  WHERE reminded_at IS NULL AND recovered_order_id IS NULL;
