-- =============================================================================
-- Security advisor follow-up (round 2)
--
-- After applying the 19 May-4/May-7+ migrations, two new ERROR-level advisors
-- surfaced:
--   1. auth_users_exposed on submittals_log_mv — the MV's LEFT JOIN to
--      auth.users exposes auth.users.email to authenticated callers.
--   2. rls_disabled_in_public on drafted_action_dedupe — internal bookkeeping
--      table left without RLS by 20260504020001.
--
-- This migration:
--   - Rebuilds submittals_log_mv without the auth.users join. Reviewer name
--     comes solely from public.profiles (auto-created via trigger on signup,
--     20260428000010_auto_create_profile). Drops current_reviewer_email
--     because exposing it via a public-schema MV is the violation; UI that
--     needs the email can resolve it via a SECURITY DEFINER RPC if needed.
--   - Enables RLS on drafted_action_dedupe with a service-role-only policy
--     (this table is queue bookkeeping; only the worker writes to it).
-- =============================================================================

-- ── 1. Rebuild submittals_log_mv without auth.users ─────────────────────────

DROP MATERIALIZED VIEW IF EXISTS public.submittals_log_mv CASCADE;

CREATE MATERIALIZED VIEW public.submittals_log_mv AS
SELECT
    s.id,
    s.project_id,
    s.number,
    s.title,
    s.kind,
    s.status,
    s.csi_division,
    s.csi_section,
    s.spec_section_paragraph,
    s.spec_pdf_page,
    s.required_on_site_date,
    s.submit_by_date,
    s.lead_time_weeks,
    s.is_critical_path,
    s.is_federal,
    s.responsible_sub_id,
    s.current_reviewer_id,
    s.current_reviewer_role,
    s.ball_in_court_since,
    s.rev_number,
    s.is_soft_pilot,
    s.iris_preflight_score,
    s.iris_preflight_findings,
    s.is_private,
    s.confirmed_delivery_date,
    s.actual_delivery_date,
    s.anticipated_delivery_date,
    s.submittal_package_id,
    s.parent_submittal_id,
    s.created_at,
    s.created_by,
    s.updated_at,
    s.deleted_at,
    org_sub.name AS sub_name,
    profile_reviewer.full_name AS current_reviewer_name,
    CASE
        WHEN s.ball_in_court_since IS NULL THEN NULL::integer
        ELSE EXTRACT(day FROM now() - s.ball_in_court_since)::integer
    END AS days_in_court,
    CASE
        WHEN s.required_on_site_date IS NULL THEN 'unscheduled'::text
        WHEN s.required_on_site_date < CURRENT_DATE
             AND COALESCE(s.status, ''::text) <> ALL (ARRAY['approved'::text, 'closed'::text]) THEN 'overdue'::text
        WHEN COALESCE(s.submit_by_date, s.due_date) IS NOT NULL
             AND COALESCE(s.submit_by_date, s.due_date) < CURRENT_DATE
             AND COALESCE(s.status, ''::text) = 'draft'::text THEN 'submit_overdue'::text
        WHEN (s.required_on_site_date - CURRENT_DATE) < 7
             AND COALESCE(s.status, ''::text) <> ALL (ARRAY['approved'::text, 'closed'::text]) THEN 'at_risk'::text
        ELSE 'on_track'::text
    END AS risk_band
FROM public.submittals s
LEFT JOIN public.organizations org_sub ON org_sub.id = s.responsible_sub_id
LEFT JOIN public.profiles profile_reviewer ON profile_reviewer.id = s.current_reviewer_id
WHERE s.deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_submittals_log_mv_id
  ON public.submittals_log_mv (id);
CREATE INDEX IF NOT EXISTS idx_submittals_log_mv_project_status
  ON public.submittals_log_mv (project_id, status);
CREATE INDEX IF NOT EXISTS idx_submittals_log_mv_risk_band
  ON public.submittals_log_mv (project_id, risk_band)
  WHERE risk_band IN ('overdue','submit_overdue','at_risk');

COMMENT ON MATERIALIZED VIEW public.submittals_log_mv IS
  'Submittals list surface. Rebuilt by 20260508010000 to drop auth.users join '
  '(advisor: auth_users_exposed). Reviewer name now sourced exclusively from '
  'public.profiles. Email lookup, if needed, must go through a SECURITY '
  'DEFINER RPC.';

-- Refresh trigger from 20260507000002 references this MV by name; it stays
-- valid through DROP+CREATE because we recreated with the same name.

-- ── 2. Enable RLS on drafted_action_dedupe ──────────────────────────────────

ALTER TABLE public.drafted_action_dedupe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_only ON public.drafted_action_dedupe;
CREATE POLICY service_role_only ON public.drafted_action_dedupe
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.drafted_action_dedupe IS
  'Worker bookkeeping for at-most-once draft action delivery. RLS enabled '
  'and service-role-only by 20260508010000 (was: rls_disabled_in_public).';
