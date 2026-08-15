-- One name, one product — the rule factory workers and factory items already
-- follow, now applied to the shop catalog.
--
-- "Jeans Shoes" and "jeans shoes" existed side by side as two rows. They are
-- one product to everyone who reads a list, and they were one design to the
-- stock sync, so recording 55 counted pairs against the name would have handed
-- 55 to each of them: 110 pairs in a shop holding 55. The duplicate has been
-- removed; this stops the next one being created.
--
-- The expression matches designKey() exactly — trim, collapse runs of spaces,
-- lowercase — so the index, the stock sync and the entry check all agree about
-- what counts as the same name. An index on plain lower(name) would admit
-- "jeans  shoes" with two spaces, which the sync would then fold back together.
--
-- Verified collision-free before writing this.

CREATE UNIQUE INDEX IF NOT EXISTS products_name_unique_idx
  ON products (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
