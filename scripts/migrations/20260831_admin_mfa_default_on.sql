-- Make admin two-factor sign-in the default, and turn it on for everyone.
--
-- The MFA machinery was already built and already enforced for any account with
-- mfa_enabled = true — a password, then a 6-digit code emailed to the account
-- (or a passkey, which counts as both factors at once). It was simply optional,
-- and one active Manager account still had it off.
--
-- This makes it mandatory the gentle way, with no change to the sign-in code and
-- so no new way to be locked out:
--   * every NEW account is created with MFA on (the column default flips to true),
--   * every EXISTING active account is switched on now.
-- Delivery failures stay handled exactly as before — that sign-in attempt is
-- refused and can be retried, never a permanent lock — and a registered passkey
-- remains a second way in when email is unavailable. Additive and reversible.

ALTER TABLE admin_staff_accounts ALTER COLUMN mfa_enabled SET DEFAULT true;

UPDATE admin_staff_accounts
   SET mfa_enabled = true
 WHERE status = 'Active' AND mfa_enabled = false;
