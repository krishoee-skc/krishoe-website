-- Quality: how many of a work entry's pairs were rejected.
--
-- A worker's day is one row of "N pairs of this item"; QC needs to say how many
-- of those N were rejects (bad) versus good. reject_pairs holds that count, so
-- good = pairs_count - reject_pairs. Additive and defaulted to 0 — every
-- existing entry stays a full pass, and wage (paid on pairs_count) is untouched.

ALTER TABLE factory_daily_work ADD COLUMN IF NOT EXISTS reject_pairs INTEGER NOT NULL DEFAULT 0;
