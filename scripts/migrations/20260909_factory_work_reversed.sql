-- Let a piece of factory work be marked reversed, the way its ledger row can be.
--
-- Reversing a work entry on the wages screen marked production_work_entries and
-- stopped there. The factory_daily_work row that fed it, and the worker ledger
-- row beside it, stayed live — so the wage screen said the work was undone and
-- the factory screen and the worker's balance said it still counted. That is
-- the same one-sided drift that had santosh reading Rs. 4,920 against Rs. 9,720.
--
-- factory_worker_ledger.status already allows 'reversed' and every wage sum
-- already skips it. factory_daily_work.status did not: its check constraint
-- allowed only in_progress, completed and rework, so there was no way to say
-- "this work was undone" without deleting the row — and a ledger keeps its
-- history rather than erasing it.
--
-- This adds 'reversed' to that constraint and nothing else. No row is written,
-- updated or deleted here; every existing row is 'completed' and stays exactly
-- as it is. Safe to run twice.

ALTER TABLE factory_daily_work
  DROP CONSTRAINT IF EXISTS factory_daily_work_status_check;

ALTER TABLE factory_daily_work
  ADD CONSTRAINT factory_daily_work_status_check
  CHECK (status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'rework'::text, 'reversed'::text]));
