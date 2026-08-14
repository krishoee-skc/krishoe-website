-- One name, one worker — enforced by the database, not only by the check above it.
--
-- The API already refuses a name that reads the same as an existing one, case
-- and surrounding spaces ignored. But that check is a SELECT followed by an
-- INSERT, and nothing holds the gap between them. Two requests arriving
-- together — a double-tapped Save on a slow connection is the ordinary way this
-- happens — both read "no clash" and both insert. The result is the exact pair
-- of look-alike rows the check exists to prevent, and the wages then split
-- across the two of them.
--
-- Matching lower(btrim(name)) so the index agrees with the check exactly:
-- "ankus", "Ankus" and "ankus " are one worker to both.
--
-- Verified clash-free before writing this: zero colliding groups in either
-- table.

CREATE UNIQUE INDEX IF NOT EXISTS factory_workers_name_unique_idx
  ON factory_workers (lower(btrim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS factory_items_name_unique_idx
  ON factory_items (lower(btrim(name)));
