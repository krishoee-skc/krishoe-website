-- Record the production stage on each work entry, so the stage reflects the
-- work actually done (an Upper man can do fiber silai) rather than being derived
-- from the worker's fixed category. The schema runner owns BEGIN/COMMIT.
--
-- Added nullable and backfilled from each worker's category, so every existing
-- entry keeps a sensible stage and nothing that reads the old category-derived
-- stage breaks. New entries will set it explicitly from the Add-work form.
ALTER TABLE factory_daily_work
  ADD COLUMN IF NOT EXISTS stage TEXT;

-- Backfill: give existing rows the stage their worker's category implied, the
-- same mapping the app used before this column existed. Only fills blanks, so
-- re-running is safe.
UPDATE factory_daily_work AS w
SET stage = wk.category
FROM factory_workers AS wk
WHERE w.worker_id = wk.id
  AND (w.stage IS NULL OR w.stage = '');

CREATE INDEX IF NOT EXISTS factory_daily_work_stage_idx
  ON factory_daily_work(stage);
