-- BRT sub-0 Day 0 — live-vs-repo sync
--
-- Reconciles two classes of drift between the live Supabase project
-- (hypxrmcppjfbtlwuoafc — "ss pm") and this repo's migrations, captured by
-- direct queries against the live project on 2026-05-12:
--
--   1. Two materialized views (`submittals_log_mv`, `lap_2_gate_metrics_daily`)
--      exist in live but have no declaration in supabase/migrations/. They
--      were created via the dashboard or via a migration that was later
--      removed. Without these declarations, `supabase db reset` produces a
--      local DB that doesn't match live, and Day 2's matview lockdown
--      migration would silently no-op for them.
--
--   2. Eight storage buckets exist in live but have no declaration in repo:
--      attachments, daily-log-photos, daily-log-signatures, documents,
--      punch-list-photos, reports, safety-photos, submittal-specs. These
--      are the same 8 buckets flagged by Stage-2 audit P0-F as cross-tenant
--      (single permissive `bucket_id = 'X' AND auth.uid() IS NOT NULL`
--      policy). Day 3b will fix the policies; this migration just
--      declares the bucket rows so a fresh `supabase db reset` matches
--      live.
--
-- DDL sourced verbatim from `pg_get_viewdef` against live on 2026-05-12.
-- All statements use IF NOT EXISTS / ON CONFLICT so the migration is
-- idempotent — safe to apply against an environment that already has
-- some or all of these objects.

-- ─────────────────────────────────────────────────────────────────────────
-- Materialized views
-- ─────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS public.submittals_log_mv AS
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
    ELSE (EXTRACT(day FROM (now() - s.ball_in_court_since)))::integer
  END AS days_in_court,
  CASE
    WHEN s.required_on_site_date IS NULL THEN 'unscheduled'::text
    WHEN s.required_on_site_date < CURRENT_DATE
         AND COALESCE(s.status, ''::text) <> ALL (ARRAY['approved'::text, 'closed'::text])
      THEN 'overdue'::text
    WHEN COALESCE(s.submit_by_date, s.due_date) IS NOT NULL
         AND COALESCE(s.submit_by_date, s.due_date) < CURRENT_DATE
         AND COALESCE(s.status, ''::text) = 'draft'::text
      THEN 'submit_overdue'::text
    WHEN (s.required_on_site_date - CURRENT_DATE) < 7
         AND COALESCE(s.status, ''::text) <> ALL (ARRAY['approved'::text, 'closed'::text])
      THEN 'at_risk'::text
    ELSE 'on_track'::text
  END AS risk_band
FROM submittals s
LEFT JOIN organizations org_sub ON org_sub.id = s.responsible_sub_id
LEFT JOIN profiles profile_reviewer ON profile_reviewer.id = s.current_reviewer_id
WHERE s.deleted_at IS NULL;

COMMENT ON MATERIALIZED VIEW public.submittals_log_mv IS
  'Submittals log with org + reviewer name joins and a derived risk_band. '
  'Refreshed via cron (see refresh_materialized_view jobs). Day 2 lockdown '
  'will REVOKE SELECT from anon, authenticated and gate access through a '
  'project-membership wrapper RPC.';

CREATE MATERIALIZED VIEW IF NOT EXISTS public.lap_2_gate_metrics_daily AS
WITH window_start AS (
  SELECT '2026-06-04 00:00:00+00'::timestamptz AS lap_2_start
),
pilot_org AS (
  SELECT organizations.id AS org_id
    FROM organizations
   WHERE organizations.slug = 'soft-pilot-gc-tbd'::text
),
decided_in_window AS (
  SELECT
    da.id,
    da.project_id,
    da.action_type,
    da.title,
    da.summary,
    da.payload,
    da.citations,
    da.confidence,
    da.status,
    da.drafted_by,
    da.draft_reason,
    da.related_resource_type,
    da.related_resource_id,
    da.executed_resource_type,
    da.executed_resource_id,
    da.execution_result,
    da.decided_by,
    da.decided_at,
    da.decision_note,
    da.executed_at,
    da.created_at,
    da.updated_at,
    da.first_viewed_at,
    da.viewed_count,
    da.decision_method,
    da.required_edits,
    da.inbox_session_id,
    da.time_to_first_view_ms,
    da.time_to_decide_ms
  FROM drafted_actions da
  JOIN projects p ON p.id = da.project_id
  JOIN pilot_org po ON po.org_id = p.organization_id
  JOIN window_start ws ON da.decided_at >= ws.lap_2_start
  WHERE da.status = ANY (ARRAY['approved'::text, 'rejected'::text, 'executed'::text])
    AND da.decided_at IS NOT NULL
)
SELECT
  CURRENT_DATE AS metric_date,
  count(*) FILTER (WHERE status = ANY (ARRAY['approved'::text, 'executed'::text])
                     AND first_viewed_at IS NOT NULL) AS approved_count,
  CASE
    WHEN (count(*) FILTER (WHERE status = ANY (ARRAY['approved'::text, 'executed'::text])
                             AND first_viewed_at IS NOT NULL)
        + count(*) FILTER (WHERE status = 'rejected'::text
                             AND (decision_note IS NULL OR decision_note NOT LIKE '[withdrawn by system]%'))) = 0
      THEN NULL::numeric
    ELSE round(
      (100.0 * (count(*) FILTER (WHERE status = ANY (ARRAY['approved'::text, 'executed'::text])
                                   AND first_viewed_at IS NOT NULL))::numeric)
      / NULLIF((count(*) FILTER (WHERE status = ANY (ARRAY['approved'::text, 'executed'::text])
                                   AND first_viewed_at IS NOT NULL)
              + count(*) FILTER (WHERE status = 'rejected'::text
                                   AND (decision_note IS NULL OR decision_note NOT LIKE '[withdrawn by system]%'))), 0)::numeric,
      2)
  END AS acceptance_rate_pct,
  round(avg(((time_to_decide_ms)::numeric / 1000.0))
        FILTER (WHERE status = ANY (ARRAY['approved'::text, 'executed'::text])
                  AND time_to_decide_ms IS NOT NULL
                  AND time_to_decide_ms <= (30 * 60 * 1000)),
        1) AS avg_time_to_approve_sec,
  count(*) FILTER (WHERE status = ANY (ARRAY['approved'::text, 'executed'::text])
                     AND time_to_decide_ms > (30 * 60 * 1000)) AS long_decision_count,
  count(*) FILTER (WHERE status = ANY (ARRAY['approved'::text, 'executed'::text])
                     AND first_viewed_at IS NULL) AS ghost_approval_count,
  count(*) FILTER (WHERE status = 'rejected'::text
                     AND decision_note LIKE '[aged out:%') AS aged_out_count,
  count(*) FILTER (WHERE status = 'rejected'::text
                     AND decision_note LIKE '[withdrawn by system]%') AS auto_withdrawn_count,
  count(*) FILTER (WHERE required_edits) AS approved_with_edits_count,
  count(*) FILTER (WHERE decision_method = 'keyboard'::text) AS keyboard_decisions,
  count(*) FILTER (WHERE decision_method = 'mouse'::text) AS mouse_decisions,
  round(
    (percentile_cont(0.5::double precision) WITHIN GROUP (
       ORDER BY (((time_to_decide_ms)::numeric / 1000.0))::double precision)
     FILTER (WHERE status = ANY (ARRAY['approved'::text, 'executed'::text])
               AND time_to_decide_ms IS NOT NULL
               AND time_to_decide_ms <= (30 * 60 * 1000)))::numeric,
    1) AS median_time_to_approve_sec,
  count(*) FILTER (WHERE (decided_at)::date = CURRENT_DATE
                     AND status = ANY (ARRAY['approved'::text, 'executed'::text])
                     AND first_viewed_at IS NOT NULL) AS approved_today
FROM decided_in_window;

COMMENT ON MATERIALIZED VIEW public.lap_2_gate_metrics_daily IS
  'Lap 2 acceptance-window metrics for the soft pilot org. Single-row '
  'rollup refreshed daily. Day 2 lockdown: this is ops-internal data and '
  'will not be exposed to authenticated callers — access will move behind '
  'an internal-role-only function or be removed from the PostgREST API '
  'surface entirely.';

-- ─────────────────────────────────────────────────────────────────────────
-- Storage buckets
-- ─────────────────────────────────────────────────────────────────────────
-- Bucket configuration mirrored from live on 2026-05-12. All marked
-- public=false except where flagged below. file_size_limit values match
-- production. allowed_mime_types is NULL (permissive) for these — Stage-2
-- audit P1-N flagged this; tightening is a follow-up slice, not Day 0.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('attachments',          'attachments',          false, 104857600, NULL),
  ('daily-log-photos',     'daily-log-photos',     false,  52428800, NULL),
  ('daily-log-signatures', 'daily-log-signatures', false,  10485760, NULL),
  ('documents',            'documents',            false, 104857600, NULL),
  -- Live state: public=true. This is a P0-F adjacent risk (punch list
  -- photos contain confidential construction site imagery and should not
  -- be world-readable). Day 3b will lock the policies to project
  -- membership, but the bucket-level `public` flag is a separate switch
  -- that lets unauthenticated CDN reads bypass policies entirely. Flip
  -- to false in a follow-up slice once Walker confirms no public
  -- consumers exist.
  ('punch-list-photos',    'punch-list-photos',    true,   52428800, NULL),
  ('reports',              'reports',              false, 104857600, NULL),
  ('safety-photos',        'safety-photos',        false,  52428800, NULL),
  ('submittal-specs',      'submittal-specs',      false, 104857600, NULL)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- Cross-tenant permissive policies on the 8 buckets above
-- ─────────────────────────────────────────────────────────────────────────
-- These policies are the P0-F finding — every authenticated user can
-- read/write/delete files across all tenants. We declare them here so a
-- fresh `supabase db reset` faithfully reproduces the (broken) production
-- state; Day 3b's migration will DROP these and replace them with
-- per-command, project-membership-scoped policies matching the existing
-- drawings / exports / field-captures / project-files pattern.

DO $$
DECLARE
  bkt TEXT;
  policy_name TEXT;
BEGIN
  FOREACH bkt IN ARRAY ARRAY[
    'attachments',
    'daily-log-photos',
    'daily-log-signatures',
    'documents',
    'punch-list-photos',
    'reports',
    'safety-photos',
    'submittal-specs'
  ] LOOP
    policy_name := 'storage_' || replace(bkt, '-', '_') || '_access';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'storage'
         AND tablename = 'objects'
         AND policyname = policy_name
    ) THEN
      EXECUTE format(
        $f$
        CREATE POLICY %I ON storage.objects
          FOR ALL TO public
          USING (bucket_id = %L AND auth.uid() IS NOT NULL)
        $f$,
        policy_name, bkt
      );
    END IF;
  END LOOP;
END;
$$;

-- NOTE: COMMENT ON POLICY on storage.objects is intentionally omitted here.
-- It requires supabase_storage_admin ownership, which the Supabase MCP
-- migration role does not have (fails with 42501). If you need to
-- document a storage.objects policy, do it via a markdown reference
-- (docs/audits/STORAGE_POLICIES_NOTES.md or the policy NAME itself)
-- rather than COMMENT ON POLICY. Otherwise db push --linked will abort
-- at this point on a clean re-apply.
--
-- Annotation that previously lived here: "BRT sub-0 Day 0 sync:
-- declaration of pre-existing cross-tenant policy. Replaced by
-- member-scoped policies in Day 3b migration."
