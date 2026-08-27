-- Let a worker's month start when this shop's month starts.
--
-- factory_monthly_summary.month carried
--
--   CHECK (month = date_trunc('month', month)::date)
--
-- which says a month begins on the first. That was true while the summary was
-- kept in Gregorian months. It stopped being true when the shop's months became
-- Bikram Sambat ones: Bhadra 2083 begins on 17 August 2026, and writeMonthlySummary
-- now stores the Gregorian date a BS month starts on.
--
-- So every piece-rate work entry has been refused since — the wage was written,
-- the ledger was written, and then the month failed this check and took the
-- whole transaction with it. What the owner saw was "Failed to create work
-- entry" with nothing else said, because the refusal is a plain database error
-- and the route only names its own FactoryMutationErrors.
--
-- The constraint is dropped rather than rewritten. What it protected — that the
-- month column holds the first day of a month rather than some day in the
-- middle of one — is not expressible in SQL once "month" means a Bikram Sambat
-- month: there is no arithmetic that turns a Gregorian date into "is this the
-- first day of a BS month" without the conversion table the app carries.
-- bikramMonthRange() is where that rule lives now, and it is the only writer.
--
-- Three tables carry the same assumption, and all three are written with a BS
-- month start: the summary, the ledger row a salary payment lands on, and the
-- weekly advance. Only the first has been reached so far, because that is the
-- one every work entry writes; the other two were waiting for the next salary
-- run to fail the same way.
--
-- Safe to run twice, and safe on a database that never had the constraints.
-- Nothing is deleted and no row changes: dropping a CHECK only widens what is
-- allowed, so every row that was valid before still is.

ALTER TABLE factory_monthly_summary
  DROP CONSTRAINT IF EXISTS factory_monthly_summary_month_check;

ALTER TABLE factory_worker_ledger
  DROP CONSTRAINT IF EXISTS factory_worker_ledger_salary_period_check;

ALTER TABLE factory_weekly_advance
  DROP CONSTRAINT IF EXISTS factory_weekly_advance_salary_period_check;
