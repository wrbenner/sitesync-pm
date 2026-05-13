-- BRT sub-0 Day 0 — pgTAP smoke test
--
-- Proves the pgTAP harness is wired correctly. Every subsequent
-- supabase/tests/database/*.sql file follows the same skeleton:
--
--   BEGIN;
--   SET LOCAL search_path = extensions, public;
--   SELECT plan(<N>);
--   ... assertions ...
--   SELECT * FROM finish();
--   ROLLBACK;
--
-- The ROLLBACK is critical — pgTAP tests must leave the database state
-- unchanged so test ordering does not matter.

BEGIN;

SET LOCAL search_path = extensions, public;

SELECT plan(2);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgtap'
  ),
  'pgtap extension is installed'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions' AND p.proname = 'plan'
  ),
  'extensions.plan() helper is callable'
);

SELECT * FROM finish();

ROLLBACK;
