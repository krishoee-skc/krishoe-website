-- KRISHOE Postgres schema draft
-- Use this for the first real database migration from local JSON.
-- Run in a new empty database first, then import data from /api/admin/backup.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Product catalog
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  price TEXT NOT NULL,
  price_value INTEGER NOT NULL DEFAULT 0 CHECK (price_value >= 0),
  wholesale_price_value INTEGER NOT NULL DEFAULT 0 CHECK (wholesale_price_value >= 0),
  min_wholesale_qty INTEGER NOT NULL DEFAULT 1 CHECK (min_wholesale_qty >= 1),
  image TEXT NOT NULL,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  badge TEXT,
  rating TEXT NOT NULL DEFAULT '4.8',
  description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  fit TEXT NOT NULL DEFAULT '',
  colors TEXT[] NOT NULL DEFAULT '{}',
  sizes TEXT[] NOT NULL DEFAULT '{}',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  highlights TEXT[] NOT NULL DEFAULT '{}',
  care TEXT[] NOT NULL DEFAULT '{}',
  reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Draft')),
  featured BOOLEAN NOT NULL DEFAULT false,
  best_seller BOOLEAN NOT NULL DEFAULT false,
  new_arrival BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_category_slug_idx ON products(category_slug);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);

-- Customer accounts and password reset tokens
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx ON users(lower(email));

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_email_idx ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens(expires_at);

-- Customer order requests and contact messages
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  delivery TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL DEFAULT '',
  order_text TEXT NOT NULL DEFAULT '',
  total TEXT NOT NULL DEFAULT '',
  -- 'Cancelled' is distinct from 'Closed': both release reserved stock, but
  -- only Closed means the order was actually fulfilled.
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Closed', 'Cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded')),
  payment_provider TEXT NOT NULL DEFAULT 'manual' CHECK (payment_provider IN ('manual', 'cod', 'esewa', 'khalti', 'bank', 'cash')),
  payment_reference TEXT NOT NULL DEFAULT '',
  payment_transaction_id TEXT NOT NULL DEFAULT '',
  payment_callback_id TEXT,
  payment_verified_at TIMESTAMPTZ,
  payment_ledger_id TEXT,
  payment_ledger_transaction_id TEXT
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Unpaid'
    CHECK (payment_status IN ('Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded')),
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'manual'
    CHECK (payment_provider IN ('manual', 'cod', 'esewa', 'khalti', 'bank', 'cash')),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_callback_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_ledger_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_ledger_transaction_id TEXT;

-- 'Cancelled' did not exist while Closed covered both fulfilled and abandoned.
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('New', 'Contacted', 'Closed', 'Cancelled'));

-- What an order actually reserves. Orders used to store only order_text, a
-- human sentence, so nothing could tell which product an order held.
-- product_id is not a foreign key on purpose: a product may be deleted from the
-- catalog, and that must not erase the history of what was ordered.
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_user_id_idx ON orders(customer_user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status);
CREATE INDEX IF NOT EXISTS orders_payment_provider_idx ON orders(payment_provider);
CREATE INDEX IF NOT EXISTS orders_payment_ledger_id_idx ON orders(payment_ledger_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_callback_id_unique_idx
  ON orders(payment_callback_id)
  WHERE payment_callback_id IS NOT NULL AND payment_callback_id <> '';

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Replied'))
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages(status);

-- Admin audit and notification queue
CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'warning')),
  actor_id TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  actor_branch_id TEXT NOT NULL DEFAULT ''
);

ALTER TABLE admin_audit_events
  ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actor_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actor_email TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actor_role TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actor_branch_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS admin_audit_events_created_at_idx ON admin_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_events_actor_email_idx ON admin_audit_events(actor_email);
CREATE INDEX IF NOT EXISTS admin_audit_events_actor_role_idx ON admin_audit_events(actor_role);

-- Company settings, branches, and real admin staff accounts
CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  company_name TEXT NOT NULL DEFAULT 'KRISHOE',
  legal_name TEXT NOT NULL DEFAULT 'KRISHOE',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  pan_vat_number TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'NPR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
  default_branch_id TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('Factory', 'Wholesale', 'Retail', 'Online', 'Office')),
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_branches_type_idx ON company_branches(type);
CREATE INDEX IF NOT EXISTS company_branches_status_idx ON company_branches(status);

CREATE TABLE IF NOT EXISTS admin_staff_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Manager', 'Accountant', 'HR', 'Inventory', 'Sales', 'Viewer')),
  branch_id TEXT NOT NULL REFERENCES company_branches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('Active', 'Disabled')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_staff_accounts_email_lower_unique_idx
  ON admin_staff_accounts(lower(email));
CREATE INDEX IF NOT EXISTS admin_staff_accounts_role_idx ON admin_staff_accounts(role);
CREATE INDEX IF NOT EXISTS admin_staff_accounts_branch_id_idx ON admin_staff_accounts(branch_id);
CREATE INDEX IF NOT EXISTS admin_staff_accounts_status_idx ON admin_staff_accounts(status);

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL CHECK (type IN ('order', 'contact', 'password-reset', 'operational-alert')),
  title TEXT NOT NULL,
  payload JSONB NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped')),
  delivery_attempts INTEGER NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
  delivered_at TIMESTAMPTZ,
  last_delivery_error TEXT NOT NULL DEFAULT '',
  last_delivery_channel TEXT NOT NULL DEFAULT ''
);

ALTER TABLE notification_events
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_delivery_error TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_delivery_channel TEXT NOT NULL DEFAULT '';

ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_type_check
  CHECK (type IN ('order', 'contact', 'password-reset', 'operational-alert'));

ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_delivery_status_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_delivery_status_check
  CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS notification_events_created_at_idx ON notification_events(created_at DESC);
CREATE INDEX IF NOT EXISTS notification_events_delivery_status_idx ON notification_events(delivery_status);

-- Shared abuse protection for login and public submissions
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_attempts_bucket_key_time_idx
  ON rate_limit_attempts(bucket, key_hash, attempted_at DESC);
CREATE INDEX IF NOT EXISTS rate_limit_attempts_attempted_at_idx
  ON rate_limit_attempts(attempted_at);

-- Factory raw material stock
CREATE TABLE IF NOT EXISTS raw_materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'meter', 'pair', 'piece', 'liter')),
  opening_stock NUMERIC NOT NULL DEFAULT 0 CHECK (opening_stock >= 0),
  used NUMERIC NOT NULL DEFAULT 0 CHECK (used >= 0),
  received NUMERIC NOT NULL DEFAULT 0 CHECK (received >= 0),
  reorder_level NUMERIC NOT NULL DEFAULT 0 CHECK (reorder_level >= 0)
);

-- Supplier ledger and raw material purchase trail
CREATE TABLE IF NOT EXISTS supplier_ledgers (
  id TEXT PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  material_focus TEXT NOT NULL DEFAULT '',
  total_purchase NUMERIC NOT NULL DEFAULT 0 CHECK (total_purchase >= 0),
  paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  balance_due NUMERIC NOT NULL DEFAULT 0 CHECK (balance_due >= 0),
  last_transaction DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_ledgers_balance_due_idx ON supplier_ledgers(balance_due DESC);
CREATE INDEX IF NOT EXISTS supplier_ledgers_updated_at_idx ON supplier_ledgers(updated_at DESC);

-- One supplier, one ledger. Two rows for the same person split what the shop
-- owes them, and neither row shows the real balance. A double-clicked Add
-- supplier button is enough to cause it, and two concurrent requests both pass
-- an application-level check — so the guarantee lives here.
--
-- Matched on the name as typed differently: case and runs of spaces are how one
-- name gets entered twice, not how two suppliers differ.
CREATE UNIQUE INDEX IF NOT EXISTS supplier_ledgers_name_unique
  ON supplier_ledgers (lower(btrim(regexp_replace(supplier_name, '\s+', ' ', 'g'))));

CREATE TABLE IF NOT EXISTS supplier_transactions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  supplier_ledger_id TEXT NOT NULL REFERENCES supplier_ledgers(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Purchase Bill', 'Cash Payment', 'Cheque Payment', 'Bank Payment', 'Return Adjustment', 'Manual Adjustment')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS supplier_transactions_ledger_id_idx ON supplier_transactions(supplier_ledger_id);
CREATE INDEX IF NOT EXISTS supplier_transactions_created_at_idx ON supplier_transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id TEXT PRIMARY KEY,
  purchase_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  supplier_ledger_id TEXT NOT NULL REFERENCES supplier_ledgers(id) ON DELETE RESTRICT,
  supplier_name TEXT NOT NULL,
  -- What the bill turned out to be, from its lines in purchase_invoice_items.
  -- 'Mixed' is a normal bill: suppliers sell leather and ready-made chappals on
  -- one bill. The lines are where the kinds actually live.
  kind TEXT NOT NULL DEFAULT 'Raw Material' CHECK (kind IN ('Raw Material', 'Trading Goods', 'Mixed')),
  -- The columns below summarise the bill's first line. They are kept because
  -- the invoice lists, exports and supplier ledger were built when a bill could
  -- only hold one item.
  material_id TEXT REFERENCES raw_materials(id) ON DELETE RESTRICT,
  material_name TEXT NOT NULL,
  -- design matches finished_stock.design, which the catalog sync matches
  -- against products.name.
  design TEXT NOT NULL DEFAULT '',
  channel TEXT CHECK (channel IN ('Factory', 'Wholesale', 'Retail', 'Online')),
  size_run TEXT NOT NULL DEFAULT 'Mixed',
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'meter', 'pair', 'piece', 'liter')),
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  rate NUMERIC NOT NULL DEFAULT 0 CHECK (rate >= 0),
  discount NUMERIC NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax NUMERIC NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
  paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  credit_amount NUMERIC NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Cheque', 'Bank', 'Credit')),
  payment_reference TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Partial', 'Credit')),
  posting_status TEXT NOT NULL CHECK (posting_status IN ('Posted', 'Needs Review')),
  supplier_transaction_ids TEXT[] NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT ''
);

-- Trading-goods purchase migration for databases created before it existed.
ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'Raw Material';

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS design TEXT NOT NULL DEFAULT '';

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS channel TEXT;

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS size_run TEXT NOT NULL DEFAULT 'Mixed';

-- material_id was NOT NULL while raw material was the only purchase kind.
ALTER TABLE purchase_invoices
  ALTER COLUMN material_id DROP NOT NULL;

ALTER TABLE purchase_invoices
  DROP CONSTRAINT IF EXISTS purchase_invoices_channel_check;

ALTER TABLE purchase_invoices
  ADD CONSTRAINT purchase_invoices_channel_check
  CHECK (channel IS NULL OR channel IN ('Factory', 'Wholesale', 'Retail', 'Online'));

-- The kind_fields check moved to purchase_invoice_items when a bill learned to
-- carry many lines: one supplier bill can hold leather and ready-made chappals
-- together, so kind is a property of the line, not of the bill.
ALTER TABLE purchase_invoices
  DROP CONSTRAINT IF EXISTS purchase_invoices_kind_fields_check;

-- A bill's kind is now a summary of its lines, not a choice made up front.
ALTER TABLE purchase_invoices
  DROP CONSTRAINT IF EXISTS purchase_invoices_kind_check;

ALTER TABLE purchase_invoices
  ADD CONSTRAINT purchase_invoices_kind_check
  CHECK (kind IN ('Raw Material', 'Trading Goods', 'Mixed'));

CREATE INDEX IF NOT EXISTS purchase_invoices_created_at_idx ON purchase_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_invoices_supplier_ledger_id_idx ON purchase_invoices(supplier_ledger_id);
CREATE INDEX IF NOT EXISTS purchase_invoices_material_id_idx ON purchase_invoices(material_id);
CREATE INDEX IF NOT EXISTS purchase_invoices_design_idx ON purchase_invoices(design);

-- One line of a supplier bill. A real bill runs from 1 to 25-odd lines, and can
-- mix raw material with ready-made pairs, so each line says what it is and
-- carries only the fields its posting side effect needs.
--
-- The invoice keeps its own kind/material_id/design/quantity/rate columns as a
-- summary of the first line, so existing lists and exports keep working.
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id TEXT PRIMARY KEY,
  purchase_invoice_id TEXT NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  -- Keeps the lines in the order they were typed, so the bill reads back the
  -- way the supplier wrote it.
  line_no INTEGER NOT NULL CHECK (line_no > 0),
  kind TEXT NOT NULL CHECK (kind IN ('Raw Material', 'Trading Goods')),
  -- Set on 'Raw Material' lines only.
  material_id TEXT REFERENCES raw_materials(id) ON DELETE RESTRICT,
  -- The material name, or the design for trading goods, so a line reads on its
  -- own without a join.
  item_name TEXT NOT NULL,
  -- Set on 'Trading Goods' lines only.
  design TEXT NOT NULL DEFAULT '',
  channel TEXT CHECK (channel IS NULL OR channel IN ('Factory', 'Wholesale', 'Retail', 'Online')),
  size_run TEXT NOT NULL DEFAULT 'Mixed',
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'meter', 'pair', 'piece', 'liter')),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  rate NUMERIC NOT NULL CHECK (rate >= 0),
  -- quantity * rate, before the bill's discount and tax are shared out.
  line_subtotal NUMERIC NOT NULL CHECK (line_subtotal >= 0),
  -- The line's share of the bill-level discount and tax, split by value. This
  -- is what the line actually cost, and what costing reads.
  line_total NUMERIC NOT NULL CHECK (line_total >= 0),
  note TEXT NOT NULL DEFAULT '',
  -- A malformed line is rejected by the database rather than posting to
  -- nothing: raw material must name a material, trading goods must name a
  -- design and a channel.
  CONSTRAINT purchase_invoice_items_kind_fields_check CHECK (
    (kind = 'Raw Material' AND material_id IS NOT NULL)
    OR (kind = 'Trading Goods' AND design <> '' AND channel IS NOT NULL)
  ),
  CONSTRAINT purchase_invoice_items_line_unique UNIQUE (purchase_invoice_id, line_no)
);

CREATE INDEX IF NOT EXISTS purchase_invoice_items_invoice_idx ON purchase_invoice_items(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS purchase_invoice_items_material_idx ON purchase_invoice_items(material_id);
CREATE INDEX IF NOT EXISTS purchase_invoice_items_design_idx ON purchase_invoice_items(design);

-- Factory costing model for labor and overhead allocation
CREATE TABLE IF NOT EXISTS costing_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  labor_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
  factory_overhead_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (factory_overhead_per_pair >= 0),
  electricity_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (electricity_per_pair >= 0),
  rent_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (rent_per_pair >= 0),
  miscellaneous_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (miscellaneous_per_pair >= 0),
  monthly_fixed_overhead NUMERIC NOT NULL DEFAULT 0 CHECK (monthly_fixed_overhead >= 0),
  monthly_capacity_pairs INTEGER NOT NULL DEFAULT 1 CHECK (monthly_capacity_pairs > 0),
  note TEXT NOT NULL DEFAULT ''
);

-- HR employee, attendance, and payroll foundation
CREATE TABLE IF NOT EXISTS hr_employees (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL CHECK (department IN ('Cutting', 'Stitching', 'Sole Press', 'Finishing', 'Packing', 'QC', 'Administration', 'Sales', 'Marketing', 'Dispatch')),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('Full Time', 'Part Time', 'Contract')),
  salary_type TEXT NOT NULL CHECK (salary_type IN ('Monthly', 'Daily', 'Piece Rate')),
  base_salary NUMERIC NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  daily_wage NUMERIC NOT NULL DEFAULT 0 CHECK (daily_wage >= 0),
  piece_rate NUMERIC NOT NULL DEFAULT 0 CHECK (piece_rate >= 0),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')),
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  fingerprint_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);

ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS fingerprint_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS hr_employees_department_idx ON hr_employees(department);
CREATE INDEX IF NOT EXISTS hr_employees_status_idx ON hr_employees(status);
CREATE INDEX IF NOT EXISTS hr_employees_fingerprint_id_idx ON hr_employees(fingerprint_id);

CREATE TABLE IF NOT EXISTS hr_attendance (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Half Day', 'Leave', 'Absent')),
  check_in TEXT NOT NULL DEFAULT '',
  check_out TEXT NOT NULL DEFAULT '',
  overtime_hours NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  note TEXT NOT NULL DEFAULT '',
  UNIQUE (employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS hr_attendance_work_date_idx ON hr_attendance(work_date DESC);
CREATE INDEX IF NOT EXISTS hr_attendance_employee_id_idx ON hr_attendance(employee_id);

CREATE TABLE IF NOT EXISTS hr_payroll (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_label TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  base_amount NUMERIC NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
  attendance_bonus NUMERIC NOT NULL DEFAULT 0 CHECK (attendance_bonus >= 0),
  piece_amount NUMERIC NOT NULL DEFAULT 0 CHECK (piece_amount >= 0),
  overtime_amount NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_amount >= 0),
  deduction NUMERIC NOT NULL DEFAULT 0 CHECK (deduction >= 0),
  net_pay NUMERIC NOT NULL DEFAULT 0 CHECK (net_pay >= 0),
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Approved', 'Paid', 'Locked')),
  paid_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT ''
);

ALTER TABLE hr_payroll
  DROP CONSTRAINT IF EXISTS hr_payroll_status_check;

ALTER TABLE hr_payroll
  ADD CONSTRAINT hr_payroll_status_check CHECK (status IN ('Draft', 'Approved', 'Paid', 'Locked'));

CREATE INDEX IF NOT EXISTS hr_payroll_period_label_idx ON hr_payroll(period_label);
CREATE INDEX IF NOT EXISTS hr_payroll_employee_id_idx ON hr_payroll(employee_id);
CREATE INDEX IF NOT EXISTS hr_payroll_status_idx ON hr_payroll(status);
-- Idempotency guard: one payroll per employee per month (period_label's first 7
-- chars are the YYYY-MM key), so concurrent submissions can't double-pay.
CREATE UNIQUE INDEX IF NOT EXISTS hr_payroll_employee_month_unique_idx
  ON hr_payroll(employee_id, substr(period_label, 1, 7));

-- Factory production and worker progress
CREATE TABLE IF NOT EXISTS production_batches (
  id TEXT PRIMARY KEY,
  design TEXT NOT NULL,
  planned_pairs INTEGER NOT NULL DEFAULT 0 CHECK (planned_pairs >= 0),
  finished_pairs INTEGER NOT NULL DEFAULT 0 CHECK (finished_pairs >= 0),
  in_progress_pairs INTEGER NOT NULL DEFAULT 0 CHECK (in_progress_pairs >= 0),
  rejected_pairs INTEGER NOT NULL DEFAULT 0 CHECK (rejected_pairs >= 0),
  raw_material_used TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('Planning', 'Cutting', 'Making', 'QC', 'Packed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_batches_status_idx ON production_batches(status);

CREATE TABLE IF NOT EXISTS material_consumptions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  batch_design TEXT NOT NULL,
  material_id TEXT REFERENCES raw_materials(id) ON DELETE SET NULL,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'meter', 'pair', 'piece', 'liter')),
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  wastage NUMERIC NOT NULL DEFAULT 0 CHECK (wastage >= 0),
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS material_consumptions_batch_id_idx ON material_consumptions(batch_id);
CREATE INDEX IF NOT EXISTS material_consumptions_material_id_idx ON material_consumptions(material_id);
CREATE INDEX IF NOT EXISTS material_consumptions_created_at_idx ON material_consumptions(created_at DESC);

CREATE TABLE IF NOT EXISTS worker_tasks (
  id TEXT PRIMARY KEY,
  worker_name TEXT NOT NULL,
  station TEXT NOT NULL CHECK (station IN ('Cutting', 'Stitching', 'Sole Press', 'Finishing', 'Packing', 'QC')),
  batch_id TEXT REFERENCES production_batches(id) ON DELETE SET NULL,
  design TEXT NOT NULL,
  target_pairs INTEGER NOT NULL DEFAULT 0 CHECK (target_pairs >= 0),
  completed_pairs INTEGER NOT NULL DEFAULT 0 CHECK (completed_pairs >= 0),
  status TEXT NOT NULL CHECK (status IN ('Not Started', 'In Progress', 'Paused', 'Done')),
  camera_zone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE worker_tasks
  ADD COLUMN IF NOT EXISTS batch_id TEXT REFERENCES production_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS worker_tasks_batch_id_idx ON worker_tasks(batch_id);
CREATE INDEX IF NOT EXISTS worker_tasks_station_idx ON worker_tasks(station);
CREATE INDEX IF NOT EXISTS worker_tasks_status_idx ON worker_tasks(status);

-- Finished goods stock and stock movement audit trail
CREATE TABLE IF NOT EXISTS finished_stock (
  id TEXT PRIMARY KEY,
  design TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('Factory', 'Wholesale', 'Retail', 'Online')),
  size_run TEXT NOT NULL DEFAULT 'Mixed',
  stock_pairs INTEGER NOT NULL DEFAULT 0 CHECK (stock_pairs >= 0),
  sold_pairs INTEGER NOT NULL DEFAULT 0 CHECK (sold_pairs >= 0),
  returned_pairs INTEGER NOT NULL DEFAULT 0 CHECK (returned_pairs >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (design, channel, size_run)
);

CREATE INDEX IF NOT EXISTS finished_stock_channel_idx ON finished_stock(channel);
CREATE INDEX IF NOT EXISTS finished_stock_design_idx ON finished_stock(design);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  design TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('Factory', 'Wholesale', 'Retail', 'Online')),
  size_run TEXT NOT NULL DEFAULT 'Mixed',
  type TEXT NOT NULL CHECK (type IN ('Production In', 'Purchase In', 'Dispatch Out', 'Return In', 'Sale Out', 'Market Sale', 'Adjustment')),
  pairs INTEGER NOT NULL DEFAULT 0 CHECK (pairs >= 0),
  note TEXT NOT NULL DEFAULT ''
);

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS size_run TEXT NOT NULL DEFAULT 'Mixed';

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_type_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN ('Production In', 'Purchase In', 'Dispatch Out', 'Return In', 'Sale Out', 'Market Sale', 'Adjustment'));

CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_design_channel_idx ON stock_movements(design, channel);

-- Vehicle dispatch, market return, and collection
CREATE TABLE IF NOT EXISTS vehicle_dispatches (
  id TEXT PRIMARY KEY,
  vehicle_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  market_route TEXT NOT NULL DEFAULT '',
  loaded_pairs INTEGER NOT NULL DEFAULT 0 CHECK (loaded_pairs >= 0),
  returned_pairs INTEGER NOT NULL DEFAULT 0 CHECK (returned_pairs >= 0),
  cash_collected NUMERIC NOT NULL DEFAULT 0 CHECK (cash_collected >= 0),
  cheque_collected NUMERIC NOT NULL DEFAULT 0 CHECK (cheque_collected >= 0),
  credit_amount NUMERIC NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('Loading', 'In Market', 'Returned', 'Closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_dispatches_status_idx ON vehicle_dispatches(status);
CREATE INDEX IF NOT EXISTS vehicle_dispatches_vehicle_number_idx ON vehicle_dispatches(vehicle_number);

CREATE TABLE IF NOT EXISTS vehicle_dispatch_items (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatch_id TEXT NOT NULL REFERENCES vehicle_dispatches(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  market_route TEXT NOT NULL DEFAULT '',
  design TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('Wholesale', 'Retail', 'Online')),
  size_run TEXT NOT NULL DEFAULT 'Mixed',
  loaded_pairs INTEGER NOT NULL DEFAULT 0 CHECK (loaded_pairs >= 0),
  sold_pairs INTEGER NOT NULL DEFAULT 0 CHECK (sold_pairs >= 0),
  returned_pairs INTEGER NOT NULL DEFAULT 0 CHECK (returned_pairs >= 0),
  cash_collected NUMERIC NOT NULL DEFAULT 0 CHECK (cash_collected >= 0),
  cheque_collected NUMERIC NOT NULL DEFAULT 0 CHECK (cheque_collected >= 0),
  credit_amount NUMERIC NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  stock_movement_ids TEXT[] NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT ''
);

ALTER TABLE vehicle_dispatch_items
  ADD COLUMN IF NOT EXISTS stock_movement_ids TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS vehicle_dispatch_items_dispatch_id_idx ON vehicle_dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS vehicle_dispatch_items_created_at_idx ON vehicle_dispatch_items(created_at DESC);
CREATE INDEX IF NOT EXISTS vehicle_dispatch_items_design_idx ON vehicle_dispatch_items(design);

-- Customer ledger and immutable transaction trail
CREATE TABLE IF NOT EXISTS customer_ledgers (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('Wholesale', 'Retail', 'Online')),
  phone TEXT NOT NULL DEFAULT '',
  cash_paid NUMERIC NOT NULL DEFAULT 0 CHECK (cash_paid >= 0),
  cheque_paid NUMERIC NOT NULL DEFAULT 0 CHECK (cheque_paid >= 0),
  credit_given NUMERIC NOT NULL DEFAULT 0 CHECK (credit_given >= 0),
  balance_due NUMERIC NOT NULL DEFAULT 0 CHECK (balance_due >= 0),
  credit_limit NUMERIC NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  last_transaction DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_ledgers_channel_idx ON customer_ledgers(channel);
CREATE INDEX IF NOT EXISTS customer_ledgers_balance_due_idx ON customer_ledgers(balance_due DESC);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ledger_id TEXT NOT NULL REFERENCES customer_ledgers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Cash Payment', 'Cheque Payment', 'Credit Sale', 'Return Adjustment', 'Manual Adjustment')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ledger_transactions_ledger_id_idx ON ledger_transactions(ledger_id);
CREATE INDEX IF NOT EXISTS ledger_transactions_created_at_idx ON ledger_transactions(created_at DESC);

-- POS billing, e-billing payloads, and retail/wholesale/online sale trail
CREATE TABLE IF NOT EXISTS pos_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL CHECK (channel IN ('Retail', 'Wholesale', 'Online')),
  kind TEXT NOT NULL CHECK (kind IN ('Sale', 'Return')),
  customer_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  cashier TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Cheque', 'Credit', 'QR', 'eSewa', 'Khalti', 'Bank')),
  payment_reference TEXT NOT NULL DEFAULT '',
  ledger_id TEXT REFERENCES customer_ledgers(id) ON DELETE SET NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount NUMERIC NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax NUMERIC NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
  paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  credit_amount NUMERIC NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Partial', 'Credit', 'Returned', 'Voided')),
  posting_status TEXT NOT NULL CHECK (posting_status IN ('Posted', 'Needs Review')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  stock_movement_ids TEXT[] NOT NULL DEFAULT '{}',
  ledger_transaction_id TEXT REFERENCES ledger_transactions(id) ON DELETE SET NULL,
  barcode_value TEXT NOT NULL DEFAULT '',
  qr_payload TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS pos_invoices_created_at_idx ON pos_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS pos_invoices_channel_idx ON pos_invoices(channel);
CREATE INDEX IF NOT EXISTS pos_invoices_status_idx ON pos_invoices(status);
CREATE INDEX IF NOT EXISTS pos_invoices_posting_status_idx ON pos_invoices(posting_status);
CREATE INDEX IF NOT EXISTS pos_invoices_ledger_id_idx ON pos_invoices(ledger_id);

-- Order payment transaction history and optional ledger linkage
CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded')),
  payment_provider TEXT NOT NULL CHECK (payment_provider IN ('manual', 'cod', 'esewa', 'khalti', 'bank', 'cash')),
  payment_reference TEXT NOT NULL DEFAULT '',
  payment_transaction_id TEXT NOT NULL DEFAULT '',
  payment_callback_id TEXT,
  ledger_id TEXT REFERENCES customer_ledgers(id) ON DELETE SET NULL,
  ledger_transaction_id TEXT REFERENCES ledger_transactions(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'gateway', 'system')),
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS payment_transactions_order_id_idx ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS payment_transactions_ledger_id_idx ON payment_transactions(ledger_id);
CREATE INDEX IF NOT EXISTS payment_transactions_created_at_idx ON payment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON payment_transactions(payment_status);
-- Idempotency guard: a gateway callback id may be recorded at most once, so
-- retried/concurrent identical callbacks can't create duplicate payment rows.
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_callback_id_unique_idx
  ON payment_transactions(payment_callback_id)
  WHERE payment_callback_id IS NOT NULL AND payment_callback_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_callback_id_unique_idx
  ON payment_transactions(payment_callback_id)
  WHERE payment_callback_id IS NOT NULL AND payment_callback_id <> '';

-- Uploaded product photos, kept in the database so the Upload button works
-- without any external object store to configure. A shoe shop's catalog is a
-- few dozen small photos; the bytes live here and are served by /api/images/:id.
-- If a Vercel Blob store is connected later, the upload route prefers it and
-- these rows simply stop growing.
CREATE TABLE IF NOT EXISTS uploaded_images (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  bytes BYTEA NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
