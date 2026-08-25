-- Take the HR module out, and point the wage tables at the real worker list.
--
-- hr_employees, hr_attendance and hr_payroll never held a single row. Sixteen
-- tables carried a foreign key into hr_employees anyway, including the ones the
-- production screens write a worker into — so those screens could never save:
-- every "who did this work" lookup came back empty and refused.
--
-- factory_workers is where this shop's people actually are. Every reference
-- moves there, which both removes the dead module and makes those forms work.
--
-- Safe to run twice. Nothing here deletes a row that has ever been written:
-- every table dropped below was verified empty in production first, and the two
-- columns dropped were NULL for every row.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The wage and production tables now point at factory_workers.
-- ---------------------------------------------------------------------------

ALTER TABLE production_work_entries
  DROP CONSTRAINT IF EXISTS production_work_entries_employee_id_fkey;
ALTER TABLE production_work_entries
  ADD CONSTRAINT production_work_entries_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES factory_workers(id) ON DELETE RESTRICT;

ALTER TABLE production_worker_stage_rates
  DROP CONSTRAINT IF EXISTS production_worker_stage_rates_employee_id_fkey;
ALTER TABLE production_worker_stage_rates
  ADD CONSTRAINT production_worker_stage_rates_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES factory_workers(id) ON DELETE RESTRICT;

ALTER TABLE production_stage_handovers
  DROP CONSTRAINT IF EXISTS production_stage_handovers_from_employee_id_fkey;
ALTER TABLE production_stage_handovers
  DROP CONSTRAINT IF EXISTS production_stage_handovers_to_employee_id_fkey;
ALTER TABLE production_stage_handovers
  ADD CONSTRAINT production_stage_handovers_from_employee_id_fkey
  FOREIGN KEY (from_employee_id) REFERENCES factory_workers(id) ON DELETE SET NULL;
ALTER TABLE production_stage_handovers
  ADD CONSTRAINT production_stage_handovers_to_employee_id_fkey
  FOREIGN KEY (to_employee_id) REFERENCES factory_workers(id) ON DELETE SET NULL;

ALTER TABLE production_qc_postings
  DROP CONSTRAINT IF EXISTS production_qc_postings_packing_employee_id_fkey;
ALTER TABLE production_qc_postings
  ADD CONSTRAINT production_qc_postings_packing_employee_id_fkey
  FOREIGN KEY (packing_employee_id) REFERENCES factory_workers(id) ON DELETE SET NULL;

ALTER TABLE worker_payments
  DROP CONSTRAINT IF EXISTS worker_payments_employee_id_fkey;
ALTER TABLE worker_payments
  ADD CONSTRAINT worker_payments_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES factory_workers(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 2. The two link columns nobody ever filled in.
--
-- factory_workers.hr_employee_id was NULL for all eight workers, and
-- admin_staff_accounts.employee_id for all six staff. A login is tied to a
-- person by factory_worker_id, which stays.
-- ---------------------------------------------------------------------------

ALTER TABLE factory_workers DROP COLUMN IF EXISTS hr_employee_id;
ALTER TABLE admin_staff_accounts DROP COLUMN IF EXISTS employee_id;

-- ---------------------------------------------------------------------------
-- 3. The tables themselves.
--
-- factory_worker_links existed only to marry the two worker lists; with one
-- list there is nothing to marry. The vehicle dispatch pair was never used —
-- no dispatch has ever been recorded. playing_with_neon is a sample table the
-- database provider left behind and no query in this app has ever touched.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS factory_worker_links;
DROP TABLE IF EXISTS vehicle_dispatch_items;
DROP TABLE IF EXISTS vehicle_dispatches;
DROP TABLE IF EXISTS playing_with_neon;

-- These five belong to an abandoned second factory schema: no query in the app
-- names any of them, and all five are empty. They are dropped here only because
-- their foreign keys hold hr_employees down.
DROP TABLE IF EXISTS factory_wage_settlement_entries;
DROP TABLE IF EXISTS factory_wage_settlements;
DROP TABLE IF EXISTS factory_stage_handover_sizes;
DROP TABLE IF EXISTS factory_stage_handovers;
DROP TABLE IF EXISTS factory_stage_assignments;
DROP TABLE IF EXISTS factory_production_entry_sizes;
DROP TABLE IF EXISTS factory_production_entries;

DROP TABLE IF EXISTS hr_payroll;
DROP TABLE IF EXISTS hr_attendance;
DROP TABLE IF EXISTS hr_employees;

COMMIT;
