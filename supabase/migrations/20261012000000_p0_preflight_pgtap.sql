-- BRT sub-0 Day 0 — pgTAP harness installation
--
-- Installs the pgTAP extension into the `extensions` schema so that SQL-level
-- tests can be written under supabase/tests/database/. pgTAP ships only
-- testing helpers (plan, ok, throws_ok, etc.) and has no behavioral effect
-- on application schema.
--
-- Why `extensions` schema: project convention keeps extensions out of `public`
-- to avoid Stage-2 audit finding `extension_in_public` (currently flagged for
-- pg_net, pg_trgm, vector — pgTAP would be the 4th if installed in public).
--
-- Idempotent — the extension is harmless to re-create.

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- pgTAP functions are not on the default search_path. Grant USAGE so test
-- runners can reference `extensions.plan`, `extensions.ok`, etc. Tests
-- themselves do `SET LOCAL search_path = extensions, public;` in their
-- BEGIN block to keep the call sites short.
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
