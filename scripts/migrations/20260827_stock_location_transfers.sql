-- Where the pairs are, and the challan that moves them.
--
-- The shop is two places — a factory at Kamalnagar and a shop in Narayangadh —
-- and until now the app knew only how many pairs exist, never where. A customer
-- asking "is it here?" was answered with a phone call.
--
-- WHY THIS IS BESIDE finished_stock AND NOT INSIDE IT
--
-- finished_stock is what selling reads. resolveStockRow() finds a design's row
-- and POS draws from it, deliberately as ONE pool: a pair in the factory is
-- still a pair the shop can sell, and the alternative is telling a customer
-- that a shoe they can see is unavailable because it is in the other room.
-- Splitting that table by location would undo the decision on purpose.
--
-- So location is recorded alongside it. The total stays the total, selling is
-- untouched, and these tables answer a different question: of that total, how
-- many are at each place. When the two disagree the screen says so rather than
-- quietly preferring one.
--
-- Additive only. Nothing existing is altered or dropped, so a database that has
-- run this is a database that could still run without it. Safe to run twice.

-- ---------------------------------------------------------------------------
-- Where the pairs are
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_locations (
  id TEXT PRIMARY KEY,
  design TEXT NOT NULL,
  size_run TEXT NOT NULL DEFAULT 'Mixed',

  -- Two places, named for what they are rather than for a branch id: this is
  -- about goods, not about who may read a screen.
  location TEXT NOT NULL CHECK (location IN ('Factory', 'Shop')),

  -- Never negative. Pairs cannot be in a place a negative number of times, and
  -- a transfer that would take more than is there is a mistake to refuse, not
  -- a number to store.
  pairs INTEGER NOT NULL DEFAULT 0 CHECK (pairs >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (design, size_run, location)
);

CREATE INDEX IF NOT EXISTS stock_locations_design_idx ON stock_locations(design);

-- ---------------------------------------------------------------------------
-- The challan
--
-- A challan, not a bill. A bill counts as a sale: it lands in the VAT record
-- and moves the profit figure. Nothing is sold when the shop's own pairs walk
-- from its own factory to its own shelf, so a bill there would be a false sale
-- in the books.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_transfers (
  id TEXT PRIMARY KEY,
  challan_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The day the goods left, as the shop counts days. Kept separate from
  -- created_at, which is when the row was typed.
  sent_date DATE NOT NULL,

  from_location TEXT NOT NULL CHECK (from_location IN ('Factory', 'Shop')),
  to_location TEXT NOT NULL CHECK (to_location IN ('Factory', 'Shop')),
  CONSTRAINT stock_transfers_two_places CHECK (from_location <> to_location),

  sent_by TEXT NOT NULL DEFAULT '',
  carried_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',

  -- In transit until somebody counts what arrived. That state is the whole
  -- point: twenty pairs that leave and eighteen that arrive is a silence
  -- without it.
  status TEXT NOT NULL DEFAULT 'Sent' CHECK (status IN ('Sent', 'Received', 'Cancelled')),
  received_at TIMESTAMPTZ,
  received_by TEXT NOT NULL DEFAULT '',

  -- Total pairs on the challan, kept so a list can be drawn without opening
  -- every one of them.
  sent_pairs INTEGER NOT NULL DEFAULT 0 CHECK (sent_pairs >= 0),
  received_pairs INTEGER NOT NULL DEFAULT 0 CHECK (received_pairs >= 0),

  -- The same three words the factory floor already uses for a stage handover
  -- (handoverSignal in lib/production-accounting-rules.ts), so there is nothing
  -- new to learn.
  signal TEXT CHECK (signal IN ('Matched', 'Short', 'Excess')),

  -- The browser key that made this challan, so a double-tap on a slow
  -- connection cannot send the same goods twice.
  submission_key TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_transfers_submission_key_idx
  ON stock_transfers(submission_key) WHERE submission_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS stock_transfers_status_idx ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS stock_transfers_sent_date_idx ON stock_transfers(sent_date DESC);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  design TEXT NOT NULL,
  size_run TEXT NOT NULL DEFAULT 'Mixed',
  sent_pairs INTEGER NOT NULL CHECK (sent_pairs > 0),

  -- Null until the challan is received. Counted at the shop, and allowed to
  -- differ from what was sent — that difference is the finding.
  received_pairs INTEGER CHECK (received_pairs IS NULL OR received_pairs >= 0)
);

CREATE INDEX IF NOT EXISTS stock_transfer_items_transfer_idx
  ON stock_transfer_items(transfer_id);

-- ---------------------------------------------------------------------------
-- The opening split, from what the shop already knows
--
-- The owner's rule: what production made is at the factory, what was bought in
-- is at the shop. finished_stock already records which is which — channel
-- 'Factory' is a pair posted by packing/QC, and the trading channels are pairs
-- bought to resell. So there is no counting day and nothing to guess.
--
-- Runs once. ON CONFLICT DO NOTHING means a second run leaves the numbers the
-- owner has since corrected exactly as they are.
-- ---------------------------------------------------------------------------

INSERT INTO stock_locations (id, design, size_run, location, pairs)
SELECT
  'loc-' || md5(design || '|' || size_run || '|' ||
                CASE WHEN channel = 'Factory' THEN 'Factory' ELSE 'Shop' END),
  design,
  size_run,
  CASE WHEN channel = 'Factory' THEN 'Factory' ELSE 'Shop' END,
  stock_pairs
FROM finished_stock
WHERE stock_pairs > 0
ON CONFLICT (design, size_run, location) DO NOTHING;
