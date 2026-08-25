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
-- every table dropped below was verified empty in production immediately before
-- the change, and the two columns dropped were NULL for every row.
--
-- DELIBERATELY NOT DROPPED: twelve empty tables of an abandoned second factory
-- schema (factory_production_entries, factory_stage_assignments and their kin).
-- Nothing in the app names them and they hold nothing, but removing them was
-- not asked for — so this only cuts the one thread that ties them to HR, and
-- they can be dealt with as their own decision.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The wage and production tables now point at factory_workers.
--
-- These five are the ones the app actually writes to. Until now they demanded
-- an hr_employees id, and the code supplies a factory_workers id.
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
-- 2. The abandoned schema's ties to HR, cut but not repointed.
--
-- These five tables are empty and unreachable from the app. Their worker
-- columns are left in place, pointing at nothing, because inventing a
-- relationship for a table nobody uses would be a guess. Cutting the tie is
-- what lets hr_employees go.
-- ---------------------------------------------------------------------------

ALTER TABLE factory_production_entries
  DROP CONSTRAINT IF EXISTS factory_production_entries_worker_id_fkey,
  DROP CONSTRAINT IF EXISTS factory_production_entries_responsible_worker_id_fkey;
ALTER TABLE factory_stage_assignments
  DROP CONSTRAINT IF EXISTS factory_stage_assignments_worker_id_fkey;
ALTER TABLE factory_stage_handovers
  DROP CONSTRAINT IF EXISTS factory_stage_handovers_from_worker_id_fkey,
  DROP CONSTRAINT IF EXISTS factory_stage_handovers_to_worker_id_fkey;
ALTER TABLE factory_wage_settlements
  DROP CONSTRAINT IF EXISTS factory_wage_settlements_worker_id_fkey;

-- ---------------------------------------------------------------------------
-- 3. The two link columns nobody ever filled in.
--
-- factory_workers.hr_employee_id was NULL for all eight workers, and
-- admin_staff_accounts.employee_id for all six staff. A login is tied to a
-- person by factory_worker_id, which stays.
-- ---------------------------------------------------------------------------

ALTER TABLE factory_workers DROP COLUMN IF EXISTS hr_employee_id;
ALTER TABLE admin_staff_accounts DROP COLUMN IF EXISTS employee_id;

-- ---------------------------------------------------------------------------
-- 4. The tables themselves.
--
-- factory_worker_links existed only to marry the two worker lists; with one
-- list there is nothing to marry. The vehicle dispatch pair was never used —
-- no dispatch has ever been recorded. playing_with_neon is a sample table the
-- database provider left behind that no query in this app has ever named.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS factory_worker_links;
DROP TABLE IF EXISTS vehicle_dispatch_items;
DROP TABLE IF EXISTS vehicle_dispatches;
DROP TABLE IF EXISTS playing_with_neon;

DROP TABLE IF EXISTS hr_payroll;
DROP TABLE IF EXISTS hr_attendance;
DROP TABLE IF EXISTS hr_employees;

COMMIT;
