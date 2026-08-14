-- Link a staff account straight to the factory worker it belongs to.
--
-- The worker portal previously resolved a signed-in worker through
-- employee_id into hr_employees, but the factory's real production and wages
-- live in the factory_* tables and the HR module is unused. That left the
-- portal reading an empty module while the work sat beside it.
--
-- A separate column rather than reusing employee_id, because the two point at
-- different tables and a worker may exist in one without the other.
--
-- ON DELETE RESTRICT matches the other factory foreign keys: removing a worker
-- who still has a sign-in should be a deliberate act, not a silent cascade.

ALTER TABLE admin_staff_accounts
  ADD COLUMN IF NOT EXISTS factory_worker_id TEXT
    REFERENCES factory_workers(id) ON DELETE RESTRICT;

-- One sign-in per worker. Two staff accounts pointing at the same worker would
-- show the same wages to two people with no way to tell which is genuine.
CREATE UNIQUE INDEX IF NOT EXISTS admin_staff_accounts_factory_worker_unique_idx
  ON admin_staff_accounts(factory_worker_id)
  WHERE factory_worker_id IS NOT NULL;
