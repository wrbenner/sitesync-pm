-- BRT sub-0 Day 2 — P0-A Phase 3: REVOKE direct PostgREST access on
-- all 7 client-facing materialized views. The wrapper RPCs created in
-- 20261013000000_p0a_matview_wrapper_rpcs.sql are now the only read
-- path for anon/authenticated.
--
-- Why this comes after Phase 1+2: the wrappers and frontend migrations
-- ship together (PR opens with both); Phase 3 applies AFTER that PR
-- merges and Vercel preview verifies the UI still renders through the
-- new RPCs. The temporal ordering avoids a deploy gap where the UI is
-- broken (direct SELECT works, RPCs not yet deployed) or where the
-- wrappers exist but direct SELECT is gone (UI breaks immediately).
--
-- service_role keeps SELECT (used by the cron refresh jobs:
--   - refresh-materialized-views edge fn (5 min)
--   - portfolio-summary-refresh edge fn (5 min)
--   - pg_cron job for lap_2_gate_metrics_daily (hourly)
-- postgres keeps SELECT as the owner. All three roles bypass RLS too.
--
-- Acceptance: Supabase security advisor `materialized_view_in_api`
-- lint count drops 7 → 0. No regression on other lint families.

REVOKE SELECT ON public.project_metrics             FROM anon, authenticated;
REVOKE SELECT ON public.project_health_summary      FROM anon, authenticated;
REVOKE SELECT ON public.submittals_log_mv           FROM anon, authenticated;
REVOKE SELECT ON public.rfi_kpi_rollup              FROM anon, authenticated;
REVOKE SELECT ON public.punch_list_status_rollup    FROM anon, authenticated;
REVOKE SELECT ON public.pay_app_status_summary      FROM anon, authenticated;
REVOKE SELECT ON public.lap_2_gate_metrics_daily    FROM anon, authenticated;

COMMENT ON MATERIALIZED VIEW public.lap_2_gate_metrics_daily IS
  'BRT sub-0 day-2 P0-A lockdown: SELECT revoked from anon, authenticated. '
  'Ops-internal pilot-gate metrics — read only by hourly pg_cron refresh '
  '(postgres role) and CI workflow .github/workflows/lap-2-acceptance.yml '
  'via direct SQL (DATABASE_URL, not PostgREST). No wrapper RPC exposed.';
