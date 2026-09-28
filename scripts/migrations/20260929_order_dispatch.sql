-- How an online order left the shop, and why one was cancelled.
--
-- The order desk had New, Contacted, Closed and Cancelled, and nowhere to say
-- the pairs were sent, who took them, what the delivery cost or why an order
-- was dropped. The order's status is left exactly as it is: a sent order stays
-- Contacted (so it keeps holding its pairs and counts as a sale everywhere it
-- did), and dispatched_at is what says it is on its way. Converting it to a
-- bill still closes it.
--
--   dispatched_at          when it was sent (NULL = not sent)
--   dispatch_by            who took it: our own person, or a courier's name
--   dispatch_charge_paisa  what the delivery cost, in paisa
--   dispatch_tracking      the courier's number, if any
--   cancel_reason          why it was cancelled, if it was
--
-- Additive, defaulted, reversible (DROP COLUMN each).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at timestamptz DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_by text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_charge_paisa bigint NOT NULL DEFAULT 0 CHECK (dispatch_charge_paisa >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_tracking text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason text NOT NULL DEFAULT '';
