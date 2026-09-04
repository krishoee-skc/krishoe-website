-- Monthly business goals for the owner to aim at.
--
-- The dashboard shows what the shop did today; goals give it something to
-- measure that against — a monthly sales, profit and production target the
-- owner sets, so "Rs. 8,500 today" reads as "85% of the way to today's share of
-- the month" instead of a bare number. One row per Bikram month (the calendar
-- the owner plans in), keyed by "YYYY-MM" so a month is set once and updated in
-- place. Everything defaults to zero, meaning "no goal set", which the UI shows
-- as simply not tracking that line — never a broken or divide-by-zero screen.
--
-- Additive and reversible: a brand-new table, nothing else touched.

CREATE TABLE IF NOT EXISTS business_goals (
  month_key       TEXT PRIMARY KEY,      -- Bikram month, "2083-05"
  sales_goal      NUMERIC NOT NULL DEFAULT 0,
  profit_goal     NUMERIC NOT NULL DEFAULT 0,
  production_goal INTEGER NOT NULL DEFAULT 0,  -- pairs
  note            TEXT NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
