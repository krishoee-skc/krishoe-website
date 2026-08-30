-- A simple per-pair material estimate on each factory item.
--
-- Full recipes (factory_item_bom x purchase prices) are the accurate route and
-- stay the goal, but they need every material and its price entered first. Until
-- then this one number lets the owner put a rough material cost on an item so the
-- design's cost and profit are not left blank. Additive, defaulted to 0.

ALTER TABLE factory_items ADD COLUMN IF NOT EXISTS material_cost_per_pair NUMERIC NOT NULL DEFAULT 0;
