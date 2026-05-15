-- ═══════════════════════════════════════════════════════════════
-- Migration: get_dashboard_payload_rpc
-- Version: 20261029000001
-- FMEA: P.WIDGET.1 (Wave 4) — dashboard widgets each fetch own metrics
--
-- Hazard partially closed:
--   The dashboard mounts ~6 widgets, each running its own useQuery
--   against Supabase. First paint of /dashboard fires ≥ 6 parallel
--   REST calls. We introduce a single batched RPC that returns
--   widget payloads in one round-trip. Two highest-traffic widgets
--   (DashboardCompliance, DashboardPortfolio) wire to it in this
--   patch; remaining widgets migrate in a follow-up.
--
-- Surface:
--   public.get_dashboard_payload(p_project_id uuid) returns jsonb
--   with keys: metrics, portfolio, compliance, critical_path,
--   carbon, earned_value. Each value is the per-widget projection
--   the widget needs to render (or {} if the underlying query is
--   not yet wired into the RPC body).
--
--   The function is SECURITY DEFINER + membership-gated so it
--   matches the per-widget RLS contracts (callers must be a member
--   of the project).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_dashboard_payload(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_is_member  boolean;
  v_today      date := (now() at time zone 'UTC')::date;
  v_in_30      date := ((now() at time zone 'UTC') + interval '30 days')::date;
  v_compliance jsonb;
  v_portfolio  jsonb;
  v_metrics    jsonb;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object(
      'metrics',       '{}'::jsonb,
      'portfolio',     '{}'::jsonb,
      'compliance',    '{}'::jsonb,
      'critical_path', '{}'::jsonb,
      'carbon',        '{}'::jsonb,
      'earned_value',  '{}'::jsonb
    );
  END IF;

  -- Membership gate — mirrors get_project_metrics shape.
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
     WHERE pm.user_id    = (SELECT auth.uid())
       AND pm.project_id = p_project_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    -- Empty payload — RLS-equivalent. The widgets degrade gracefully
    -- on empty objects.
    RETURN jsonb_build_object(
      'metrics',       '{}'::jsonb,
      'portfolio',     '{}'::jsonb,
      'compliance',    '{}'::jsonb,
      'critical_path', '{}'::jsonb,
      'carbon',        '{}'::jsonb,
      'earned_value',  '{}'::jsonb
    );
  END IF;

  -- ── Compliance widget projection ──────────────────────────────
  -- Expiring permits, COIs (next 30d), failed / overdue inspections.
  SELECT jsonb_build_object(
    'permits',     COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'type', p.type, 'permit_number', p.permit_number,
        'expiration_date', p.expiration_date
      ) ORDER BY p.expiration_date ASC)
        FROM public.permits p
       WHERE p.project_id = p_project_id
         AND p.expiration_date IS NOT NULL
         AND p.expiration_date <= v_in_30
    ), '[]'::jsonb),
    'certs',       COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'company', c.company, 'policy_type', c.policy_type,
        'expiration_date', c.expiration_date
      ) ORDER BY c.expiration_date ASC)
        FROM public.insurance_certificates c
       WHERE c.project_id = p_project_id
         AND c.expiration_date IS NOT NULL
         AND c.expiration_date <= v_in_30
    ), '[]'::jsonb),
    'inspections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', si.id, 'type', si.type, 'date', si.date, 'status', si.status
      ) ORDER BY si.date DESC)
        FROM (
          SELECT id, type, date, status
            FROM public.safety_inspections
           WHERE project_id = p_project_id
             AND status IN ('failed', 'corrective_action_required', 'scheduled')
             AND date <= v_today
           ORDER BY date DESC
           LIMIT 10
        ) si
    ), '[]'::jsonb)
  ) INTO v_compliance;

  -- ── Portfolio widget projection ───────────────────────────────
  -- Single-row project_metrics for this project.
  SELECT COALESCE(to_jsonb(m), '{}'::jsonb) INTO v_portfolio
    FROM public.project_metrics m
   WHERE m.project_id = p_project_id;

  -- ── Metrics top-level (re-uses portfolio row; widgets that
  --     need the same data read from the same key).
  v_metrics := v_portfolio;

  RETURN jsonb_build_object(
    'metrics',       v_metrics,
    'portfolio',     v_portfolio,
    'compliance',    v_compliance,
    -- Stubs for follow-up — widgets that migrate to the batched
    -- RPC will populate these projections in their own migration.
    'critical_path', '{}'::jsonb,
    'carbon',        '{}'::jsonb,
    'earned_value',  '{}'::jsonb
  );

EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    -- Defensive: if the underlying tables / matview are not yet
    -- deployed (e.g. local dev without project_metrics), return
    -- empty payload rather than failing the entire dashboard.
    RETURN jsonb_build_object(
      'metrics',       '{}'::jsonb,
      'portfolio',     '{}'::jsonb,
      'compliance',    '{}'::jsonb,
      'critical_path', '{}'::jsonb,
      'carbon',        '{}'::jsonb,
      'earned_value',  '{}'::jsonb
    );
END;
$func$;

REVOKE ALL ON FUNCTION public.get_dashboard_payload(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_payload(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_payload(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_payload(uuid) IS
  'FMEA P.WIDGET.1 (Wave 4): batched dashboard payload. Returns a JSONB '
  'object keyed by widget name (compliance, portfolio, metrics, etc). '
  'Membership-gated. Two widgets (Compliance, Portfolio) wire to this '
  'RPC; remaining widgets migrate in follow-up.';
