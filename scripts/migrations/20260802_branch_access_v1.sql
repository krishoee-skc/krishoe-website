-- KRISHOE branch isolation v1
-- Additive migration: existing business rows are assigned to the configured
-- default branch; no business row is deleted.

INSERT INTO company_branches (
  id, name, code, type, phone, address, status, created_at, updated_at
)
SELECT
  'branch-main', 'Main Branch', 'MAIN', 'Retail', '', '', 'Active', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM company_branches);

INSERT INTO company_settings (
  id, company_name, legal_name, currency, timezone, default_branch_id, updated_at
)
SELECT
  'default', 'KRISHOE', 'KRISHOE', 'NPR', 'Asia/Kathmandu',
  (SELECT id FROM company_branches ORDER BY (status = 'Active') DESC, created_at ASC LIMIT 1),
  now()
WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE id = 'default');

UPDATE company_settings
SET default_branch_id = (
  SELECT id
  FROM company_branches
  ORDER BY (status = 'Active') DESC, created_at ASC
  LIMIT 1
), updated_at = now()
WHERE id = 'default'
  AND NOT EXISTS (
    SELECT 1 FROM company_branches WHERE id = company_settings.default_branch_id
  );

CREATE OR REPLACE FUNCTION krishoe_admin_branch_context_enabled()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(current_setting('app.krishoe_branch_context', true), '') = 'true'
$$;

CREATE OR REPLACE FUNCTION krishoe_admin_branch_bypass_enabled()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(current_setting('app.krishoe_branch_bypass', true), '') = 'true'
$$;

CREATE OR REPLACE FUNCTION krishoe_effective_branch_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.krishoe_branch_id', true), ''),
    NULLIF((SELECT default_branch_id FROM company_settings WHERE id = 'default'), ''),
    (SELECT id FROM company_branches ORDER BY (status = 'Active') DESC, created_at ASC LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION krishoe_can_access_branch(target_branch_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT
    NOT krishoe_admin_branch_context_enabled()
    OR krishoe_admin_branch_bypass_enabled()
    OR target_branch_id = krishoe_effective_branch_id()
$$;

DO $$
DECLARE
  table_name TEXT;
  branch_tables TEXT[] := ARRAY[
    'orders',
    'order_items',
    'contact_messages',
    'raw_materials',
    'supplier_ledgers',
    'supplier_transactions',
    'purchase_invoices',
    'purchase_invoice_items',
    'hr_employees',
    'hr_attendance',
    'hr_payroll',
    'production_batches',
    'material_consumptions',
    'worker_tasks',
    'production_work_orders',
    'production_cctv_references',
    'production_material_consumptions',
    'production_stage_handovers',
    'production_work_entries',
    'worker_payments',
    'finished_stock',
    'stock_movements',
    'production_qc_postings',
    'vehicle_dispatches',
    'vehicle_dispatch_items',
    'customer_ledgers',
    'ledger_transactions',
    'pos_invoices',
    'payment_transactions',
    'factory_workers',
    'factory_daily_work',
    'factory_worker_ledger',
    'factory_weekly_advance',
    'factory_monthly_summary'
  ];
BEGIN
  FOREACH table_name IN ARRAY branch_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE EXCEPTION 'Required branch table % does not exist', table_name;
    END IF;

    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS branch_id TEXT', table_name);
    EXECUTE format(
      'UPDATE %I SET branch_id = krishoe_effective_branch_id() WHERE branch_id IS NULL OR branch_id = ''''',
      table_name
    );
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN branch_id SET DEFAULT krishoe_effective_branch_id()',
      table_name
    );
    EXECUTE format('ALTER TABLE %I ALTER COLUMN branch_id SET NOT NULL', table_name);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = table_name || '_branch_id_fkey'
        AND conrelid = to_regclass('public.' || table_name)
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (branch_id) REFERENCES company_branches(id) ON DELETE RESTRICT',
        table_name,
        table_name || '_branch_id_fkey'
      );
    END IF;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I(branch_id)',
      table_name || '_branch_id_idx',
      table_name
    );
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS krishoe_branch_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY krishoe_branch_isolation ON %I USING (krishoe_can_access_branch(branch_id)) WITH CHECK (krishoe_can_access_branch(branch_id))',
      table_name
    );
  END LOOP;
END
$$;

CREATE TABLE IF NOT EXISTS branch_product_stock (
  branch_id TEXT NOT NULL REFERENCES company_branches(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, product_id)
);

INSERT INTO branch_product_stock (branch_id, product_id, stock, updated_at)
SELECT krishoe_effective_branch_id(), id, GREATEST(0, stock), now()
FROM products
ON CONFLICT (branch_id, product_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS branch_product_stock_product_id_idx
  ON branch_product_stock(product_id);
ALTER TABLE branch_product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_product_stock FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS krishoe_branch_isolation ON branch_product_stock;
CREATE POLICY krishoe_branch_isolation ON branch_product_stock
  USING (krishoe_can_access_branch(branch_id))
  WITH CHECK (krishoe_can_access_branch(branch_id));
