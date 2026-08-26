-- Let a customer decide which letters they get.
--
-- The shop writes to customers twice: an order confirmation, and — later — an
-- invitation to say how the pair worked out. Neither could be turned off. There
-- was no unsubscribe anywhere in the app, so a shopper who wanted the shop to
-- stop writing had one way to make it stop: mark it as spam. That costs the
-- next hundred letters their delivery, not just theirs.
--
-- Keyed on users(id), the shop's one customer list. A previous attempt at this
-- feature came with a `customers` table of its own, a `customer_orders` table,
-- and four more beside them — a second copy of who bought what. That file is
-- deleted; this is the one thing in it the shop did not already have.
--
-- Additive only. This migration creates a table and touches nothing else, so
-- there is no state it can leave the database in that is worse than before it
-- ran. Safe to run twice.
--
-- No BEGIN/COMMIT of its own: apply-postgres-schema.mjs runs every migration
-- inside one transaction and refuses a file that opens a second, so a migration
-- carrying its own blocked the runner outright — this one included, and every
-- migration written after it.

CREATE TABLE IF NOT EXISTS customer_email_preferences (
  -- One row per customer, and the customer is a user. ON DELETE CASCADE
  -- because a preference about letters is meaningless once there is nobody to
  -- send them to.
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- The letter that says "we have your order". Defaults to true and is
  -- deliberately hard to turn off in the UI: somebody who has just paid is
  -- owed a record of it, and a shop that goes silent after taking money looks
  -- like a shop that took the money.
  order_updates BOOLEAN NOT NULL DEFAULT true,

  -- The invitation to review a pair, and anything else the shop might send
  -- that the customer did not ask for by buying. This is the one that turns
  -- off, and it is the one people actually want to turn off.
  review_invites BOOLEAN NOT NULL DEFAULT true,

  -- A random string in the unsubscribe link. It stands in for signing in:
  -- somebody reading an email on a phone will not log in to stop the emails,
  -- they will press spam instead. Unguessable, and it can only ever turn
  -- letters OFF — turning them back on needs the account.
  unsubscribe_token TEXT NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_email_preferences_token_idx
  ON customer_email_preferences(unsubscribe_token);
