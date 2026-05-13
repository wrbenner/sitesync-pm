-- Task #30 Batch 1 — 5 cron-only / service-role-only SECURITY DEFINER
-- functions. Per BRT_SUB_0_STANDING_DECISIONS §2 + §3:
--   - SET search_path = public pinned
--   - REVOKE EXECUTE FROM PUBLIC, anon, authenticated
--   - GRANT EXECUTE TO service_role only (no authenticated grant —
--     these have zero frontend callers; verified via grep of src/ +
--     supabase/functions/ + scripts/ on 2026-05-13).
--
-- No body changes — `ALTER FUNCTION` for the search_path pin, then
-- REVOKE/GRANT pairs. Same end state as a CREATE OR REPLACE would
-- produce but with much lower blast radius.
--
-- Lint impact (target):
--   anon_security_definer_function_executable        74 → 69 (-5)
--   authenticated_security_definer_function_executable 82 → 77 (-5)
--   function_search_path_mutable                     81 → 76 (-5)

-- 1. refresh_project_health_summary() — called by portfolio-summary-refresh
--    edge fn (runs as service_role) and pg_cron jobs.
ALTER FUNCTION public.refresh_project_health_summary() SET search_path = public;
REVOKE ALL     ON FUNCTION public.refresh_project_health_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_project_health_summary() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_project_health_summary() TO service_role;
COMMENT ON FUNCTION public.refresh_project_health_summary() IS
  'Task #30 batch 1: service-role-only matview refresh. Called by portfolio-summary-refresh edge fn + pg_cron.';

-- 2. refresh_submittals_log_mv(p_concurrent boolean) — pg_cron trigger.
ALTER FUNCTION public.refresh_submittals_log_mv(boolean) SET search_path = public;
REVOKE ALL     ON FUNCTION public.refresh_submittals_log_mv(boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_submittals_log_mv(boolean) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_submittals_log_mv(boolean) TO service_role;
COMMENT ON FUNCTION public.refresh_submittals_log_mv(boolean) IS
  'Task #30 batch 1: service-role-only matview refresh. Called by trg_refresh_submittals_log_mv trigger + pg_cron.';

-- 3. update_warranty_status() — cron job (warranty expiry sweep).
ALTER FUNCTION public.update_warranty_status() SET search_path = public;
REVOKE ALL     ON FUNCTION public.update_warranty_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_warranty_status() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_warranty_status() TO service_role;
COMMENT ON FUNCTION public.update_warranty_status() IS
  'Task #30 batch 1: service-role-only warranty expiry sweep. Cron-driven, no frontend callers.';

-- 4. enqueue_insights_jobs() — cron job (scheduled-insights heartbeat).
ALTER FUNCTION public.enqueue_insights_jobs() SET search_path = public;
REVOKE ALL     ON FUNCTION public.enqueue_insights_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_insights_jobs() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enqueue_insights_jobs() TO service_role;
COMMENT ON FUNCTION public.enqueue_insights_jobs() IS
  'Task #30 batch 1: service-role-only insights enqueue. Cron-driven.';

-- 5. lap_2_open_incident_count() — used by Lap 2 acceptance gate CI
--    workflow via direct SQL (DATABASE_URL → postgres role); not RPC.
ALTER FUNCTION public.lap_2_open_incident_count() SET search_path = public;
REVOKE ALL     ON FUNCTION public.lap_2_open_incident_count() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lap_2_open_incident_count() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.lap_2_open_incident_count() TO service_role;
COMMENT ON FUNCTION public.lap_2_open_incident_count() IS
  'Task #30 batch 1: service-role-only gate stat. Called by .github/workflows/lap-2-acceptance.yml via direct SQL, not PostgREST.';
