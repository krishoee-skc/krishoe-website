-- The shop's tables are shut to Supabase's public roles at the door, not only
-- by row-level security (owner, 2026-10-28, KR-SEC-02 of the security check).
--
-- Every table has row-level security on and no policy, so anon and
-- authenticated already read nothing. They still held table grants, though:
-- one table with RLS switched off by mistake would have been readable by
-- anyone holding the project's public key. The app never uses these roles —
-- it talks to the database as its own user — so taking the grants away
-- changes nothing it does. No row is touched, nothing is dropped. Safe to run
-- twice; a database without these roles (a local copy) is left as it is.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
  END IF;
END
$$;
