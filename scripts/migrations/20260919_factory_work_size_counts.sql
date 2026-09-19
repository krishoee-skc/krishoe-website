-- How many pairs were made in each size.
--
-- The owner asked how to record a 36-41 run where 38 was made twice and every
-- other size once. There is nowhere to put it. `size` is one piece of text and
-- `pairs_count` is one total, so every row in the factory today reads as some
-- version of "36/41, 60 pairs" — six sizes and a number, with nothing to say
-- which size a pair belongs to. Seven pairs across six sizes and six pairs
-- across six sizes are stored identically.
--
-- That is not only a reporting gap. The shop cannot answer "how many 38s are
-- on the shelf", cannot see that a run came out short in one size, and cannot
-- match a bottom run to the uppers it actually fits when the two were made in
-- different quantities per size.
--
-- production_work_entries has carried a size_breakdown column all along, and
-- the sync writes {"36/41": 60} into it — the whole run as one key, which is
-- the same non-answer in JSON. factory_daily_work, the table the factory
-- screens and the save guard actually read, has no such column at all.
--
-- So it gets one, shaped the way the question is asked: size to pairs.

ALTER TABLE factory_daily_work ADD COLUMN IF NOT EXISTS size_counts JSONB;

-- Nullable on purpose, and left empty for everything already recorded.
--
-- Eleven rows exist, and not one of them knows its own breakdown: "60 pairs,
-- 36/41" is genuinely all that was written down. Backfilling ten-of-each would
-- invent a fact — it is the likely answer, not a recorded one, and once
-- written it is indistinguishable from a count somebody actually entered.
--
-- An empty column says "this entry did not record it", which is true, and the
-- screens fall back to the total exactly as they do now. New entries fill it.

COMMENT ON COLUMN factory_daily_work.size_counts IS
  'Pairs made per size, e.g. {"36":1,"38":2}. NULL on entries recorded before '
  'per-size counts existed; those know only their total. When present the '
  'values must sum to pairs_count.';

-- Prove it, rather than assume it. A migration that silently did nothing would
-- leave the app writing per-size counts into a column that is not there.
DO $$
DECLARE
  has_column INT;
BEGIN
  SELECT count(*) INTO has_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'factory_daily_work'
    AND column_name = 'size_counts';

  IF has_column <> 1 THEN
    RAISE EXCEPTION 'factory_daily_work.size_counts was not added';
  END IF;
END
$$;
