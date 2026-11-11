-- Supabase exposes the public schema through its Data API (REST and GraphQL) to the anon,
-- authenticated and service_role roles, and grants them every new table by default. SUNLEON AI
-- never uses the Data API: every query goes through the server, which applies its own
-- authorisation and row-level security. Without this, tables without RLS (users, sessions,
-- plans, platform settings) could be read or changed with the project's public API key.
--
-- Revokes those roles' privileges on everything in public, now and for objects created later
-- by the migrating role. A no-op on PostgreSQL servers without these roles (local Docker, CI).
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
