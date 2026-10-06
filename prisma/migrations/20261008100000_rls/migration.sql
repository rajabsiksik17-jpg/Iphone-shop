-- Row Level Security: deny-by-default for Supabase's public API.
--
-- The app talks to Postgres only through its own server (Prisma, connecting as
-- the table owner, which RLS does not restrict). Supabase additionally exposes
-- every table in "public" through PostgREST to the `anon` and `authenticated`
-- roles. Enabling RLS with *no* policies makes those endpoints return nothing,
-- and revoking privileges removes them entirely. Customer data, carts, orders
-- and settings are therefore reachable only via the authenticated server.
--
-- Safe on plain PostgreSQL too: the role checks are skipped when the Supabase
-- roles don't exist (local embedded database).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
  END IF;
END $$;

-- Tables created by later migrations must enable RLS too; this event trigger
-- does it automatically so no future table is accidentally exposed.
CREATE OR REPLACE FUNCTION public.nq_enable_rls_on_create() RETURNS event_trigger
LANGUAGE plpgsql AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE' AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
  END LOOP;
END $$;

-- Event triggers need elevated privileges; where they aren't available the
-- migration still succeeds and new tables must enable RLS explicitly.
DO $$
BEGIN
  DROP EVENT TRIGGER IF EXISTS nq_enable_rls;
  CREATE EVENT TRIGGER nq_enable_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION public.nq_enable_rls_on_create();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping RLS event trigger (insufficient privilege); enable RLS in each new migration.';
END $$;
