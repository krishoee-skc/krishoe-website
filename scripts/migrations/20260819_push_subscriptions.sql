-- Where the owner's phone can be reached, so an order can reach them.
--
-- Until now the shop could only tell the owner about an order by email, or by
-- them opening the admin app and looking. An order placed at nine at night was
-- not seen until morning, and in a business whose whole promise is "we will
-- call you shortly to confirm", that delay is the promise being broken.
--
-- A push subscription is three values the browser hands us: an endpoint to post
-- to, and two keys used to encrypt the payload so that the push service —
-- Google's or Apple's or Mozilla's — carries a message it cannot read.
--
-- Rows are deleted rather than kept when a push comes back 404 or 410, which is
-- how a browser says the subscription is gone for good. Keeping dead
-- subscriptions would mean every future notification waits on a request that
-- can only fail.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  -- The endpoint is unique per browser per device and already identifies the
  -- subscription, so it is the key. Re-subscribing the same browser updates the
  -- row instead of leaving a duplicate that would double every notification.
  endpoint text PRIMARY KEY,
  -- RFC 8291 encryption material. Without both, a payload cannot be sealed and
  -- the push service will refuse it.
  p256dh text NOT NULL,
  auth text NOT NULL,
  -- Which staff account subscribed. Nullable so a subscription is not lost if
  -- the account is later removed — the device simply stops being addressed by
  -- role and can still be cleaned up by endpoint.
  staff_id text,
  -- Free-text, only ever shown to the owner: "Krishna ko phone", "counter ko
  -- computer". A list of endpoints is unreadable when deciding what to revoke.
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Bumped on every successful send. A subscription that has not been reached
  -- in months is a device that is gone, and this is how that becomes visible.
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_staff_idx
  ON push_subscriptions (staff_id);
