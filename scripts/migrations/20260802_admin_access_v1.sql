-- Additive security foundation for staff invitation, recovery, MFA, devices,
-- HR linkage, and detailed access history. No staff or business row is deleted.

ALTER TABLE admin_staff_accounts
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_login_user_agent TEXT NOT NULL DEFAULT '';

UPDATE admin_staff_accounts
SET password_changed_at = COALESCE(password_changed_at, updated_at, created_at)
WHERE password_hash <> '' AND password_changed_at IS NULL;

ALTER TABLE admin_staff_accounts
  DROP CONSTRAINT IF EXISTS admin_staff_accounts_role_check,
  DROP CONSTRAINT IF EXISTS admin_staff_accounts_status_check,
  DROP CONSTRAINT IF EXISTS admin_staff_accounts_failed_login_count_check;

ALTER TABLE admin_staff_accounts
  ADD CONSTRAINT admin_staff_accounts_role_check
    CHECK (role IN ('Owner', 'Manager', 'Accountant', 'HR', 'Inventory', 'Sales', 'Factory', 'Viewer')),
  ADD CONSTRAINT admin_staff_accounts_status_check
    CHECK (status IN ('Invited', 'Active', 'Locked', 'Disabled')),
  ADD CONSTRAINT admin_staff_accounts_failed_login_count_check
    CHECK (failed_login_count >= 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_staff_accounts_employee_id_fkey'
      AND conrelid = 'admin_staff_accounts'::regclass
  ) THEN
    ALTER TABLE admin_staff_accounts
      ADD CONSTRAINT admin_staff_accounts_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS admin_staff_accounts_employee_unique_idx
  ON admin_staff_accounts(employee_id)
  WHERE employee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_staff_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id TEXT NOT NULL REFERENCES admin_staff_accounts(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('invitation', 'password_reset', 'mfa_login')),
  token_hash TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_staff_tokens_staff_purpose_idx
  ON admin_staff_tokens(staff_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_staff_tokens_expires_idx
  ON admin_staff_tokens(expires_at);

CREATE TABLE IF NOT EXISTS admin_staff_sessions (
  id UUID PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES admin_staff_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  device_label TEXT NOT NULL DEFAULT '',
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS admin_staff_sessions_staff_idx
  ON admin_staff_sessions(staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_staff_sessions_active_idx
  ON admin_staff_sessions(staff_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_staff_access_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id TEXT NOT NULL REFERENCES admin_staff_accounts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_staff_access_history_staff_idx
  ON admin_staff_access_history(staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_staff_access_history_actor_idx
  ON admin_staff_access_history(actor_id, created_at DESC);
