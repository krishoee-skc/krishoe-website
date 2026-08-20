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
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  password_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx ON users(lower(email));

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_email_idx ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS email_verification_tokens_email_idx ON email_verification_tokens(email);
CREATE INDEX IF NOT EXISTS email_verification_tokens_expires_at_idx ON email_verification_tokens(expires_at);

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
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Manager', 'Accountant', 'HR', 'Inventory', 'Sales', 'Factory', 'Viewer', 'Worker')),
  branch_id TEXT NOT NULL REFERENCES company_branches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('Invited', 'Active', 'Locked', 'Disabled')),
  password_hash TEXT NOT NULL,
  employee_id TEXT,
  -- Set for a Worker sign-in: the factory worker whose pairs and wages the
  -- portal shows. Separate from employee_id, which points at hr_employees.
  factory_worker_id TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  password_changed_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  last_failed_login_at TIMESTAMPTZ,
  last_login_ip TEXT NOT NULL DEFAULT '',
  last_login_user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_staff_accounts_email_lower_unique_idx
  ON admin_staff_accounts(lower(email));
CREATE INDEX IF NOT EXISTS admin_staff_accounts_role_idx ON admin_staff_accounts(role);
CREATE INDEX IF NOT EXISTS admin_staff_accounts_branch_id_idx ON admin_staff_accounts(branch_id);
CREATE INDEX IF NOT EXISTS admin_staff_accounts_status_idx ON admin_staff_accounts(status);

CREATE TABLE IF NOT EXISTS admin_staff_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id TEXT NOT NULL REFERENCES admin_staff_accounts(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('invitation', 'password_reset', 'mfa_login')),
  token_hash TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_staff_sessions (
  id UUID PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES admin_staff_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  device_label TEXT NOT NULL DEFAULT '',
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS admin_staff_access_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id TEXT NOT NULL REFERENCES admin_staff_accounts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL CHECK (type IN ('order', 'contact', 'password-reset', 'email-verification', 'operational-alert')),
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
  CHECK (type IN ('order', 'contact', 'password-reset', 'email-verification', 'operational-alert'));

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

ALTER TABLE hr_employees
  DROP CONSTRAINT IF EXISTS hr_employees_department_check;

ALTER TABLE hr_employees
  ADD CONSTRAINT hr_employees_department_check CHECK (
    department IN (
      'Upper', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final',
      'Cutting', 'Stitching', 'Sole Press', 'Finishing', 'Packing', 'QC',
      'Administration', 'Sales', 'Marketing', 'Dispatch'
    )
  );

CREATE INDEX IF NOT EXISTS hr_employees_department_idx ON hr_employees(department);
CREATE INDEX IF NOT EXISTS hr_employees_status_idx ON hr_employees(status);
CREATE INDEX IF NOT EXISTS hr_employees_fingerprint_id_idx ON hr_employees(fingerprint_id);

ALTER TABLE admin_staff_accounts
  DROP CONSTRAINT IF EXISTS admin_staff_accounts_employee_id_fkey;
ALTER TABLE admin_staff_accounts
  ADD CONSTRAINT admin_staff_accounts_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_staff_accounts_employee_unique_idx
  ON admin_staff_accounts(employee_id)
  WHERE employee_id IS NOT NULL;

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

-- Production accounting foundation. These tables stay beside the legacy
-- production tables so existing history and commercial modules are untouched.
CREATE TABLE IF NOT EXISTS production_items (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  production_type TEXT NOT NULL CHECK (production_type IN ('Manufactured', 'Resale', 'Mixed')),
  size_group TEXT NOT NULL CHECK (size_group IN ('Baby', 'Kids', 'Ladies', 'Gents', 'Mixed')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  note TEXT NOT NULL DEFAULT ''
);

ALTER TABLE production_items
  ADD COLUMN IF NOT EXISTS catalog_product_id TEXT REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS production_items_status_idx ON production_items(status);
CREATE INDEX IF NOT EXISTS production_items_category_idx ON production_items(category);
CREATE INDEX IF NOT EXISTS production_items_catalog_product_idx ON production_items(catalog_product_id);

CREATE TABLE IF NOT EXISTS production_stage_rates (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  item_id TEXT NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('Upper', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final')),
  rate_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (rate_per_pair >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  note TEXT NOT NULL DEFAULT '',
  UNIQUE (item_id, stage, effective_from)
);

CREATE INDEX IF NOT EXISTS production_stage_rates_item_idx
  ON production_stage_rates(item_id, stage, effective_from DESC);

CREATE TABLE IF NOT EXISTS production_worker_stage_rates (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE RESTRICT,
  employee_name_snapshot TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('Upper', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final')),
  rate_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (rate_per_pair >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  note TEXT NOT NULL DEFAULT '',
  UNIQUE (employee_id, item_id, stage, effective_from)
);

CREATE INDEX IF NOT EXISTS production_worker_stage_rates_lookup_idx
  ON production_worker_stage_rates(employee_id, item_id, stage, effective_from DESC);

CREATE TABLE IF NOT EXISTS production_item_materials (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  item_id TEXT NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  material_name_snapshot TEXT NOT NULL,
  unit_snapshot TEXT NOT NULL,
  quantity_per_pair NUMERIC NOT NULL CHECK (quantity_per_pair > 0),
  wastage_percent NUMERIC NOT NULL DEFAULT 0 CHECK (wastage_percent >= 0),
  note TEXT NOT NULL DEFAULT '',
  UNIQUE (item_id, material_id)
);

CREATE INDEX IF NOT EXISTS production_item_materials_item_idx ON production_item_materials(item_id);

CREATE TABLE IF NOT EXISTS production_cost_cards (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  item_id TEXT NOT NULL REFERENCES production_items(id) ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  material_cost_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (material_cost_per_pair >= 0),
  labor_cost_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (labor_cost_per_pair >= 0),
  other_direct_cost_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (other_direct_cost_per_pair >= 0),
  making_cost_per_pair NUMERIC NOT NULL DEFAULT 0 CHECK (making_cost_per_pair >= 0),
  wholesale_profit_percent NUMERIC NOT NULL DEFAULT 0 CHECK (wholesale_profit_percent >= 0),
  wholesale_price NUMERIC NOT NULL DEFAULT 0 CHECK (wholesale_price >= 0),
  retail_extra_amount NUMERIC NOT NULL DEFAULT 0 CHECK (retail_extra_amount >= 0),
  retail_price NUMERIC NOT NULL DEFAULT 0 CHECK (retail_price >= 0),
  approved_by TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS production_cost_cards_item_idx
  ON production_cost_cards(item_id, effective_from DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS production_work_orders (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  work_order_number TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL REFERENCES production_items(id) ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  colour TEXT NOT NULL DEFAULT '',
  size_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  planned_pairs INTEGER NOT NULL CHECK (planned_pairs > 0),
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'High', 'Urgent')),
  current_stage TEXT NOT NULL DEFAULT 'Upper' CHECK (
    current_stage IN ('Upper', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC')
  ),
  status TEXT NOT NULL DEFAULT 'Planning' CHECK (
    status IN ('Planning', 'In Progress', 'Ready for QC', 'Completed', 'Cancelled')
  ),
  created_by TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS production_work_orders_status_idx
  ON production_work_orders(status, due_date);
CREATE INDEX IF NOT EXISTS production_work_orders_item_idx
  ON production_work_orders(item_id, created_at DESC);

ALTER TABLE production_work_orders
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE production_work_orders
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS production_cctv_references (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  work_order_id TEXT NOT NULL REFERENCES production_work_orders(id) ON DELETE RESTRICT,
  work_order_number_snapshot TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (
    stage IN ('Upper', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC')
  ),
  camera_zone TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  cctv_reference TEXT NOT NULL DEFAULT '',
  evidence_reference TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  CHECK (window_end >= window_start)
);

CREATE INDEX IF NOT EXISTS production_cctv_references_order_idx
  ON production_cctv_references(work_order_id, window_start DESC);

CREATE TABLE IF NOT EXISTS production_material_consumptions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumption_date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_order_id TEXT NOT NULL REFERENCES production_work_orders(id) ON DELETE RESTRICT,
  work_order_number_snapshot TEXT NOT NULL,
  material_id TEXT NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  material_name_snapshot TEXT NOT NULL,
  unit_snapshot TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  wastage NUMERIC NOT NULL DEFAULT 0 CHECK (wastage >= 0),
  approved_by TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT NOT NULL DEFAULT '',
  CONSTRAINT production_material_consumption_total_check CHECK (quantity + wastage > 0)
);

CREATE INDEX IF NOT EXISTS production_material_consumptions_order_idx
  ON production_material_consumptions(work_order_id, consumption_date DESC);
CREATE INDEX IF NOT EXISTS production_material_consumptions_material_idx
  ON production_material_consumptions(material_id, consumption_date DESC);

CREATE TABLE IF NOT EXISTS production_stage_handovers (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_order_id TEXT NOT NULL REFERENCES production_work_orders(id) ON DELETE RESTRICT,
  work_order_number_snapshot TEXT NOT NULL,
  from_stage TEXT NOT NULL CHECK (
    from_stage IN ('Upper', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final')
  ),
  to_stage TEXT NOT NULL CHECK (
    to_stage IN ('Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC')
  ),
  from_employee_id TEXT REFERENCES hr_employees(id) ON DELETE SET NULL,
  from_employee_name_snapshot TEXT NOT NULL DEFAULT '',
  to_employee_id TEXT REFERENCES hr_employees(id) ON DELETE SET NULL,
  to_employee_name_snapshot TEXT NOT NULL DEFAULT '',
  sent_pairs INTEGER NOT NULL CHECK (sent_pairs > 0),
  received_pairs INTEGER NOT NULL CHECK (received_pairs >= 0),
  approved_by TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

ALTER TABLE production_stage_handovers
  ADD COLUMN IF NOT EXISTS received_size_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE production_stage_handovers
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE production_stage_handovers
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS production_stage_handovers_order_idx
  ON production_stage_handovers(work_order_id, handover_date DESC);

CREATE TABLE IF NOT EXISTS production_work_entries (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE RESTRICT,
  employee_name_snapshot TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES production_items(id) ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('Upper', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final')),
  total_pairs INTEGER NOT NULL CHECK (total_pairs > 0),
  size_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejected_pairs INTEGER NOT NULL DEFAULT 0 CHECK (rejected_pairs >= 0),
  rework_pairs INTEGER NOT NULL DEFAULT 0 CHECK (rework_pairs >= 0),
  rate_per_pair_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (rate_per_pair_snapshot >= 0),
  earned_wage NUMERIC NOT NULL DEFAULT 0 CHECK (earned_wage >= 0),
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Approved', 'Reversed')),
  approved_by TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  CONSTRAINT production_work_entry_quantity_check
    CHECK (rejected_pairs + rework_pairs <= total_pairs)
);

ALTER TABLE production_work_entries
  ADD COLUMN IF NOT EXISTS work_order_id TEXT REFERENCES production_work_orders(id) ON DELETE RESTRICT;
ALTER TABLE production_work_entries
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE production_work_entries
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS production_work_entries_employee_idx
  ON production_work_entries(employee_id, work_date DESC);

ALTER TABLE production_work_entries
  ADD COLUMN IF NOT EXISTS source_submission_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS production_work_entries_submission_key_idx
  ON production_work_entries(source_submission_key)
  WHERE source_submission_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS production_work_entries_item_idx
  ON production_work_entries(item_id, work_date DESC);
CREATE INDEX IF NOT EXISTS production_work_entries_status_idx
  ON production_work_entries(status, work_date DESC);
CREATE INDEX IF NOT EXISTS production_work_entries_work_order_idx
  ON production_work_entries(work_order_id, stage, work_date DESC);

CREATE TABLE IF NOT EXISTS worker_payments (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE RESTRICT,
  employee_name_snapshot TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (
    payment_type IN ('Saturday Kharcha', 'Midweek Advance', 'Final Settlement', 'Bonus', 'Deduction', 'Correction')
  ),
  direction TEXT NOT NULL CHECK (direction IN ('Paid', 'Added', 'Recovered')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash')),
  receipt_number TEXT NOT NULL UNIQUE,
  approved_by TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT NOT NULL DEFAULT '',
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS worker_payments_employee_idx
  ON worker_payments(employee_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS worker_payments_date_idx
  ON worker_payments(payment_date DESC);

ALTER TABLE worker_payments
  ADD COLUMN IF NOT EXISTS source_submission_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS worker_payments_submission_key_idx
  ON worker_payments(source_submission_key)
  WHERE source_submission_key IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS production_qc_postings (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qc_date DATE NOT NULL DEFAULT CURRENT_DATE,
  approval_reference TEXT NOT NULL UNIQUE,
  work_order_id TEXT REFERENCES production_work_orders(id) ON DELETE RESTRICT,
  item_id TEXT NOT NULL REFERENCES production_items(id) ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  catalog_product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  catalog_product_name_snapshot TEXT NOT NULL,
  packing_employee_id TEXT REFERENCES hr_employees(id) ON DELETE SET NULL,
  packing_employee_name_snapshot TEXT NOT NULL DEFAULT '',
  total_pairs INTEGER NOT NULL CHECK (total_pairs > 0),
  rejected_pairs INTEGER NOT NULL DEFAULT 0 CHECK (rejected_pairs >= 0),
  size_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  stock_movement_id TEXT NOT NULL REFERENCES stock_movements(id) ON DELETE RESTRICT,
  stock_posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

ALTER TABLE production_qc_postings
  ADD COLUMN IF NOT EXISTS work_order_id TEXT REFERENCES production_work_orders(id) ON DELETE RESTRICT;
ALTER TABLE production_qc_postings
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE production_qc_postings
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE production_qc_postings
  ADD COLUMN IF NOT EXISTS reversal_stock_movement_id TEXT REFERENCES stock_movements(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS production_qc_postings_item_idx
  ON production_qc_postings(item_id, qc_date DESC);
CREATE INDEX IF NOT EXISTS production_qc_postings_catalog_idx
  ON production_qc_postings(catalog_product_id, qc_date DESC);

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

-- Simplified Factory mobile-entry compatibility module. These tables keep
-- their own records until the Factory UI is fully consolidated with the
-- production-accounting chain above. Money uses NUMERIC so fractional rupee
-- rates are never rounded, and historical work/ledger links are restricted
-- from cascading deletes.
CREATE TABLE IF NOT EXISTS factory_workers (
  id TEXT PRIMARY KEY,
  hr_employee_id TEXT UNIQUE REFERENCES hr_employees(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  worker_type TEXT NOT NULL,
  category TEXT NOT NULL,
  monthly_salary NUMERIC(12, 2) CHECK (monthly_salary IS NULL OR monthly_salary >= 0),
  weekly_advance NUMERIC(12, 2) CHECK (weekly_advance IS NULL OR weekly_advance >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_workers_type_check
    CHECK (worker_type IN ('piece_rate', 'monthly_staff', 'daily_staff')),
  CONSTRAINT factory_workers_category_check
    CHECK (category IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff')),
  CONSTRAINT factory_workers_status_check
    CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS factory_items (
  id TEXT PRIMARY KEY,
  production_item_id TEXT UNIQUE REFERENCES production_items(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_items_status_check
    CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS factory_rates (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES factory_items(id) ON DELETE RESTRICT,
  worker_category TEXT NOT NULL,
  rate_per_pair NUMERIC(12, 2) NOT NULL CHECK (rate_per_pair > 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_rates_item_category_date_key
    UNIQUE (item_id, worker_category, effective_date)
);

CREATE TABLE IF NOT EXISTS factory_daily_work (
  id TEXT PRIMARY KEY,
  submission_key TEXT,
  date DATE NOT NULL,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE RESTRICT,
  item_id TEXT NOT NULL REFERENCES factory_items(id) ON DELETE RESTRICT,
  color TEXT,
  size TEXT,
  pairs_count INTEGER NOT NULL CHECK (pairs_count > 0),
  status TEXT NOT NULL DEFAULT 'completed',
  rate_applied NUMERIC(12, 2) NOT NULL CHECK (rate_applied > 0),
  amount_earned NUMERIC(12, 2) NOT NULL CHECK (amount_earned > 0),
  work_order_id TEXT REFERENCES production_work_orders(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_daily_work_status_check
    CHECK (status IN ('in_progress', 'completed', 'rework'))
);

CREATE TABLE IF NOT EXISTS factory_worker_ledger (
  id TEXT PRIMARY KEY,
  submission_key TEXT,
  source_work_id TEXT UNIQUE REFERENCES factory_daily_work(id) ON DELETE RESTRICT,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  entry_type TEXT NOT NULL,
  work_pairs INTEGER CHECK (work_pairs IS NULL OR work_pairs >= 0),
  amount_earned NUMERIC(12, 2) CHECK (amount_earned IS NULL OR amount_earned >= 0),
  payment_given NUMERIC(12, 2) CHECK (payment_given IS NULL OR payment_given >= 0),
  running_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  -- Staff salary payments can be made later but still belong to the selected
  -- salary month. Piece-rate ledger rows leave this NULL.
  salary_period_month DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_worker_ledger_type_check
    CHECK (entry_type IN ('work', 'payment', 'adjustment')),
  CONSTRAINT factory_worker_ledger_status_check
    CHECK (status IN ('pending', 'settled', 'reversed')),
  CONSTRAINT factory_worker_ledger_salary_period_check
    CHECK (salary_period_month IS NULL OR salary_period_month = date_trunc('month', salary_period_month)::date)
);

CREATE TABLE IF NOT EXISTS factory_weekly_advance (
  id TEXT PRIMARY KEY,
  submission_key TEXT,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE RESTRICT,
  week_of_date DATE NOT NULL,
  advance_amount NUMERIC(12, 2) NOT NULL CHECK (advance_amount > 0),
  date_given DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  salary_period_month DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_weekly_advance_salary_period_check
    CHECK (salary_period_month = date_trunc('month', salary_period_month)::date)
);

CREATE TABLE IF NOT EXISTS factory_monthly_summary (
  id TEXT PRIMARY KEY,
  month DATE NOT NULL,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE RESTRICT,
  total_pairs INTEGER NOT NULL DEFAULT 0 CHECK (total_pairs >= 0),
  total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
  final_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_monthly_summary_month_worker_key UNIQUE (month, worker_id),
  CONSTRAINT factory_monthly_summary_month_check
    CHECK (month = date_trunc('month', month)::date),
  CONSTRAINT factory_monthly_summary_status_check
    CHECK (status IN ('draft', 'locked'))
);

-- Columns below also make applying the canonical schema safe when an older
-- standalone Factory schema already created these tables.
ALTER TABLE factory_workers
  ADD COLUMN IF NOT EXISTS hr_employee_id TEXT REFERENCES hr_employees(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_items
  ADD COLUMN IF NOT EXISTS production_item_id TEXT REFERENCES production_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_daily_work
  ADD COLUMN IF NOT EXISTS submission_key TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_worker_ledger
  ADD COLUMN IF NOT EXISTS submission_key TEXT,
  ADD COLUMN IF NOT EXISTS source_work_id TEXT REFERENCES factory_daily_work(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS salary_period_month DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_weekly_advance
  ADD COLUMN IF NOT EXISTS submission_key TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS salary_period_month DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE factory_monthly_summary
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS factory_workers_status_idx ON factory_workers(status);
CREATE INDEX IF NOT EXISTS factory_workers_type_idx ON factory_workers(worker_type);
CREATE INDEX IF NOT EXISTS factory_items_status_idx ON factory_items(status);
CREATE INDEX IF NOT EXISTS factory_rates_lookup_idx
  ON factory_rates(item_id, worker_category, effective_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS factory_daily_work_worker_date_idx
  ON factory_daily_work(worker_id, date DESC);
CREATE INDEX IF NOT EXISTS factory_daily_work_item_idx ON factory_daily_work(item_id);
CREATE INDEX IF NOT EXISTS factory_daily_work_order_idx ON factory_daily_work(work_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS factory_daily_work_submission_key_idx
  ON factory_daily_work(submission_key)
  WHERE submission_key IS NOT NULL AND submission_key <> '';
CREATE INDEX IF NOT EXISTS factory_worker_ledger_worker_date_idx
  ON factory_worker_ledger(worker_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS factory_worker_ledger_status_idx ON factory_worker_ledger(status);
CREATE INDEX IF NOT EXISTS factory_worker_ledger_salary_period_idx
  ON factory_worker_ledger(worker_id, salary_period_month DESC)
  WHERE salary_period_month IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS factory_worker_ledger_submission_key_idx
  ON factory_worker_ledger(submission_key)
  WHERE submission_key IS NOT NULL AND submission_key <> '';
CREATE UNIQUE INDEX IF NOT EXISTS factory_worker_ledger_source_work_idx
  ON factory_worker_ledger(source_work_id)
  WHERE source_work_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS factory_weekly_advance_worker_week_idx
  ON factory_weekly_advance(worker_id, week_of_date DESC);
CREATE INDEX IF NOT EXISTS factory_weekly_advance_salary_period_idx
  ON factory_weekly_advance(worker_id, salary_period_month DESC);
CREATE UNIQUE INDEX IF NOT EXISTS factory_weekly_advance_submission_key_idx
  ON factory_weekly_advance(submission_key)
  WHERE submission_key IS NOT NULL AND submission_key <> '';
CREATE INDEX IF NOT EXISTS factory_monthly_summary_worker_month_idx
  ON factory_monthly_summary(worker_id, month DESC);

-- SMS Notifications log and audit trail
CREATE TABLE IF NOT EXISTS sms_messages (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  phone_number TEXT NOT NULL,
  message_text TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('customer', 'worker', 'admin')),
  event_type TEXT NOT NULL DEFAULT 'generic',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  worker_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_retry_at TIMESTAMPTZ,
  error_message TEXT NOT NULL DEFAULT ''
);

ALTER TABLE sms_messages
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS sms_messages_created_at_idx ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS sms_messages_phone_idx ON sms_messages(phone_number);
CREATE INDEX IF NOT EXISTS sms_messages_status_idx ON sms_messages(status);
CREATE INDEX IF NOT EXISTS sms_messages_message_type_idx ON sms_messages(message_type);
CREATE INDEX IF NOT EXISTS sms_messages_event_type_idx ON sms_messages(event_type);
CREATE INDEX IF NOT EXISTS sms_messages_order_id_idx ON sms_messages(order_id);
CREATE INDEX IF NOT EXISTS sms_messages_worker_id_idx ON sms_messages(worker_id);

-- Admin Alert Center
CREATE TABLE IF NOT EXISTS admin_alerts (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('manual_payment', 'low_stock', 'quality_issue', 'attendance_alert', 'payroll_ready', 'system_alert')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🔔',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  action_label TEXT,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_alerts_created_at_idx ON admin_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_alerts_is_read_idx ON admin_alerts(is_read);
CREATE INDEX IF NOT EXISTS admin_alerts_alert_type_idx ON admin_alerts(alert_type);
CREATE INDEX IF NOT EXISTS admin_alerts_severity_idx ON admin_alerts(severity);
CREATE INDEX IF NOT EXISTS admin_alerts_expires_at_idx ON admin_alerts(expires_at)
  WHERE expires_at IS NOT NULL;

-- Production Monitoring Tables
CREATE TABLE IF NOT EXISTS monitoring_errors (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  level TEXT NOT NULL CHECK (level IN ('error', 'warning', 'info')),
  message TEXT NOT NULL,
  -- The message with its ids, amounts and timestamps masked out, so one fault
  -- is a single row in the summary rather than one row per occurrence. See
  -- lib/error-fingerprint.ts.
  fingerprint TEXT,
  stack TEXT,
  context TEXT,
  user_id TEXT,
  path TEXT,
  method TEXT,
  status_code INTEGER
);

CREATE TABLE IF NOT EXISTS monitoring_performance (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  duration INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  db_time INTEGER,
  render_time INTEGER,
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS monitoring_uptime (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('up', 'down')),
  response_time INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  region TEXT NOT NULL DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS monitoring_errors_created_at_idx ON monitoring_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS monitoring_errors_level_idx ON monitoring_errors(level);
CREATE INDEX IF NOT EXISTS monitoring_errors_fingerprint_idx ON monitoring_errors(fingerprint);
CREATE INDEX IF NOT EXISTS monitoring_performance_created_at_idx ON monitoring_performance(created_at DESC);
CREATE INDEX IF NOT EXISTS monitoring_performance_path_idx ON monitoring_performance(path);
CREATE INDEX IF NOT EXISTS monitoring_uptime_checked_at_idx ON monitoring_uptime(checked_at DESC);

-- Auto-cleanup old monitoring data (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data()
RETURNS void AS $$
BEGIN
  DELETE FROM monitoring_errors WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM monitoring_performance WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM monitoring_uptime WHERE checked_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
