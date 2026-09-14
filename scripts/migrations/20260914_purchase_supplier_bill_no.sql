-- The number written on the supplier's own bill.
--
-- A purchase already carries KR-PUR-20260914-0001, but that is KRISHOE's
-- number, generated when the bill is filed. The supplier's bill has its own
-- number printed on it, and that is the one they use: "the payment for bill
-- 4521". There was nowhere to put it.
--
-- The form told the owner to write it into the note — "Bill note, vehicle,
-- gate pass, invoice no." — which mixes it with everything else and cannot be
-- searched or matched against. Reconciling an account with a supplier then
-- means reading free text on every row.
--
-- Optional, not required. Small suppliers here often hand over goods with no
-- printed bill at all, and making this compulsory would mean a real delivery
-- could not be recorded. Blank is a legitimate answer; the screen says "no
-- bill no." so a forgotten one is still visible.
--
-- Additive, defaulted and re-runnable. The one purchase already stored keeps
-- an empty value and is untouched.

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS supplier_bill_no TEXT NOT NULL DEFAULT '';

-- Finding a bill by the number the supplier quotes is the whole point, and a
-- shop with a few thousand purchases should not scan them all to do it.
CREATE INDEX IF NOT EXISTS purchase_invoices_supplier_bill_no_idx
  ON purchase_invoices (supplier_bill_no)
  WHERE supplier_bill_no <> '';
