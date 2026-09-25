-- How a counter bill was paid, part by part.
--
-- A bill carried one payment method and one paid amount, which cannot say
-- "Rs 1,000 in cash and the rest by QR", "the old pair came back and paid for
-- most of the new one", or "and last month's credit was cleared too". Each of
-- those is one entry here (see lib/pos-payments.ts):
--
--   payments  [{ "method": "Cash", "amount": 1000, "purpose": "bill" },
--              { "method": "QR", "amount": 1600, "purpose": "bill", "reference": "88123" }]
--
-- An empty list — the default, and every bill saved before this — reads
-- exactly as before: the bill's one method and its paid amount. Additive,
-- defaulted, reversible (DROP COLUMN payments).

ALTER TABLE pos_invoices ADD COLUMN IF NOT EXISTS payments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(payments) = 'array');
