-- Owner-controlled bank details for customer transfers.
--
-- The checkout page told every shopper to send money to:
--
--   Bank: Nabil Bank Ltd. / Account No: 12345678901234
--
-- That account number is invented, and it was hard-coded in
-- components/PaymentInstructions.tsx because there was nowhere for the real one
-- to live. A customer at the moment of paying saw an obviously fake account —
-- the single most trust-destroying thing on an otherwise honest shop.
--
-- So the real details live here, for the owner to set from Settings, the same
-- way the promo bar and review links do. Empty means the shop is not taking
-- transfers yet, and checkout then shows no bank panel at all rather than half
-- an account. Additive, defaulted, reversible — like the columns before them.

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_name text NOT NULL DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_account_name text NOT NULL DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_account_number text NOT NULL DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_branch text NOT NULL DEFAULT '';
