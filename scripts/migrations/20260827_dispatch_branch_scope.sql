-- Bring the two dispatch tables inside branch isolation.
--
-- 20260802_branch_access_v1.sql gave every table that holds a branch's own
-- records a branch_id, a default, and the krishoe_branch_isolation policy.
-- vehicle_dispatches and vehicle_dispatch_items were on the list it was written
-- from and never got any of it, so `npm run audit:access` has been reporting
-- them as outside branch isolation ever since — which is correct, and was the
-- only finding it had.
--
-- Safe to do now precisely because both tables are empty: there are no existing
-- rows to assign to a branch, and therefore no chance of guessing wrong. Left
-- until they hold a season of dispatches, the same change would need somebody
-- to decide which branch each historical row belonged to.
--
-- Same shape as every other branch table: the column defaults to
-- krishoe_effective_branch_id(), so a row written by a signed-in staff member
-- lands in their branch without any caller having to remember; and the policy
-- is the shared one, so there is a single definition of who may see what.
--
-- Additive only, and safe to run twice.

ALTER TABLE vehicle_dispatches
  ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT krishoe_effective_branch_id();

ALTER TABLE vehicle_dispatch_items
  ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT krishoe_effective_branch_id();

CREATE INDEX IF NOT EXISTS vehicle_dispatches_branch_id_idx
  ON vehicle_dispatches(branch_id);

CREATE INDEX IF NOT EXISTS vehicle_dispatch_items_branch_id_idx
  ON vehicle_dispatch_items(branch_id);

ALTER TABLE vehicle_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_dispatches FORCE ROW LEVEL SECURITY;
ALTER TABLE vehicle_dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_dispatch_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS krishoe_branch_isolation ON vehicle_dispatches;
CREATE POLICY krishoe_branch_isolation ON vehicle_dispatches
  USING (krishoe_can_access_branch(branch_id))
  WITH CHECK (krishoe_can_access_branch(branch_id));

DROP POLICY IF EXISTS krishoe_branch_isolation ON vehicle_dispatch_items;
CREATE POLICY krishoe_branch_isolation ON vehicle_dispatch_items
  USING (krishoe_can_access_branch(branch_id))
  WITH CHECK (krishoe_can_access_branch(branch_id));
