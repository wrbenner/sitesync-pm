-- Iris Telemetry — Lap 2 gate instrumentation for drafted_actions.
--
-- The Day 60 Lap 2 gate measures four things:
--   1. ≥ 100 drafts approved at the soft-pilot GC
--   2. ≥ 70% acceptance rate
--   3. ≤ 90s average time-to-approve
--   4. Zero security/audit incidents
--
-- (3) is impossible against the existing schema because nothing records
-- when the user actually *saw* the draft. Time-to-approve must be
-- measured from `first_viewed_at`, not `created_at`, or "approved 8h
-- after creation because the user opened the inbox at 8 AM" looks the
-- same as "approved 8h after creation because the user took 8h to
-- decide."
--
-- This migration adds the columns, RPCs, indexes, and a daily-snapshot
-- materialized view that the CI gate workflow asserts against.
--
-- Reference: docs/audits/IRIS_TELEMETRY_SPEC_2026-05-04.md
-- ADR:       docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md
--
-- Notes on naming:
--   * The spec proposes `viewer_user_id` (UUID → auth.users). The
--     existing table already has `decided_by` carrying that exact
--     semantic at decision time, so we DO NOT add a duplicate column.
--     The materialized view aliases `decided_by` → viewer for clarity.
--   * Direct UPDATE on telemetry columns by users is blocked via a
--     trigger gated on a per-tx GUC; the two SECURITY DEFINER RPCs
--     toggle the GUC for the duration of their write.

BEGIN;

-- ── Phase 1: columns ──────────────────────────────────────────────────

ALTER TABLE public.drafted_actions
  -- When the user first rendered this draft on screen.
  -- Set by client when the draft card scrolls into view.
  ADD COLUMN IF NOT EXISTS first_viewed_at  timestamptz,

  -- Total render-into-view count. Increments every time the draft is
  -- scrolled into view (deduped per inbox session by the client).
  ADD COLUMN IF NOT EXISTS viewed_count     integer NOT NULL DEFAULT 0,

  -- How the user interacted to decide this draft. Set by record_draft_decision.
  ADD COLUMN IF NOT EXISTS decision_method  text
    CHECK (decision_method IN ('keyboard','mouse','voice','unknown'))
    DEFAULT 'unknown',

  -- True if the user opened the inline edit panel and changed the payload
  -- before approving. A draft accepted with edits counts as "approved" for
  -- the gate but is broken out in the dashboard.
  ADD COLUMN IF NOT EXISTS required_edits   boolean NOT NULL DEFAULT FALSE,

  -- Stable client-side session id for the inbox session the decision
  -- was made in. Lets us answer "how many drafts did the user decide
  -- in one sitting" without joining to a sessions table.
  ADD COLUMN IF NOT EXISTS inbox_session_id uuid;

-- Generated columns. Stored once at write time; the materialized view
-- and downstream cohort queries hit the index, not a recompute.
ALTER TABLE public.drafted_actions
  ADD COLUMN IF NOT EXISTS time_to_first_view_ms integer GENERATED ALWAYS AS (
    CASE
      WHEN first_viewed_at IS NULL OR created_at IS NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM (first_viewed_at - created_at)) * 1000)::integer
    END
  ) STORED,

  ADD COLUMN IF NOT EXISTS time_to_decide_ms integer GENERATED ALWAYS AS (
    CASE
      WHEN decided_at IS NULL OR first_viewed_at IS NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM (decided_at - first_viewed_at)) * 1000)::integer
    END
  ) STORED;

COMMENT ON COLUMN public.drafted_actions.first_viewed_at IS
  'When the draft first scrolled into the user''s viewport. Source of truth for time-to-approve. Set only via record_draft_view RPC.';
COMMENT ON COLUMN public.drafted_actions.viewed_count IS
  'Render-into-view count, deduped per inbox session by the client. Iris-gate diagnostic for "user keeps coming back to this draft".';
COMMENT ON COLUMN public.drafted_actions.decision_method IS
  'How the user decided (keyboard|mouse|voice|unknown). Set by record_draft_decision RPC.';
COMMENT ON COLUMN public.drafted_actions.required_edits IS
  'TRUE if the user opened the edit panel and modified the payload before approving.';
COMMENT ON COLUMN public.drafted_actions.inbox_session_id IS
  'Stable per-inbox-mount UUID set by the client. Different from auth session.';
COMMENT ON COLUMN public.drafted_actions.time_to_decide_ms IS
  'Milliseconds from first_viewed_at to decided_at. Generated, stored.';
COMMENT ON COLUMN public.drafted_actions.time_to_first_view_ms IS
  'Milliseconds from created_at to first_viewed_at. Generated, stored.';

-- ── Phase 1b: indexes ────────────────────────────────────────────────

-- Lap 2 gate query is "drafts decided in window 60d"; this index supports it.
CREATE INDEX IF NOT EXISTS idx_drafted_actions_decided_at_status
  ON public.drafted_actions (decided_at, status)
  WHERE decided_at IS NOT NULL;

-- Per-user aggregation. The spec calls this `viewer_user_id`; we use
-- the existing `decided_by` column instead.
CREATE INDEX IF NOT EXISTS idx_drafted_actions_decided_by_at
  ON public.drafted_actions (decided_by, decided_at)
  WHERE decided_by IS NOT NULL;

-- "How long did this inbox session take" lookups.
CREATE INDEX IF NOT EXISTS idx_drafted_actions_inbox_session
  ON public.drafted_actions (inbox_session_id)
  WHERE inbox_session_id IS NOT NULL;

-- ── Phase 1c: telemetry-tamper guard ─────────────────────────────────
-- Existing UPDATE policy (`drafted_actions_update_member`) lets project
-- members write to the table — that's correct for status/decided_at/
-- decision_note, which the approve/reject mutation owns. But pure
-- telemetry columns (first_viewed_at, viewed_count, decision_method,
-- required_edits, inbox_session_id) must come ONLY from the SECURITY
-- DEFINER RPCs below — otherwise a user could spoof their own latency
-- numbers. A trigger guards them, gated on a per-tx GUC the RPCs flip.

CREATE OR REPLACE FUNCTION public.drafted_actions_guard_telemetry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_via_rpc text := current_setting('sitesync.drafted_actions_telemetry_via_rpc', true);
BEGIN
  -- The record_draft_view / record_draft_decision RPCs set this GUC
  -- inside their transaction; everything else falls through to the guard.
  IF v_via_rpc = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.first_viewed_at IS DISTINCT FROM OLD.first_viewed_at THEN
    RAISE EXCEPTION 'first_viewed_at must be set via record_draft_view RPC';
  END IF;
  IF NEW.viewed_count IS DISTINCT FROM OLD.viewed_count THEN
    RAISE EXCEPTION 'viewed_count must be set via record_draft_view RPC';
  END IF;
  IF NEW.inbox_session_id IS DISTINCT FROM OLD.inbox_session_id THEN
    RAISE EXCEPTION 'inbox_session_id must be set via record_draft_view RPC';
  END IF;
  IF NEW.decision_method IS DISTINCT FROM OLD.decision_method THEN
    RAISE EXCEPTION 'decision_method must be set via record_draft_decision RPC';
  END IF;
  IF NEW.required_edits IS DISTINCT FROM OLD.required_edits THEN
    RAISE EXCEPTION 'required_edits must be set via record_draft_decision RPC';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drafted_actions_guard_telemetry ON public.drafted_actions;
CREATE TRIGGER drafted_actions_guard_telemetry
  BEFORE UPDATE ON public.drafted_actions
  FOR EACH ROW EXECUTE FUNCTION public.drafted_actions_guard_telemetry();

-- ── Phase 2: RPCs (the only client write path for telemetry) ─────────

-- Set first_viewed_at the first time a draft enters the viewport.
-- Idempotent: if already set, only increments viewed_count.
-- Membership check mirrors the existing SELECT/UPDATE RLS policies.
CREATE OR REPLACE FUNCTION public.record_draft_view(
  p_draft_id   uuid,
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_project_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT project_id INTO v_project_id
    FROM public.drafted_actions
    WHERE id = p_draft_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = v_project_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  -- Open the telemetry-write window for this transaction so the BEFORE
  -- UPDATE guard lets the write through.
  PERFORM set_config(
    'sitesync.drafted_actions_telemetry_via_rpc', 'on', true /* is_local */
  );

  UPDATE public.drafted_actions
    SET first_viewed_at  = COALESCE(first_viewed_at, NOW()),
        viewed_count     = viewed_count + 1,
        inbox_session_id = COALESCE(inbox_session_id, p_session_id)
    WHERE id = p_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_draft_view(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_draft_view(uuid, uuid) TO authenticated;

-- Stamp decision metadata at approve/reject time. Called from the
-- existing approve/reject mutation alongside the status update —
-- this RPC does NOT touch status, decided_at, or decided_by (the
-- mutation owns those). Only writes the decision-method telemetry.
CREATE OR REPLACE FUNCTION public.record_draft_decision(
  p_draft_id        uuid,
  p_decision_method text,
  p_required_edits  boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_project_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  IF p_decision_method NOT IN ('keyboard','mouse','voice','unknown') THEN
    RAISE EXCEPTION 'Invalid decision_method: %', p_decision_method;
  END IF;

  SELECT project_id INTO v_project_id
    FROM public.drafted_actions
    WHERE id = p_draft_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = v_project_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  PERFORM set_config(
    'sitesync.drafted_actions_telemetry_via_rpc', 'on', true /* is_local */
  );

  -- Only write when the row has reached a terminal decision state. If the
  -- approve/reject mutation hasn't landed yet, this is a no-op (filter
  -- returns 0 rows; the client's caller-order is "update status, then
  -- record decision telemetry").
  UPDATE public.drafted_actions
    SET decision_method = p_decision_method,
        required_edits  = p_required_edits
    WHERE id = p_draft_id
      AND status IN ('approved','rejected','executed','failed');
END;
$$;

REVOKE ALL ON FUNCTION public.record_draft_decision(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_draft_decision(uuid, text, boolean) TO authenticated;

-- ── Phase 3: daily aggregation snapshot ──────────────────────────────
-- The CI gate queries this view; it must be:
--   * cheap to read (so the gate is a single round-trip)
--   * safe to refresh CONCURRENTLY (so refreshes don't block reads)
--   * tolerant of an empty pilot org (returns one zero-row, never errors).
--
-- The spec hard-codes a placeholder pilot-org slug. Until the soft pilot
-- is recruited (see SOFT_PILOT_PLAYBOOK), the view returns:
--   approved_count = 0, acceptance_rate_pct = NULL, avg_time_to_approve_sec = NULL
-- which is the correct CI signal: gate FAILS until real pilot data lands.

DROP MATERIALIZED VIEW IF EXISTS public.lap_2_gate_metrics_daily;

CREATE MATERIALIZED VIEW public.lap_2_gate_metrics_daily AS
WITH window_start AS (
  -- Lap 2 starts ~2026-06-04 (Day 31, assuming Lap 1 closed 2026-05-04).
  -- Pre-Day-31 rows are explicitly excluded so the gate window is clean.
  SELECT TIMESTAMPTZ '2026-06-04 00:00:00+00' AS lap_2_start
),
pilot_org AS (
  -- The soft-pilot GC's organization id. To be filled in once recruited
  -- (see docs/audits/SOFT_PILOT_PLAYBOOK_2026-05-04.md). Until then, the
  -- view returns one zero-row instead of failing.
  SELECT id AS org_id FROM public.organizations WHERE slug = 'soft-pilot-gc-tbd'
),
decided_in_window AS (
  SELECT da.*
    FROM public.drafted_actions da
    JOIN public.projects p   ON p.id = da.project_id
    JOIN pilot_org po        ON po.org_id = p.organization_id
    JOIN window_start ws     ON da.decided_at >= ws.lap_2_start
   WHERE da.status IN ('approved','rejected','executed')
     AND da.decided_at IS NOT NULL
)
SELECT
  CURRENT_DATE AS metric_date,

  -- Gate metric 1: approved drafts since Lap 2 start.
  -- Per LAP_2_ACCEPTANCE_GATE_SPEC § Gate 1: a "ghost approval" (status
  -- approved/executed but first_viewed_at IS NULL) does NOT count. It
  -- simultaneously trips Gate 4 as a security incident, but here it is
  -- excluded so the count metric stays honest.
  COUNT(*) FILTER (
    WHERE status IN ('approved','executed')
      AND first_viewed_at IS NOT NULL
  ) AS approved_count,

  -- Gate metric 2: acceptance rate.
  -- Numerator: real approvals (matches Gate 1).
  -- Denominator: real approvals + user-driven rejections.
  --   Auto-withdrawn drafts (decision_note like '[withdrawn by system]%')
  --   are excluded from BOTH sides per the spec — the user never had a
  --   real chance to decide. Aged-out drafts ('[aged out:%') count as
  --   soft-rejections and remain in the denominator.
  CASE
    WHEN (
      COUNT(*) FILTER (
        WHERE status IN ('approved','executed')
          AND first_viewed_at IS NOT NULL
      )
      + COUNT(*) FILTER (
        WHERE status = 'rejected'
          AND (decision_note IS NULL
               OR decision_note NOT LIKE '[withdrawn by system]%')
      )
    ) = 0 THEN NULL
    ELSE
      ROUND(
        100.0 * COUNT(*) FILTER (
          WHERE status IN ('approved','executed')
            AND first_viewed_at IS NOT NULL
        )
        / NULLIF(
          COUNT(*) FILTER (
            WHERE status IN ('approved','executed')
              AND first_viewed_at IS NOT NULL
          )
          + COUNT(*) FILTER (
            WHERE status = 'rejected'
              AND (decision_note IS NULL
                   OR decision_note NOT LIKE '[withdrawn by system]%')
          ),
          0
        ),
        2
      )
  END AS acceptance_rate_pct,

  -- Gate metric 3: average time-to-approve in seconds.
  -- Drafts without first_viewed_at are excluded by construction
  -- (time_to_decide_ms is NULL when first_viewed_at is NULL). Outliers
  -- > 30 minutes are excluded as bias-correction (per spec § Gate 3).
  ROUND(
    (AVG(time_to_decide_ms / 1000.0) FILTER (
      WHERE status IN ('approved','executed')
        AND time_to_decide_ms IS NOT NULL
        AND time_to_decide_ms <= 30 * 60 * 1000
    ))::numeric,
    1
  ) AS avg_time_to_approve_sec,

  -- Diagnostic: drafts with > 30-minute decision latency, excluded
  -- from the average but visible in the dashboard.
  COUNT(*) FILTER (
    WHERE status IN ('approved','executed')
      AND time_to_decide_ms > 30 * 60 * 1000
  ) AS long_decision_count,

  -- Gate-4 signal: ghost approvals (security-incident class).
  COUNT(*) FILTER (
    WHERE status IN ('approved','executed')
      AND first_viewed_at IS NULL
  ) AS ghost_approval_count,

  -- Diagnostic: aged-out auto-rejections (count against rate but visible).
  COUNT(*) FILTER (
    WHERE status = 'rejected'
      AND decision_note LIKE '[aged out:%'
  ) AS aged_out_count,

  -- Diagnostic: auto-withdrawn (excluded from rate, visible).
  COUNT(*) FILTER (
    WHERE status = 'rejected'
      AND decision_note LIKE '[withdrawn by system]%'
  ) AS auto_withdrawn_count,

  -- Diagnostic breakdowns.
  COUNT(*) FILTER (WHERE required_edits) AS approved_with_edits_count,
  COUNT(*) FILTER (WHERE decision_method = 'keyboard') AS keyboard_decisions,
  COUNT(*) FILTER (WHERE decision_method = 'mouse')    AS mouse_decisions,

  -- Median as a sanity check on the average.
  ROUND(
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_to_decide_ms / 1000.0)
       FILTER (
         WHERE status IN ('approved','executed')
           AND time_to_decide_ms IS NOT NULL
           AND time_to_decide_ms <= 30 * 60 * 1000
       ))::numeric,
    1
  ) AS median_time_to_approve_sec,

  -- Volume per day (helpful for the "pilot week" daily target of ≥15).
  COUNT(*) FILTER (
    WHERE decided_at::date = CURRENT_DATE
      AND status IN ('approved','executed')
      AND first_viewed_at IS NOT NULL
  ) AS approved_today
FROM decided_in_window;

-- Unique index so REFRESH CONCURRENTLY works.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lap_2_gate_metrics_daily_date
  ON public.lap_2_gate_metrics_daily (metric_date);

COMMENT ON MATERIALIZED VIEW public.lap_2_gate_metrics_daily IS
  'Lap 2 acceptance-gate snapshot. Refreshed hourly via pg_cron. Returns one row keyed on metric_date. Read by .github/workflows/lap-2-acceptance.yml.';

-- ── Phase 3b: hourly refresh job ─────────────────────────────────────
-- Mirrors the no-op pattern from 20260502130000_portfolio_summary_refresh_cron.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron')
  ) THEN
    RAISE NOTICE 'pg_cron not installed — skipping refresh-lap-2-gate-metrics schedule.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-lap-2-gate-metrics') THEN
    PERFORM cron.unschedule('refresh-lap-2-gate-metrics');
  END IF;

  PERFORM cron.schedule(
    'refresh-lap-2-gate-metrics',
    '0 * * * *',
    $cron$REFRESH MATERIALIZED VIEW CONCURRENTLY public.lap_2_gate_metrics_daily$cron$
  );
END;
$$;

COMMIT;
