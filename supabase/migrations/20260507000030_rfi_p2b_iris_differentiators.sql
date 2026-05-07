-- ═══════════════════════════════════════════════════════════════
-- Migration: RFI P2b — Iris differentiators
-- Version:   20260507000030
--
-- Drives:    P2b spec — multi-pass Iris draft pipeline, scheduled
--            digest, voice-to-RFI, schedule-aware clock with
--            structured pause, Iris confidence telemetry.
--
-- Specs:     IRIS_TELEMETRY_SPEC, IRIS_CITATIONS_SPEC, ADR-003
--            (hybrid cron), ADR-004 (citation side panel),
--            ADR-005 (voice enforcement), ADR-007 (auto-withdraw).
--
-- Scope (DB only; UI + edge fn changes live elsewhere in the PR):
--
--   1. ai_rfi_drafts: extend with the multi-pass output shape +
--      Iris telemetry columns. The existing thin schema (subject,
--      question, severity) is preserved; new columns are nullable
--      so the legacy single-pass writers don't break.
--
--   2. rfi_clock_events: structured pause/resume with reason_code
--      enum. Auto-pause hooks land in the UI / cron, not here.
--
--   3. project_business_calendar: per-project list of holiday dates
--      so the days-open counter and due-date suggester respect them.
--
--   4. iris_weekly_digests: log of Monday digests sent per project.
--      Idempotency key = (project_id, week_starting). The cron
--      worker upserts here so re-runs don't double-send.
--
--   5. ai_rfi_drafts SELECT policy expanded: project members can read
--      drafts on RFIs they have access to.
--
-- Idempotent: safe to rerun.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. ai_rfi_drafts extensions ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'iris_confidence_band') THEN
    CREATE TYPE public.iris_confidence_band AS ENUM ('high', 'medium', 'low');
  END IF;
END$$;

ALTER TABLE ai_rfi_drafts
  ADD COLUMN IF NOT EXISTS rfi_id            UUID REFERENCES rfis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS draft_kind        TEXT NOT NULL DEFAULT 'rfi.create_v2',
  -- Suggested fields (each nullable; the pipeline fills what it can).
  ADD COLUMN IF NOT EXISTS suggested_title           TEXT,
  ADD COLUMN IF NOT EXISTS suggested_body            TEXT,
  ADD COLUMN IF NOT EXISTS suggested_ball_in_court   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggested_due_date        DATE,
  ADD COLUMN IF NOT EXISTS suggested_priority        TEXT,
  ADD COLUMN IF NOT EXISTS suggested_drawing_ids     UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS suggested_spec_sections   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS suggested_schedule_days   INTEGER,
  ADD COLUMN IF NOT EXISTS suggested_cost_cents_min  BIGINT,
  ADD COLUMN IF NOT EXISTS suggested_cost_cents_max  BIGINT,
  -- Citations array per IRIS_CITATIONS_SPEC. Each entry is
  -- { kind, ref, snippet, drawing_id?, spec_section?, page?, bbox? }.
  ADD COLUMN IF NOT EXISTS citations         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Per-field confidence map: { title: 0.92, body: 0.88, ... }
  ADD COLUMN IF NOT EXISTS confidence_by_field JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Aggregate confidence and band — what the UI uses to pick the
  -- auto-apply vs. suggest vs. draft-only path per ADR-007.
  ADD COLUMN IF NOT EXISTS confidence_score  NUMERIC(4,3)
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  ADD COLUMN IF NOT EXISTS confidence_band   public.iris_confidence_band,
  -- Telemetry per IRIS_TELEMETRY_SPEC.
  ADD COLUMN IF NOT EXISTS model_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS prompt_hash       TEXT,
  ADD COLUMN IF NOT EXISTS pass_log          JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS first_token_ms    INTEGER,
  ADD COLUMN IF NOT EXISTS total_ms          INTEGER,
  -- Lifecycle
  ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'modified', 'discarded', 'expired')),
  ADD COLUMN IF NOT EXISTS reviewed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_rfi_drafts_pending
  ON ai_rfi_drafts(project_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_rfi_drafts_rfi
  ON ai_rfi_drafts(rfi_id)
  WHERE rfi_id IS NOT NULL;


-- ── 2. rfi_clock_events ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfi_pause_reason') THEN
    CREATE TYPE public.rfi_pause_reason AS ENUM (
      'site_closed',
      'holiday',
      'weather',
      'permit_wait',
      'other'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.rfi_clock_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id       UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  paused_at    TIMESTAMPTZ NOT NULL,
  resumed_at   TIMESTAMPTZ,                                  -- NULL while still paused
  reason_code  public.rfi_pause_reason NOT NULL DEFAULT 'other',
  reason_text  TEXT,
  paused_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resumed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Auto-pause sources: 'manual' | 'auto_weekend' | 'auto_holiday'.
  -- Auto rows are created by a daily cron worker; manual rows by the UI.
  source       TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto_weekend', 'auto_holiday'))
);

CREATE INDEX IF NOT EXISTS idx_rfi_clock_events_rfi
  ON public.rfi_clock_events(rfi_id, paused_at DESC);

CREATE INDEX IF NOT EXISTS idx_rfi_clock_events_active
  ON public.rfi_clock_events(rfi_id)
  WHERE resumed_at IS NULL;

ALTER TABLE public.rfi_clock_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfi_clock_events_select ON public.rfi_clock_events;
CREATE POLICY rfi_clock_events_select ON public.rfi_clock_events FOR SELECT
  USING (
    is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id))
  );

DROP POLICY IF EXISTS rfi_clock_events_insert ON public.rfi_clock_events;
CREATE POLICY rfi_clock_events_insert ON public.rfi_clock_events FOR INSERT
  WITH CHECK (
    is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                    ARRAY['owner','admin','member'])
  );

DROP POLICY IF EXISTS rfi_clock_events_update ON public.rfi_clock_events;
CREATE POLICY rfi_clock_events_update ON public.rfi_clock_events FOR UPDATE
  USING (
    is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                    ARRAY['owner','admin','member'])
  )
  WITH CHECK (
    is_project_role((SELECT project_id FROM rfis WHERE rfis.id = rfi_id),
                    ARRAY['owner','admin','member'])
  );


-- ── 3. project_business_calendar ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_business_calendar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  label        TEXT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_project_business_calendar_project
  ON public.project_business_calendar(project_id, holiday_date);

ALTER TABLE public.project_business_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_business_calendar_select ON public.project_business_calendar;
CREATE POLICY project_business_calendar_select ON public.project_business_calendar FOR SELECT
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS project_business_calendar_insert ON public.project_business_calendar;
CREATE POLICY project_business_calendar_insert ON public.project_business_calendar FOR INSERT
  WITH CHECK (is_project_role(project_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS project_business_calendar_delete ON public.project_business_calendar;
CREATE POLICY project_business_calendar_delete ON public.project_business_calendar FOR DELETE
  USING (is_project_role(project_id, ARRAY['owner','admin']));


-- ── 4. iris_weekly_digests ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iris_weekly_digests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week_starting   DATE NOT NULL,                              -- Monday of the week
  recipient_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Top-N RFIs ranked by risk. Each entry:
  -- { rfi_id, score, reason, cost_cents, days_open }
  ranked_rfis     JSONB NOT NULL DEFAULT '[]'::jsonb,
  body_html       TEXT,
  body_text       TEXT,
  email_sent_at   TIMESTAMPTZ,
  inbox_seen_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotency: one digest per recipient per project per week.
  UNIQUE (project_id, week_starting, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_iris_weekly_digests_unread
  ON public.iris_weekly_digests(recipient_id, week_starting DESC)
  WHERE inbox_seen_at IS NULL;

ALTER TABLE public.iris_weekly_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iris_weekly_digests_select ON public.iris_weekly_digests;
CREATE POLICY iris_weekly_digests_select ON public.iris_weekly_digests FOR SELECT
  USING (recipient_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS iris_weekly_digests_update ON public.iris_weekly_digests;
CREATE POLICY iris_weekly_digests_update ON public.iris_weekly_digests FOR UPDATE
  USING (recipient_id = (SELECT auth.uid()))
  WITH CHECK (recipient_id = (SELECT auth.uid()));


-- ── 5. ai_rfi_drafts SELECT policy update ───────────────────────
-- Existing policy is `is_project_member(project_id) FOR ALL` from the
-- catchall migration. Keep it; no changes needed.

COMMENT ON TABLE public.rfi_clock_events IS
  'Structured pause/resume events for RFI SLA clocks. Days-open counter excludes paused intervals.';
COMMENT ON TABLE public.project_business_calendar IS
  'Per-project holiday dates that auto-pause RFI clocks.';
COMMENT ON TABLE public.iris_weekly_digests IS
  'Monday-morning Iris digest log per (project, week, recipient) — idempotent re-run anchor.';
