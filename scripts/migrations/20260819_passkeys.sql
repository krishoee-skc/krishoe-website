-- Signing in without a password at all.
--
-- A password is the weakest part of this shop's security and the part everyone
-- already knows it: it can be guessed, reused on another site that then leaks
-- it, read over a shoulder at the counter, or typed into a page that only looks
-- like ours. Every other protection here — the rate limit, the emailed code,
-- the device alert — exists to contain that one weakness.
--
-- A passkey removes it. The private half never leaves the phone or laptop, is
-- unlocked by a fingerprint or the device PIN, and is bound to this site's
-- address, so a copy of our sign-in page on another domain cannot use it even
-- if someone is fooled into trying. What is stored here is only the public
-- half, which is useless to anyone who takes it.

CREATE TABLE IF NOT EXISTS admin_passkeys (
  -- The credential id the authenticator generated, base64url. Unique across the
  -- world, so it is the key.
  id text PRIMARY KEY,
  staff_id text NOT NULL,
  -- The public half. Safe to store, safe to lose: it can verify a signature,
  -- never produce one.
  public_key text NOT NULL,
  -- Increments on each use. A number that goes backwards means the credential
  -- was cloned, which is the one thing this can detect that a password cannot.
  counter bigint NOT NULL DEFAULT 0,
  -- Which device this is, in the owner's words: "mero phone", "counter ko
  -- laptop". A list of credential ids is unreadable when deciding what to
  -- remove after a phone is lost.
  label text NOT NULL DEFAULT '',
  -- Whether the key can travel (iCloud/Google password manager) or is stuck to
  -- one device. It changes the advice after a lost phone, so it is worth
  -- keeping.
  device_type text NOT NULL DEFAULT '',
  backed_up boolean NOT NULL DEFAULT false,
  transports text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_passkeys_staff_idx ON admin_passkeys (staff_id);

-- The one-time challenge a sign-in is answered against.
--
-- Kept server-side and deleted on use. Without this the same signed response
-- could be replayed later, which is exactly the attack passkeys otherwise make
-- impossible.
CREATE TABLE IF NOT EXISTS admin_passkey_challenges (
  challenge text PRIMARY KEY,
  -- Null while signing in, because at that point we do not yet know who is
  -- asking — that is what the credential will tell us.
  staff_id text,
  kind text NOT NULL CHECK (kind IN ('register', 'login')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_passkey_challenges_expiry_idx
  ON admin_passkey_challenges (expires_at);
