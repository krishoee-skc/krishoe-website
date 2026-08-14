-- Sign-in by mobile number, for people who have no email.
--
-- A factory worker in Nepal has a phone, not an inbox. Every recovery path in
-- this app went through email, so scaling the worker portal past the handful of
-- staff who happen to have addresses was impossible. Phone becomes a second
-- sign-in identity: an account needs an email or a phone, and either one can be
-- typed into the sign-in box.
--
-- Email therefore has to be allowed to be absent. It stays UNIQUE, and Postgres
-- lets a unique index hold any number of NULLs, so accounts with no address do
-- not collide with each other. Empty string is deliberately never stored — two
-- empty strings would collide where two NULLs do not.

ALTER TABLE admin_staff_accounts ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE admin_staff_accounts ALTER COLUMN email DROP NOT NULL;

-- Digits only, no country code: what normalizeStaffPhone() produces. Comparing
-- raw input would let 9841112222 and +977-9841112222 both be created as the
-- same worker.
CREATE UNIQUE INDEX IF NOT EXISTS admin_staff_accounts_phone_unique_idx
  ON admin_staff_accounts (phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- A reset code for customers, matching what staff already get. The code is
-- hashed like a password; attempt_count is what stops a six-digit code from
-- being guessed a million times.
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
