-- Let factory_rates hold a rate for any worker category, not only Upper and
-- Fibermen.
--
-- KRISHOE pays a silai man too, at a rate that changes by silai type and by
-- item. With Fiber Silai (and the other stages) allowed here, that rate lives
-- per item alongside Upper and Fibermen, and the costing rolls it into labour
-- automatically. Additive: every existing Upper/Fibermen row stays valid.

ALTER TABLE factory_rates DROP CONSTRAINT IF EXISTS factory_rates_worker_category_check;
ALTER TABLE factory_rates
  ADD CONSTRAINT factory_rates_worker_category_check
  CHECK (worker_category = ANY (ARRAY[
    'Upper', 'Fibermen', 'Fiber Preparation', 'Fiber Silai', 'Bottom Final', 'Packing / QC', 'Staff'
  ]));
