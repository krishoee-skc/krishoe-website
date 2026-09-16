-- Close the last branch gap before the wall is switched on, and record why one
-- table is deliberately left open.
--
-- Today the app connects as neondb_owner, a role with rolbypassrls: Postgres
-- skips every policy before reading it, so the 32 policies written in
-- 20260802_branch_access_v1.sql have never actually run. Switching to a
-- NOBYPASSRLS role turns them all on at once, and anything they do not cover
-- becomes visible in the wrong branch — or invisible in every branch.
--
-- An audit of all 87 tables found exactly two carrying branch_id with no policy
-- and no RLS: customer_voice and admin_staff_accounts. They are opposite cases.
--
-- customer_voice — 11 rows, every one with an empty branch_id, and the ten
-- published reviews among them are on the public product pages. Left as it is,
-- the wall makes them unreachable and the shop loses its reviews. Backfilled to
-- the default branch and given the same policy as its neighbours.
--
-- admin_staff_accounts — deliberately NOT walled, and this migration is where
-- that decision is written down. lib/admin-bootstrap-login.ts reads this table
-- to authenticate, before any branch context exists; a policy here would be
-- evaluated against nobody's branch and could refuse every login, including the
-- Owner's, with no way back in through the app. Staff are already protected by
-- permissions rather than by row scope, and the table holds no money, stock or
-- customer data. A lockout is not recoverable from the outside; a visible staff
-- list is.

-- customer_voice: the same treatment its neighbours got in 20260802.
DO $$
BEGIN
  IF to_regclass('public.customer_voice') IS NULL THEN
    RAISE EXCEPTION 'customer_voice does not exist';
  END IF;

  -- Rows written before the column existed carry ''. Those are real reviews;
  -- they belong to the shop's default branch, not to nowhere.
  UPDATE customer_voice
  SET branch_id = krishoe_effective_branch_id()
  WHERE branch_id IS NULL OR btrim(branch_id) = '';

  ALTER TABLE customer_voice ALTER COLUMN branch_id SET DEFAULT krishoe_effective_branch_id();
  ALTER TABLE customer_voice ALTER COLUMN branch_id SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_voice_branch_id_fkey'
      AND conrelid = to_regclass('public.customer_voice')
  ) THEN
    ALTER TABLE customer_voice
      ADD CONSTRAINT customer_voice_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES company_branches(id) ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS customer_voice_branch_id_idx ON customer_voice(branch_id);

  ALTER TABLE customer_voice ENABLE ROW LEVEL SECURITY;
  ALTER TABLE customer_voice FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS krishoe_branch_isolation ON customer_voice;
  CREATE POLICY krishoe_branch_isolation ON customer_voice
    USING (krishoe_can_access_branch(branch_id))
    WITH CHECK (krishoe_can_access_branch(branch_id));
END
$$;

-- Prove it, rather than assume it. A migration that silently did nothing would
-- leave the wall with a hole in exactly the place this file claims to close.
DO $$
DECLARE
  homeless INT;
  guarded  INT;
BEGIN
  SELECT count(*) INTO homeless
  FROM customer_voice WHERE branch_id IS NULL OR btrim(branch_id) = '';

  IF homeless > 0 THEN
    RAISE EXCEPTION 'customer_voice still has % rows with no branch', homeless;
  END IF;

  SELECT count(*) INTO guarded
  FROM pg_policies WHERE tablename = 'customer_voice' AND policyname = 'krishoe_branch_isolation';

  IF guarded <> 1 THEN
    RAISE EXCEPTION 'customer_voice has no branch policy';
  END IF;
END
$$;

COMMENT ON TABLE admin_staff_accounts IS
  'Deliberately not branch-scoped: the login path reads this table before any '
  'branch context exists, so a policy here could refuse every sign-in with no '
  'way back in. Protected by role permissions instead. See '
  'scripts/migrations/20260916_branch_wall_preflight.sql.';
