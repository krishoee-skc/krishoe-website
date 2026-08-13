ALTER TABLE admin_staff_accounts
  DROP CONSTRAINT IF EXISTS admin_staff_accounts_role_check;

ALTER TABLE admin_staff_accounts
  ADD CONSTRAINT admin_staff_accounts_role_check
    CHECK (role IN ('Owner', 'Manager', 'Accountant', 'HR', 'Inventory', 'Sales', 'Factory', 'Viewer', 'Worker'));
