-- The shop's own stage names, in the tables that had not been told.
--
-- The owner tried to record sixty pairs of fiber work and the database refused
-- it: "it breaks the rule production_work_entries_stage_check". They had done
-- nothing wrong. The screen offers the five stages this shop actually works in
-- — Upper, Fibermen, Fiber Silai, Packing / QC, Staff — but that constraint
-- still listed the four it was written with, including two the shop never
-- used: Fiber Preparation and Bottom Final.
--
-- Seven of the eleven factory workers are filed as Fibermen, and not one of
-- their entries had ever gone in. The wages of the largest group in the
-- workshop could not be recorded at all, and the only way to find that out was
-- to try.
--
-- Where it came from: factory_workers and factory_rates were widened when
-- Fibermen was introduced, and the production_* tables were not. Two lists of
-- the same thing, one updated, one forgotten.
--
-- This widens the seven that were missed. Nothing is removed: 'Fiber
-- Preparation' and 'Bottom Final' stay allowed, so no existing row can be
-- orphaned, and the eight rate rows and seven work entries already stored
-- (all 'Upper') are untouched. Additive and re-runnable — each constraint is
-- dropped by name and recreated, so running this twice leaves the same result.

-- Piece rates per stage.
ALTER TABLE production_stage_rates DROP CONSTRAINT IF EXISTS production_stage_rates_stage_check;
ALTER TABLE production_stage_rates ADD CONSTRAINT production_stage_rates_stage_check
  CHECK (stage IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff'));

-- A rate set for one worker at one stage.
ALTER TABLE production_worker_stage_rates DROP CONSTRAINT IF EXISTS production_worker_stage_rates_stage_check;
ALTER TABLE production_worker_stage_rates ADD CONSTRAINT production_worker_stage_rates_stage_check
  CHECK (stage IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff'));

-- The work entry itself — the one that refused the owner's sixty pairs.
ALTER TABLE production_work_entries DROP CONSTRAINT IF EXISTS production_work_entries_stage_check;
ALTER TABLE production_work_entries ADD CONSTRAINT production_work_entries_stage_check
  CHECK (stage IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff'));

-- Which stage a lot is currently sitting at.
ALTER TABLE production_work_orders DROP CONSTRAINT IF EXISTS production_work_orders_current_stage_check;
ALTER TABLE production_work_orders ADD CONSTRAINT production_work_orders_current_stage_check
  CHECK (current_stage IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff'));

-- Handing a lot from one stage to the next, both ends.
ALTER TABLE production_stage_handovers DROP CONSTRAINT IF EXISTS production_stage_handovers_from_stage_check;
ALTER TABLE production_stage_handovers ADD CONSTRAINT production_stage_handovers_from_stage_check
  CHECK (from_stage IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff'));

ALTER TABLE production_stage_handovers DROP CONSTRAINT IF EXISTS production_stage_handovers_to_stage_check;
ALTER TABLE production_stage_handovers ADD CONSTRAINT production_stage_handovers_to_stage_check
  CHECK (to_stage IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff'));

-- A CCTV clip filed against a stage.
ALTER TABLE production_cctv_references DROP CONSTRAINT IF EXISTS production_cctv_references_stage_check;
ALTER TABLE production_cctv_references ADD CONSTRAINT production_cctv_references_stage_check
  CHECK (stage IN ('Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff'));
