-- "Damage Out", put back.
--
-- 20260902_stock_movement_damage_out.sql widened this list, and is stamped as
-- run, but the live database carries the older seven: the database was built
-- again from docs/schema.sql when it moved to Supabase, and that snapshot still
-- held the old list. Since then every write-off — a torn pair, a lost pair, a
-- shelf count that found fewer than the books — has been refused before it was
-- written: not one Damage Out stands in the books (owner, 2026-10-11).
--
-- The same list as that migration, the one lib/stock-rules.ts writes.
-- A CHECK constraint cannot be altered in place, so it is dropped and made
-- again in one statement pair. No row is changed: every row already stored is
-- one of the older seven, all of which stay allowed.

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN (
    'Production In',
    'Purchase In',
    'Dispatch Out',
    'Return In',
    'Sale Out',
    'Market Sale',
    'Adjustment',
    'Damage Out'
  ));
