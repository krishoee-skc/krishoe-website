-- Where each measurement was taken.
--
-- A speed reading from the shop and one from a laptop running `npm run dev`
-- landed in the same table, against the same paths, with nothing to tell them
-- apart. A dev server compiles a page the first time it is asked for, which
-- takes ten to twenty seconds, so /contact was reported at 20.6s on a day the
-- live page answered the same request in 1.1s. The owner read it as an outage
-- and was right to.
--
-- Guarding this in the browser alone is not enough: a Vercel preview
-- deployment has NODE_ENV=production, so its measurements would still arrive
-- looking like the shop's. The server is the only place that knows for certain,
-- and VERCEL_ENV is what it knows it by.
--
-- Nothing is thrown away. A measurement from a preview or a laptop is real and
-- occasionally the only way to tell whether a change helped — it is recorded
-- and simply not counted as the shop.

ALTER TABLE monitoring_performance
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production';

-- Every reading already in the table was taken before this column existed, and
-- the ones that were plainly a dev server have already been deleted. The rest
-- are treated as the shop, which is what they were.

-- The dashboard reads "the shop, over the last day", so that is the index.
CREATE INDEX IF NOT EXISTS monitoring_performance_env_idx
  ON monitoring_performance (environment, created_at DESC);
