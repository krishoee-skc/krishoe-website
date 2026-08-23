-- Everything a customer says to the shop, in one place.
--
-- It was in four, reached from four menu entries, kept in four different
-- shapes: reviews inside the products row as JSON, contact_messages,
-- wholesale_enquiries, and a Feedback screen reading a user_feedback table that
-- was never created — its migration sat in a `migrations/` folder at the repo
-- root that nothing has ever read. A shopkeeper wanting to know what customers
-- had said opened four screens and hoped they had not missed one.
--
-- What makes this worth doing today rather than later is that all four are
-- empty. Nothing is migrated because there is nothing to migrate, and the cost
-- of the change only ever rises from here.
--
-- The kinds are deliberately few: a verdict on a pair they own, a question
-- before buying, or a complaint. A longer list would be a filing system nobody
-- maintains.
--
-- Wholesale is not here. A shop asking for two hundred pairs a month is a sales
-- pipeline with a shop name, a location and a monthly quantity, and it keeps
-- its own table and screen — those fields would be lost in a list of messages.

CREATE TABLE IF NOT EXISTS customer_voice (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  kind text NOT NULL CHECK (kind IN ('review', 'question', 'complaint')),

  customer_name text NOT NULL DEFAULT '',
  -- The number is how a Nepali shop actually answers: a call or a WhatsApp
  -- message, not an email thread. Kept beside the message so replying is one
  -- tap from the row rather than a search through orders.
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',

  -- Which pair this is about, when it is about one. No foreign key: a review
  -- outlives the product row it was written against, and losing the review
  -- because a product was deleted would be the wrong trade.
  product_id text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  -- 1..5 for a review; 0 when the kind carries no verdict.
  rating integer NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),

  message text NOT NULL DEFAULT '',

  -- The whole point of one inbox: a row that has been read but not answered is
  -- visibly different from one that is finished. 'new' is what arrives,
  -- 'answered' is what the owner has replied to, 'closed' is done with.
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'answered', 'closed')),
  replied_at timestamptz,
  reply_note text NOT NULL DEFAULT '',

  -- Whether a review may appear on the storefront. A review is a customer's
  -- words on a public page, so it is off until the owner puts it there.
  published boolean NOT NULL DEFAULT false,

  source text NOT NULL DEFAULT 'site',
  branch_id text
);

-- The inbox opens on "what needs answering, newest first", so that ordering is
-- the one worth an index.
CREATE INDEX IF NOT EXISTS customer_voice_status_idx
  ON customer_voice (status, created_at DESC);

CREATE INDEX IF NOT EXISTS customer_voice_kind_idx
  ON customer_voice (kind, created_at DESC);

-- Reading a product's published reviews to show on its page.
CREATE INDEX IF NOT EXISTS customer_voice_product_idx
  ON customer_voice (product_id, published, created_at DESC);
