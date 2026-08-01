-- Attribute staff advances and salary payments to the salary month selected by
-- the Owner, even when cash is handed over in a later calendar month.
-- The schema runner owns BEGIN/COMMIT. No business row is deleted here.

ALTER TABLE factory_worker_ledger
  ADD COLUMN IF NOT EXISTS salary_period_month DATE;

ALTER TABLE factory_weekly_advance
  ADD COLUMN IF NOT EXISTS salary_period_month DATE;

UPDATE factory_worker_ledger AS ledger
SET salary_period_month = date_trunc('month', ledger.date)::date
FROM factory_workers AS worker
WHERE ledger.worker_id = worker.id
  AND worker.worker_type IN ('monthly_staff', 'daily_staff')
  AND ledger.entry_type = 'payment'
  AND ledger.salary_period_month IS NULL;

UPDATE factory_weekly_advance
SET salary_period_month = date_trunc('month', date_given)::date
WHERE salary_period_month IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM factory_worker_ledger
    WHERE salary_period_month IS NOT NULL
      AND salary_period_month <> date_trunc('month', salary_period_month)::date
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid ledger salary period month.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_weekly_advance
    WHERE salary_period_month IS NULL
       OR salary_period_month <> date_trunc('month', salary_period_month)::date
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid advance salary period month.';
  END IF;
END
$$;

ALTER TABLE factory_worker_ledger
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_salary_period_check;
ALTER TABLE factory_worker_ledger
  ADD CONSTRAINT factory_worker_ledger_salary_period_check
    CHECK (
      salary_period_month IS NULL
      OR salary_period_month = date_trunc('month', salary_period_month)::date
    );

ALTER TABLE factory_weekly_advance
  ALTER COLUMN salary_period_month SET NOT NULL,
  DROP CONSTRAINT IF EXISTS factory_weekly_advance_salary_period_check;
ALTER TABLE factory_weekly_advance
  ADD CONSTRAINT factory_weekly_advance_salary_period_check
    CHECK (salary_period_month = date_trunc('month', salary_period_month)::date);

CREATE INDEX IF NOT EXISTS factory_worker_ledger_salary_period_idx
  ON factory_worker_ledger(worker_id, salary_period_month DESC)
  WHERE salary_period_month IS NOT NULL;

CREATE INDEX IF NOT EXISTS factory_weekly_advance_salary_period_idx
  ON factory_weekly_advance(worker_id, salary_period_month DESC);
