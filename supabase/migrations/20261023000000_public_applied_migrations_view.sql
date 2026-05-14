-- Public read-only view of supabase_migrations.schema_migrations.
--
-- Purpose: Gate 21 (migrations-on-prod parity CI check) needs to read the
-- applied-version list from prod without holding a service-role key in CI
-- secrets. The version list is already visible to anyone who can run
-- `supabase migration list --linked` with a project ref, so exposing it as
-- a public view is not new disclosure — it just removes the need to grant
-- CI the keys to the kingdom.
--
-- View carries ONLY the version column (no statements, no name, no created_by).
-- Anon can SELECT; no write grants.

CREATE OR REPLACE VIEW public.v_applied_migrations AS
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- Make the view explicitly anon-readable. The owner must have SELECT on the
-- underlying schema_migrations table (postgres role does by default).
GRANT SELECT ON public.v_applied_migrations TO anon;
GRANT SELECT ON public.v_applied_migrations TO authenticated;

COMMENT ON VIEW public.v_applied_migrations IS
  'Anon-readable list of applied migration versions. Backs Gate 21 (CI parity check). No bodies, no metadata — only the 14-digit version strings.';
