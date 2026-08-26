-- Let a supplier bill be paid by QR.
--
-- The shop pays suppliers through eSewa, Khalti and Fonepay already. The only
-- place to record that was "Bank", which loses which wallet the money went
-- through and reads back as a transfer nobody made. POS has accepted QR since
-- it was built (see the pos_invoices check further down schema.sql); purchasing
-- never did, and these two CHECK constraints are the reason a QR bill would be
-- refused by the database however the form was written.
--
-- Safe to run twice: each constraint is dropped by name if present and added
-- back widened. Nothing is deleted and no existing row changes — every value
-- allowed before is still allowed.

ALTER TABLE purchase_invoices
  DROP CONSTRAINT IF EXISTS purchase_invoices_payment_method_check;

ALTER TABLE purchase_invoices
  ADD CONSTRAINT purchase_invoices_payment_method_check
  CHECK (payment_method IN ('Cash', 'Cheque', 'Bank', 'Credit', 'QR'));

ALTER TABLE supplier_transactions
  DROP CONSTRAINT IF EXISTS supplier_transactions_type_check;

ALTER TABLE supplier_transactions
  ADD CONSTRAINT supplier_transactions_type_check
  CHECK (type IN (
    'Purchase Bill',
    'Cash Payment',
    'Cheque Payment',
    'Bank Payment',
    'QR Payment',
    'Return Adjustment',
    'Manual Adjustment'
  ));
