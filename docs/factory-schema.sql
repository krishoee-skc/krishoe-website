-- KRISHOE Factory Management System Schema
-- Tables for worker management, production tracking, and payroll

-- Factory Workers Table
CREATE TABLE IF NOT EXISTS factory_workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  worker_type TEXT NOT NULL CHECK (worker_type IN ('piece_rate', 'monthly_staff')),
  category TEXT CHECK (category IN ('Upper', 'Fibermen', 'Staff')),
  monthly_salary INTEGER,
  weekly_advance INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factory_workers_status_idx ON factory_workers(status);

-- Factory Products/Items Table
CREATE TABLE IF NOT EXISTS factory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Piece Rates Table
CREATE TABLE IF NOT EXISTS factory_rates (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES factory_items(id) ON DELETE CASCADE,
  worker_category TEXT NOT NULL CHECK (worker_category IN ('Upper', 'Fibermen')),
  rate_per_pair INTEGER NOT NULL CHECK (rate_per_pair > 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factory_rates_item_category_idx ON factory_rates(item_id, worker_category);

-- Daily Work Entries Table
CREATE TABLE IF NOT EXISTS factory_daily_work (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES factory_items(id) ON DELETE CASCADE,
  color TEXT,
  size TEXT,
  pairs_count INTEGER NOT NULL CHECK (pairs_count > 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'rework')),
  rate_applied INTEGER NOT NULL CHECK (rate_applied > 0),
  amount_earned INTEGER NOT NULL CHECK (amount_earned > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factory_daily_work_worker_date_idx ON factory_daily_work(worker_id, date);
CREATE INDEX IF NOT EXISTS factory_daily_work_date_idx ON factory_daily_work(date);

-- Worker Ledger Table
CREATE TABLE IF NOT EXISTS factory_worker_ledger (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('work', 'payment')),
  work_pairs INTEGER,
  amount_earned INTEGER,
  payment_given INTEGER,
  running_balance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factory_worker_ledger_worker_date_idx ON factory_worker_ledger(worker_id, date);
CREATE INDEX IF NOT EXISTS factory_worker_ledger_status_idx ON factory_worker_ledger(status);

-- Weekly Advance Table (for monthly staff)
CREATE TABLE IF NOT EXISTS factory_weekly_advance (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE CASCADE,
  week_of_date DATE NOT NULL,
  advance_amount INTEGER NOT NULL CHECK (advance_amount > 0),
  date_given DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factory_weekly_advance_worker_week_idx ON factory_weekly_advance(worker_id, week_of_date);

-- Monthly Summary Table (auto-generated)
CREATE TABLE IF NOT EXISTS factory_monthly_summary (
  id TEXT PRIMARY KEY,
  month DATE NOT NULL,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE CASCADE,
  total_pairs INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_paid INTEGER NOT NULL DEFAULT 0,
  final_balance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factory_monthly_summary_month_worker_idx ON factory_monthly_summary(month, worker_id);
CREATE UNIQUE INDEX IF NOT EXISTS factory_monthly_summary_unique_idx ON factory_monthly_summary(month, worker_id);
