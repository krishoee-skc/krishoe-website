-- Link a simple Factory cash payment to the matching Production Accounts row.
-- The schema runner owns BEGIN/COMMIT. No business row is deleted or seeded.

ALTER TABLE worker_payments
  ADD COLUMN IF NOT EXISTS source_submission_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS worker_payments_submission_key_idx
  ON worker_payments(source_submission_key)
  WHERE source_submission_key IS NOT NULL;
