-- Connect quick Factory work entries to an optional Production Work Order/Lot.
-- The schema runner owns BEGIN/COMMIT. Existing work remains valid and unchanged.

ALTER TABLE factory_daily_work
  ADD COLUMN IF NOT EXISTS work_order_id TEXT;

ALTER TABLE factory_daily_work
  DROP CONSTRAINT IF EXISTS factory_daily_work_order_id_fkey;
ALTER TABLE factory_daily_work
  ADD CONSTRAINT factory_daily_work_order_id_fkey
    FOREIGN KEY (work_order_id) REFERENCES production_work_orders(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS factory_daily_work_order_idx
  ON factory_daily_work(work_order_id);
