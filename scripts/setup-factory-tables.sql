-- KRISHOE factory module schema.
-- This file matches the Next.js factory API routes under app/api/factory.

BEGIN;

CREATE TABLE IF NOT EXISTS factory_workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  worker_type TEXT NOT NULL,
  category TEXT,
  monthly_salary NUMERIC(12, 2),
  weekly_advance NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_rates (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES factory_items(id),
  worker_category TEXT NOT NULL,
  rate_per_pair NUMERIC(12, 2) NOT NULL CHECK (rate_per_pair >= 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_daily_work (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id),
  item_id TEXT NOT NULL REFERENCES factory_items(id),
  color TEXT,
  size TEXT,
  pairs_count INTEGER NOT NULL CHECK (pairs_count > 0),
  status TEXT NOT NULL DEFAULT 'completed',
  rate_applied NUMERIC(12, 2) NOT NULL CHECK (rate_applied >= 0),
  amount_earned NUMERIC(12, 2) NOT NULL CHECK (amount_earned >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_worker_ledger (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id),
  date DATE NOT NULL,
  entry_type TEXT NOT NULL,
  work_pairs INTEGER,
  amount_earned NUMERIC(12, 2),
  payment_given NUMERIC(12, 2),
  running_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_weekly_advance (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id),
  week_of_date DATE NOT NULL,
  advance_amount NUMERIC(12, 2) NOT NULL CHECK (advance_amount > 0),
  date_given DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_monthly_summary (
  id TEXT PRIMARY KEY,
  month DATE NOT NULL,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id),
  total_pairs INTEGER NOT NULL DEFAULT 0,
  total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_workers_status ON factory_workers(status);
CREATE INDEX IF NOT EXISTS idx_factory_workers_type ON factory_workers(worker_type);
CREATE INDEX IF NOT EXISTS idx_factory_items_status ON factory_items(status);
CREATE INDEX IF NOT EXISTS idx_factory_rates_lookup ON factory_rates(item_id, worker_category, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_factory_daily_work_date ON factory_daily_work(date);
CREATE INDEX IF NOT EXISTS idx_factory_daily_work_worker ON factory_daily_work(worker_id);
CREATE INDEX IF NOT EXISTS idx_factory_daily_work_item ON factory_daily_work(item_id);
CREATE INDEX IF NOT EXISTS idx_factory_worker_ledger_worker_date ON factory_worker_ledger(worker_id, date);
CREATE INDEX IF NOT EXISTS idx_factory_weekly_advance_worker_week ON factory_weekly_advance(worker_id, week_of_date);
CREATE INDEX IF NOT EXISTS idx_factory_monthly_summary_worker_month ON factory_monthly_summary(worker_id, month);

INSERT INTO factory_workers (id, name, worker_type, category, monthly_salary, weekly_advance, status)
VALUES
  ('seed-worker-upper-1', 'Raj Kumar', 'piece_rate', 'Upper', NULL, NULL, 'active'),
  ('seed-worker-fiber-1', 'Santosh Sharma', 'piece_rate', 'Fibermen', NULL, NULL, 'active'),
  ('seed-worker-staff-1', 'Factory Staff', 'monthly_staff', 'Staff', 15000, NULL, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO factory_items (id, name, code, status)
VALUES
  ('seed-item-flatpatta', 'Flatpatta', 'FP001', 'active'),
  ('seed-item-sandal', 'Sandal', 'SD001', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO factory_rates (id, item_id, worker_category, rate_per_pair, effective_date)
VALUES
  ('seed-rate-flatpatta-upper', 'seed-item-flatpatta', 'Upper', 12, CURRENT_DATE),
  ('seed-rate-flatpatta-fiber', 'seed-item-flatpatta', 'Fibermen', 8, CURRENT_DATE),
  ('seed-rate-sandal-upper', 'seed-item-sandal', 'Upper', 10, CURRENT_DATE),
  ('seed-rate-sandal-fiber', 'seed-item-sandal', 'Fibermen', 6, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

COMMIT;
