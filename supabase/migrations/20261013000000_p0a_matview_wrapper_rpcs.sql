-- BRT sub-0 Day 2 — P0-A: wrapper RPCs for 6 client-facing matviews
--
-- Phase 1 of the matview lockdown (P0-A finding from Stage 1/2 audit).
-- The Stage 2 advisor flags 7 matviews as `materialized_view_in_api`
-- because they're reachable through PostgREST under anon/authenticated.
-- Matviews don't honor RLS on their underlying tables — querying via
-- .from() returns rows regardless of project/org membership, so a
-- logged-in user from Org A can read rolled-up KPIs and (for
-- submittals_log_mv) raw row content from Org B.
--
-- Day 2 lands in three phases to avoid a deploy gap where the UI is
-- broken:
--
--   Phase 1 (THIS migration) — additive: create 6 SECURITY DEFINER
--     wrapper RPCs, each scoped via inline project-membership gate.
--     No REVOKE yet. Old .from() calls keep working in parallel.
--
--   Phase 2 (frontend PR) — migrate 9 call sites across 5 files from
--     .from('matview') to supabase.rpc('get_matview', ...).
--
--   Phase 3 (separate migration) — REVOKE SELECT on all 7 matviews
--     from anon, authenticated. Lint count drops 7 → 0. Receipt.
--
-- `lap_2_gate_metrics_daily` is intentionally NOT wrapped — it's an
-- ops/CI-internal pilot-gate matview with zero frontend callers; it
-- gets REVOKE-only treatment in Phase 3.
--
-- Pattern derivation: matches existing project canon for
-- SECURITY DEFINER wrappers with inline membership gates (e.g.
-- `iris_kb_record_retrieve` in 20261008000005, `kb_retrieve` in
-- 20261008000002). Uses `SET search_path = public` (Stage-2
-- `function_search_path_mutable` lint) and the project-members
-- EXISTS-subquery gate (matches `is_project_member()` but inlined to
-- avoid composing two SECURITY DEFINER calls and keep the predicate
-- in one well-indexed query plan).
--
-- Why SECURITY DEFINER (not INVOKER): after Phase 3's REVOKE, the
-- authenticated role cannot SELECT the matview directly; the wrapper
-- must run as definer (postgres, the owner) to reach the matview rows.
-- The membership check then narrows the result set to what the caller
-- is allowed to see.
--
-- Why `p_project_id uuid DEFAULT NULL`: a single signature handles
-- both "fetch one project" (single-row dashboard widget) and "fetch
-- all my projects" (portfolio view) call patterns without forcing two
-- RPCs per matview. When NULL, the EXISTS predicate alone narrows to
-- member-only rows; when set, it also pins to that one project_id.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. get_project_metrics (org-filter widened — joins projects for org gate
--    since the matview has no organization_id column directly)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_project_metrics(
  p_project_id      uuid DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL
)
RETURNS SETOF public.project_metrics
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
    FROM public.project_metrics m
    JOIN public.projects p ON p.id = m.project_id
   WHERE (p_project_id      IS NULL OR m.project_id      = p_project_id)
     AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
     AND EXISTS (
       SELECT 1 FROM public.project_members pm
        WHERE pm.user_id    = (SELECT auth.uid())
          AND pm.project_id = m.project_id
     );
$$;

REVOKE ALL ON FUNCTION public.get_project_metrics(uuid, uuid) FROM PUBLIC;
-- Supabase's `public` schema has ALTER DEFAULT PRIVILEGES granting
-- EXECUTE on new functions to {anon, authenticated, service_role}.
-- REVOKE FROM PUBLIC removes the PUBLIC pseudo-role but leaves the
-- explicit role grants in place — so anon would still have EXECUTE,
-- which the Supabase advisor flags as anon_security_definer_executable.
-- Explicitly revoke from anon to keep the advisor lint count stable
-- across Day 2 (no regression on this WARN family).
REVOKE EXECUTE ON FUNCTION public.get_project_metrics(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_project_metrics(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_project_metrics(uuid, uuid) IS
  'BRT sub-0 day-2 P0-A wrapper for project_metrics. p_organization_id '
  'joins projects to gate by org; p_project_id pins one project. Both '
  'optional. Membership EXISTS gate filters to caller-accessible projects.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. get_project_health_summary (org-filter widened — matview has the
--    organization_id column directly so no join needed)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_project_health_summary(
  p_project_id      uuid DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL
)
RETURNS SETOF public.project_health_summary
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
    FROM public.project_health_summary m
   WHERE (p_project_id      IS NULL OR m.project_id      = p_project_id)
     AND (p_organization_id IS NULL OR m.organization_id = p_organization_id)
     AND EXISTS (
       SELECT 1 FROM public.project_members pm
        WHERE pm.user_id    = (SELECT auth.uid())
          AND pm.project_id = m.project_id
     );
$$;

REVOKE ALL ON FUNCTION public.get_project_health_summary(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_project_health_summary(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_project_health_summary(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_project_health_summary(uuid, uuid) IS
  'BRT sub-0 day-2 P0-A wrapper for project_health_summary. Both filters '
  'optional. Direct organization_id filter (matview has the column).';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. get_submittals_log_mv  (Bugatti widened — high-selectivity filters
--    pushed INTO the SECURITY DEFINER body. The planner cannot inline
--    SD functions, so chaining filters on top via PostgREST keeps the
--    full matview row set materialized then filters — wasteful at scale.
--    Status/kind/due-range live inside the SQL. Sparse filters
--    (csi_section, responsible_sub_id, current_reviewer_id,
--    is_critical_path, risk_band overdue, iris_preflight_findings, the
--    search ilike) chain client-side via .eq()/.in()/.or() on the
--    RPC's SETOF return — PostgREST supports that.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_submittals_log_mv(
  p_project_id uuid,
  p_status     text[]           DEFAULT NULL,
  p_kind       submittal_kind[] DEFAULT NULL,
  p_due_from   date             DEFAULT NULL,
  p_due_to     date             DEFAULT NULL
)
RETURNS SETOF public.submittals_log_mv
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
    FROM public.submittals_log_mv m
   WHERE m.project_id = p_project_id
     AND EXISTS (
       SELECT 1 FROM public.project_members pm
        WHERE pm.user_id    = (SELECT auth.uid())
          AND pm.project_id = p_project_id
     )
     AND (p_status   IS NULL OR m.status                 = ANY (p_status))
     AND (p_kind     IS NULL OR m.kind                   = ANY (p_kind))
     AND (p_due_from IS NULL OR m.required_on_site_date >= p_due_from)
     AND (p_due_to   IS NULL OR m.required_on_site_date <= p_due_to);
$$;

REVOKE ALL     ON FUNCTION public.get_submittals_log_mv(uuid, text[], submittal_kind[], date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_submittals_log_mv(uuid, text[], submittal_kind[], date, date) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_submittals_log_mv(uuid, text[], submittal_kind[], date, date) TO authenticated;

COMMENT ON FUNCTION public.get_submittals_log_mv(uuid, text[], submittal_kind[], date, date) IS
  'BRT sub-0 day-2 P0-A wrapper for submittals_log_mv. 5-arg Bugatti form: '
  'status/kind/due-range filters pushed into SQL. Sparse filters chain '
  'client-side via PostgREST on the RPC return.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. get_rfi_kpi_rollup
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_rfi_kpi_rollup(p_project_id uuid DEFAULT NULL)
RETURNS SETOF public.rfi_kpi_rollup
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
    FROM public.rfi_kpi_rollup m
   WHERE (p_project_id IS NULL OR m.project_id = p_project_id)
     AND EXISTS (
       SELECT 1 FROM public.project_members pm
        WHERE pm.user_id    = (SELECT auth.uid())
          AND pm.project_id = m.project_id
     );
$$;

REVOKE ALL ON FUNCTION public.get_rfi_kpi_rollup(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_rfi_kpi_rollup(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_rfi_kpi_rollup(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_rfi_kpi_rollup(uuid) IS
  'BRT sub-0 day-2 P0-A wrapper for rfi_kpi_rollup. Dormant — no '
  'current frontend callers; created defensively so Phase 3 REVOKE '
  'is uniform across all 6 client-facing matviews.';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. get_punch_list_status_rollup
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_punch_list_status_rollup(p_project_id uuid DEFAULT NULL)
RETURNS SETOF public.punch_list_status_rollup
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
    FROM public.punch_list_status_rollup m
   WHERE (p_project_id IS NULL OR m.project_id = p_project_id)
     AND EXISTS (
       SELECT 1 FROM public.project_members pm
        WHERE pm.user_id    = (SELECT auth.uid())
          AND pm.project_id = m.project_id
     );
$$;

REVOKE ALL ON FUNCTION public.get_punch_list_status_rollup(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_punch_list_status_rollup(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_punch_list_status_rollup(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_punch_list_status_rollup(uuid) IS
  'BRT sub-0 day-2 P0-A wrapper for punch_list_status_rollup. Dormant — '
  'no current frontend callers; defensive wrapper for uniform Phase 3.';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. get_pay_app_status_summary
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_pay_app_status_summary(p_project_id uuid DEFAULT NULL)
RETURNS SETOF public.pay_app_status_summary
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
    FROM public.pay_app_status_summary m
   WHERE (p_project_id IS NULL OR m.project_id = p_project_id)
     AND EXISTS (
       SELECT 1 FROM public.project_members pm
        WHERE pm.user_id    = (SELECT auth.uid())
          AND pm.project_id = m.project_id
     );
$$;

REVOKE ALL ON FUNCTION public.get_pay_app_status_summary(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pay_app_status_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pay_app_status_summary(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_pay_app_status_summary(uuid) IS
  'BRT sub-0 day-2 P0-A wrapper for pay_app_status_summary. Dormant — '
  'no current frontend callers; defensive wrapper for uniform Phase 3.';
