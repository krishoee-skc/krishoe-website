-- Upgrade either legacy Factory schema to the canonical KRISHOE definition.
-- The schema runner owns BEGIN/COMMIT and records this file's checksum.
-- This migration never inserts demo data and never deletes business rows.

ALTER TABLE factory_workers
  ADD COLUMN IF NOT EXISTS hr_employee_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_items
  ADD COLUMN IF NOT EXISTS production_item_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_daily_work
  ADD COLUMN IF NOT EXISTS submission_key TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_worker_ledger
  ADD COLUMN IF NOT EXISTS submission_key TEXT,
  ADD COLUMN IF NOT EXISTS source_work_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_weekly_advance
  ADD COLUMN IF NOT EXISTS submission_key TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_monthly_summary
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE factory_workers
  ALTER COLUMN monthly_salary TYPE NUMERIC(12, 2) USING monthly_salary::NUMERIC(12, 2),
  ALTER COLUMN weekly_advance TYPE NUMERIC(12, 2) USING weekly_advance::NUMERIC(12, 2);
ALTER TABLE factory_rates
  ALTER COLUMN rate_per_pair TYPE NUMERIC(12, 2) USING rate_per_pair::NUMERIC(12, 2);
ALTER TABLE factory_daily_work
  ALTER COLUMN rate_applied TYPE NUMERIC(12, 2) USING rate_applied::NUMERIC(12, 2),
  ALTER COLUMN amount_earned TYPE NUMERIC(12, 2) USING amount_earned::NUMERIC(12, 2);
ALTER TABLE factory_worker_ledger
  ALTER COLUMN amount_earned TYPE NUMERIC(12, 2) USING amount_earned::NUMERIC(12, 2),
  ALTER COLUMN payment_given TYPE NUMERIC(12, 2) USING payment_given::NUMERIC(12, 2),
  ALTER COLUMN running_balance TYPE NUMERIC(12, 2) USING running_balance::NUMERIC(12, 2);
ALTER TABLE factory_weekly_advance
  ALTER COLUMN advance_amount TYPE NUMERIC(12, 2) USING advance_amount::NUMERIC(12, 2),
  ALTER COLUMN date_given SET DEFAULT CURRENT_DATE;
ALTER TABLE factory_monthly_summary
  ALTER COLUMN total_earned TYPE NUMERIC(12, 2) USING total_earned::NUMERIC(12, 2),
  ALTER COLUMN total_paid TYPE NUMERIC(12, 2) USING total_paid::NUMERIC(12, 2),
  ALTER COLUMN final_balance TYPE NUMERIC(12, 2) USING final_balance::NUMERIC(12, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM factory_workers
    WHERE worker_type NOT IN ('piece_rate', 'monthly_staff', 'daily_staff')
       OR worker_type IS NULL
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid factory_workers.worker_type value.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM factory_workers
    WHERE category NOT IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff')
       OR category IS NULL
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid or empty worker category.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM factory_workers
    WHERE status NOT IN ('active', 'inactive')
       OR monthly_salary < 0
       OR weekly_advance < 0
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid worker status or negative worker amount.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM factory_items WHERE status NOT IN ('active', 'inactive')
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid factory item status.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_items
    WHERE code IS NOT NULL AND btrim(code) <> ''
    GROUP BY code
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: duplicate non-empty factory item code.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM factory_rates
    WHERE rate_per_pair <= 0 OR btrim(worker_category) = ''
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid Factory rate.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_rates
    GROUP BY item_id, worker_category, effective_date
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: duplicate item/category/effective-date rate.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM factory_daily_work
    WHERE pairs_count <= 0
       OR rate_applied <= 0
       OR amount_earned <= 0
       OR status NOT IN ('in_progress', 'completed', 'rework')
       OR round(amount_earned, 2) <> round(pairs_count * rate_applied, 2)
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid work quantity/rate/amount/status.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM factory_worker_ledger
    WHERE entry_type NOT IN ('work', 'payment', 'adjustment')
       OR status NOT IN ('pending', 'settled', 'reversed')
       OR work_pairs < 0
       OR amount_earned < 0
       OR payment_given < 0
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid worker ledger row.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM factory_weekly_advance WHERE advance_amount <= 0
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid weekly advance amount.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM factory_monthly_summary
    WHERE month <> date_trunc('month', month)::date
       OR total_pairs < 0
       OR total_earned < 0
       OR total_paid < 0
       OR status NOT IN ('draft', 'locked')
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: invalid monthly summary row.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_monthly_summary
    GROUP BY month, worker_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Factory migration blocked: duplicate worker/month summary.';
  END IF;
END
$$;

ALTER TABLE factory_workers
  ALTER COLUMN category SET NOT NULL,
  DROP CONSTRAINT IF EXISTS factory_workers_worker_type_check,
  DROP CONSTRAINT IF EXISTS factory_workers_type_check,
  DROP CONSTRAINT IF EXISTS factory_workers_category_check,
  DROP CONSTRAINT IF EXISTS factory_workers_status_check,
  DROP CONSTRAINT IF EXISTS factory_workers_monthly_salary_check,
  DROP CONSTRAINT IF EXISTS factory_workers_weekly_advance_check;
ALTER TABLE factory_workers
  ADD CONSTRAINT factory_workers_type_check
    CHECK (worker_type IN ('piece_rate', 'monthly_staff', 'daily_staff')),
  ADD CONSTRAINT factory_workers_category_check
    CHECK (category IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff')),
  ADD CONSTRAINT factory_workers_status_check
    CHECK (status IN ('active', 'inactive')),
  ADD CONSTRAINT factory_workers_monthly_salary_check
    CHECK (monthly_salary IS NULL OR monthly_salary >= 0),
  ADD CONSTRAINT factory_workers_weekly_advance_check
    CHECK (weekly_advance IS NULL OR weekly_advance >= 0);

ALTER TABLE factory_items
  DROP CONSTRAINT IF EXISTS factory_items_status_check;
ALTER TABLE factory_items
  ADD CONSTRAINT factory_items_status_check CHECK (status IN ('active', 'inactive'));

ALTER TABLE factory_rates
  DROP CONSTRAINT IF EXISTS factory_rates_rate_per_pair_check;
ALTER TABLE factory_rates
  ADD CONSTRAINT factory_rates_rate_per_pair_check CHECK (rate_per_pair > 0);

ALTER TABLE factory_daily_work
  DROP CONSTRAINT IF EXISTS factory_daily_work_pairs_count_check,
  DROP CONSTRAINT IF EXISTS factory_daily_work_rate_applied_check,
  DROP CONSTRAINT IF EXISTS factory_daily_work_amount_earned_check,
  DROP CONSTRAINT IF EXISTS factory_daily_work_status_check;
ALTER TABLE factory_daily_work
  ADD CONSTRAINT factory_daily_work_pairs_count_check CHECK (pairs_count > 0),
  ADD CONSTRAINT factory_daily_work_rate_applied_check CHECK (rate_applied > 0),
  ADD CONSTRAINT factory_daily_work_amount_earned_check CHECK (amount_earned > 0),
  ADD CONSTRAINT factory_daily_work_status_check CHECK (status IN ('in_progress', 'completed', 'rework'));

ALTER TABLE factory_worker_ledger
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_work_pairs_check,
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_amount_earned_check,
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_payment_given_check,
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_entry_type_check,
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_type_check,
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_status_check;
ALTER TABLE factory_worker_ledger
  ADD CONSTRAINT factory_worker_ledger_work_pairs_check CHECK (work_pairs IS NULL OR work_pairs >= 0),
  ADD CONSTRAINT factory_worker_ledger_amount_earned_check CHECK (amount_earned IS NULL OR amount_earned >= 0),
  ADD CONSTRAINT factory_worker_ledger_payment_given_check CHECK (payment_given IS NULL OR payment_given >= 0),
  ADD CONSTRAINT factory_worker_ledger_type_check CHECK (entry_type IN ('work', 'payment', 'adjustment')),
  ADD CONSTRAINT factory_worker_ledger_status_check CHECK (status IN ('pending', 'settled', 'reversed'));

ALTER TABLE factory_weekly_advance
  DROP CONSTRAINT IF EXISTS factory_weekly_advance_advance_amount_check;
ALTER TABLE factory_weekly_advance
  ADD CONSTRAINT factory_weekly_advance_advance_amount_check CHECK (advance_amount > 0);

ALTER TABLE factory_monthly_summary
  DROP CONSTRAINT IF EXISTS factory_monthly_summary_total_pairs_check,
  DROP CONSTRAINT IF EXISTS factory_monthly_summary_total_earned_check,
  DROP CONSTRAINT IF EXISTS factory_monthly_summary_total_paid_check,
  DROP CONSTRAINT IF EXISTS factory_monthly_summary_month_check,
  DROP CONSTRAINT IF EXISTS factory_monthly_summary_status_check;
ALTER TABLE factory_monthly_summary
  ADD CONSTRAINT factory_monthly_summary_total_pairs_check CHECK (total_pairs >= 0),
  ADD CONSTRAINT factory_monthly_summary_total_earned_check CHECK (total_earned >= 0),
  ADD CONSTRAINT factory_monthly_summary_total_paid_check CHECK (total_paid >= 0),
  ADD CONSTRAINT factory_monthly_summary_month_check CHECK (month = date_trunc('month', month)::date),
  ADD CONSTRAINT factory_monthly_summary_status_check CHECK (status IN ('draft', 'locked'));

ALTER TABLE factory_workers
  DROP CONSTRAINT IF EXISTS factory_workers_hr_employee_id_fkey;
ALTER TABLE factory_workers
  ADD CONSTRAINT factory_workers_hr_employee_id_fkey
    FOREIGN KEY (hr_employee_id) REFERENCES hr_employees(id) ON DELETE RESTRICT;
ALTER TABLE factory_items
  DROP CONSTRAINT IF EXISTS factory_items_production_item_id_fkey;
ALTER TABLE factory_items
  ADD CONSTRAINT factory_items_production_item_id_fkey
    FOREIGN KEY (production_item_id) REFERENCES production_items(id) ON DELETE RESTRICT;
ALTER TABLE factory_rates
  DROP CONSTRAINT IF EXISTS factory_rates_item_id_fkey;
ALTER TABLE factory_rates
  ADD CONSTRAINT factory_rates_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES factory_items(id) ON DELETE RESTRICT;
ALTER TABLE factory_daily_work
  DROP CONSTRAINT IF EXISTS factory_daily_work_worker_id_fkey,
  DROP CONSTRAINT IF EXISTS factory_daily_work_item_id_fkey;
ALTER TABLE factory_daily_work
  ADD CONSTRAINT factory_daily_work_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES factory_workers(id) ON DELETE RESTRICT,
  ADD CONSTRAINT factory_daily_work_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES factory_items(id) ON DELETE RESTRICT;
ALTER TABLE factory_worker_ledger
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_worker_id_fkey,
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_source_work_id_fkey;
ALTER TABLE factory_worker_ledger
  ADD CONSTRAINT factory_worker_ledger_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES factory_workers(id) ON DELETE RESTRICT,
  ADD CONSTRAINT factory_worker_ledger_source_work_id_fkey
    FOREIGN KEY (source_work_id) REFERENCES factory_daily_work(id) ON DELETE RESTRICT;
ALTER TABLE factory_weekly_advance
  DROP CONSTRAINT IF EXISTS factory_weekly_advance_worker_id_fkey;
ALTER TABLE factory_weekly_advance
  ADD CONSTRAINT factory_weekly_advance_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES factory_workers(id) ON DELETE RESTRICT;
ALTER TABLE factory_monthly_summary
  DROP CONSTRAINT IF EXISTS factory_monthly_summary_worker_id_fkey;
ALTER TABLE factory_monthly_summary
  ADD CONSTRAINT factory_monthly_summary_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES factory_workers(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS factory_workers_hr_employee_unique_idx
  ON factory_workers(hr_employee_id) WHERE hr_employee_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS factory_items_production_item_unique_idx
  ON factory_items(production_item_id) WHERE production_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS factory_items_code_key
  ON factory_items(code) WHERE code IS NOT NULL AND btrim(code) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS factory_rates_item_category_date_key
  ON factory_rates(item_id, worker_category, effective_date);
CREATE UNIQUE INDEX IF NOT EXISTS factory_daily_work_submission_key_idx
  ON factory_daily_work(submission_key)
  WHERE submission_key IS NOT NULL AND submission_key <> '';
CREATE UNIQUE INDEX IF NOT EXISTS factory_worker_ledger_submission_key_idx
  ON factory_worker_ledger(submission_key)
  WHERE submission_key IS NOT NULL AND submission_key <> '';
CREATE UNIQUE INDEX IF NOT EXISTS factory_worker_ledger_source_work_idx
  ON factory_worker_ledger(source_work_id) WHERE source_work_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS factory_weekly_advance_submission_key_idx
  ON factory_weekly_advance(submission_key)
  WHERE submission_key IS NOT NULL AND submission_key <> '';
CREATE UNIQUE INDEX IF NOT EXISTS factory_monthly_summary_month_worker_key
  ON factory_monthly_summary(month, worker_id);

CREATE INDEX IF NOT EXISTS factory_workers_status_idx ON factory_workers(status);
CREATE INDEX IF NOT EXISTS factory_workers_type_idx ON factory_workers(worker_type);
CREATE INDEX IF NOT EXISTS factory_items_status_idx ON factory_items(status);
CREATE INDEX IF NOT EXISTS factory_rates_lookup_idx
  ON factory_rates(item_id, worker_category, effective_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS factory_daily_work_worker_date_idx
  ON factory_daily_work(worker_id, date DESC);
CREATE INDEX IF NOT EXISTS factory_daily_work_item_idx ON factory_daily_work(item_id);
CREATE INDEX IF NOT EXISTS factory_worker_ledger_worker_date_idx
  ON factory_worker_ledger(worker_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS factory_worker_ledger_status_idx ON factory_worker_ledger(status);
CREATE INDEX IF NOT EXISTS factory_weekly_advance_worker_week_idx
  ON factory_weekly_advance(worker_id, week_of_date DESC);
CREATE INDEX IF NOT EXISTS factory_monthly_summary_worker_month_idx
  ON factory_monthly_summary(worker_id, month DESC);
