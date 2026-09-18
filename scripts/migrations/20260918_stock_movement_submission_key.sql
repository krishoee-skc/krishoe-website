-- Pressing "post to stock" twice must not put the pairs in twice.
--
-- Nothing stopped it. /api/factory/ready read an item and a count and wrote a
-- stock movement, so a double tap on a factory phone, a retried request on a
-- slow connection, or a back-and-forward through the browser each added another
-- sixty pairs to the godown — and selling then draws on shoes that are not
-- there.
--
-- It matters more since the count stopped being typed. A number typed after a
-- walk to the godown made a second press deliberate; a pre-filled number posted
-- in one press makes an accidental second press a tap away.
--
-- The app already answers this wherever money moves: the caller sends a key it
-- owns and reuses on a retry, and the second arrival returns the first result
-- rather than repeating the work. This brings the stock side to that same rule.
--
-- The column is nullable and the index partial on purpose. Three movements
-- exist already, and every caller that predates this — the Operations form,
-- Packing/QC, the purchase posting — sends no key at all. They keep working
-- exactly as they did; only a caller that supplies a key gets the guarantee.

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS submission_key TEXT;

-- The route checks for an existing movement before writing, which narrows the
-- race. Only this closes it: two presses landing in the same instant both read
-- "no movement yet", and one of them has to lose at the database.
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_submission_key_idx
  ON stock_movements (submission_key)
  WHERE submission_key IS NOT NULL;

-- Prove it, rather than assume it. A migration that silently did nothing would
-- leave the double-post open in exactly the place this file claims to close.
DO $$
DECLARE
  has_column INT;
  has_index  INT;
BEGIN
  SELECT count(*) INTO has_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'stock_movements'
    AND column_name = 'submission_key';

  IF has_column <> 1 THEN
    RAISE EXCEPTION 'stock_movements.submission_key was not added';
  END IF;

  SELECT count(*) INTO has_index
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'stock_movements'
    AND indexname = 'stock_movements_submission_key_idx';

  IF has_index <> 1 THEN
    RAISE EXCEPTION 'stock_movements_submission_key_idx was not created';
  END IF;
END
$$;
