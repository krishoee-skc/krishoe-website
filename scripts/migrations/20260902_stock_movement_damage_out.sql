-- Let stock be written off when a pair is damaged or lost.
--
-- Stock could only ever leave the shelf as a dispatch or a sale. A pair that
-- tore in the box, or went missing, had nowhere to go — the owner's only option
-- was a fake sale, which lies in the books, or leaving dead pairs on the count,
-- which lies in the stock. "Damage Out" is the honest third door: pairs come off
-- the shelf, and nothing is recorded as sold.
--
-- The application already treats "Damage Out" as a stock-out (lib/stock-rules.ts),
-- so it decrements stock, checks there are enough pairs first, and reverses
-- cleanly on delete — exactly like a dispatch. This CHECK constraint is the one
-- place the database would still refuse it, so the type is widened here.
--
-- Safe to run twice: the constraint is dropped by name if present and added back
-- widened. Nothing is deleted and no existing row changes — every value allowed
-- before is still allowed.

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_type_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_check
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
