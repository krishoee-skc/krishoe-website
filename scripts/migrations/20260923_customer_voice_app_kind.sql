-- Notes about the app itself belong in the inbox the owner already reads.
--
-- The shop has two ways for a customer to say something, and only one of them
-- works. `customer_voice` carries reviews, questions and complaints, and the
-- owner reads them at /admin/inbox. A note about the app itself — a button
-- that does not work, a figure that reads wrong, something missing — went
-- somewhere else entirely: a `user_feedback` table, read by one screen that no
-- route ever rendered. Customers could send it and nobody could read it.
--
-- On the database built from docs/schema.sql that table does not exist at all,
-- because it is created by a file outside scripts/migrations that the schema
-- runner never reads. So today the form at /feedback accepts what a customer
-- types and then fails on the insert.
--
-- Rather than add a second table and a second screen, this widens the one that
-- works. 'app' becomes a fourth kind beside review, question and complaint:
-- same row shape, same statuses, same reply flow, one inbox to look at.
--
-- Nothing else changes. The storefront selects `kind = 'review'`, so an app
-- note can never appear on a product page, and `published` stays false for it.

ALTER TABLE customer_voice
  DROP CONSTRAINT IF EXISTS customer_voice_kind_check;

ALTER TABLE customer_voice
  ADD CONSTRAINT customer_voice_kind_check
  CHECK (kind IN ('review', 'question', 'complaint', 'app'));
