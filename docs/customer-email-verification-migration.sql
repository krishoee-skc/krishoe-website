-- Narrow migration for customer account verification and session security.
-- Safe to run more than once.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx
  ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS email_verification_tokens_email_idx
  ON email_verification_tokens(email);
CREATE INDEX IF NOT EXISTS email_verification_tokens_expires_at_idx
  ON email_verification_tokens(expires_at);

ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_type_check
  CHECK (type IN ('order', 'contact', 'password-reset', 'email-verification', 'operational-alert'));
