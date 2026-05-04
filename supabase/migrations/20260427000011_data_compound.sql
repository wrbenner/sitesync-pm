-- Data compound — capture the patterns that make project N+1 smarter
-- than project N.
--
-- Three additions, each cheap to capture and high-leverage in year 2+:
--
--   1. change_orders.cause / cause_originator / cause_stage
--      Each CO gets a categorical reason. After 100 projects we can
--      surface "owner-driven scope changes after schematic design
--      average $X/sqft for healthcare" on demand.
--
--   2. rfis.drawing_x / drawing_y (already nullable in schema, ensure
--      they exist; surface clash hot-spots at column-line crossings).
--      We don't want to break older RFIs without coordinates — leave
--      nullable, document the contract.
--
--   3. schedule_recovery_events table
--      Every time a project recovers from a slip, capture HOW. After
--      100 projects we can suggest "Three projects with similar slips
--      recovered by parallelizing trades A and B."
--
-- All three are read-mostly, write-occasionally, low-volume tables /
-- columns. RLS-tight by project. Safe to add to a live database.

-- ── 1. Change-order causal taxonomy ─────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'change_order_cause'
  ) THEN
    CREATE TYPE public.change_order_cause AS ENUM (
      'owner_directed_scope_change',
      'design_error_or_omission',
      'unforeseen_field_condition',
      'value_engineering',
      'allowance_adjustment',
      'permit_or_code_change',
      'weather_delay',
      'subcontractor_default',
      'material_substitution',
      'schedule_acceleration',
      'other'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'change_order_originator_role'
  ) THEN
    CREATE TYPE public.change_order_originator_role AS ENUM (
      'owner',
      'architect',
      'engineer',
      'gc',
      'subcontractor',
      'authority_having_jurisdiction',
      'other'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'change_order_project_stage'
  ) THEN
    CREATE TYPE public.change_order_project_stage AS ENUM (
      'pre_construction',
      'schematic_design',
      'design_development',
      'construction_documents',
      'bidding',
      'mobilization',
      'foundation',
      'structure',
      'envelope',
      'mep_rough',
      'finishes',
      'commissioning',
      'closeout'
    );
  END IF;
END$$;

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS cause public.change_order_cause,
  ADD COLUMN IF NOT EXISTS cause_originator public.change_order_originator_role,
  ADD COLUMN IF NOT EXISTS cause_stage public.change_order_project_stage,
  ADD COLUMN IF NOT EXISTS cause_notes text;

COMMENT ON COLUMN public.change_orders.cause IS
  'Categorical reason for the change. Drives the year-2 "AI estimating" feature that draws on prior project history.';
COMMENT ON COLUMN public.change_orders.cause_originator IS
  'Which party drove the change. Used for accountability analysis.';
COMMENT ON COLUMN public.change_orders.cause_stage IS
  'Project stage when the change emerged. Late-stage owner changes correlate with higher contingency burn.';

-- ── 2. RFI drawing coordinates (idempotent guard) ───────────────────

ALTER TABLE public.rfis
  ADD COLUMN IF NOT EXISTS drawing_x numeric,
  ADD COLUMN IF NOT EXISTS drawing_y numeric;

COMMENT ON COLUMN public.rfis.drawing_x IS
  'Normalized x-coordinate (0-1) on the linked drawing. Powers clash hot-spot maps.';
COMMENT ON COLUMN public.rfis.drawing_y IS
  'Normalized y-coordinate (0-1) on the linked drawing.';

-- ── 3. Schedule recovery events ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_recovery_events (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  observed_at     timestamptz   NOT NULL DEFAULT now(),
  -- The slip that was recovered (in days). Always positive.
  days_slipped    integer       NOT NULL CHECK (days_slipped > 0),
  -- The recovery technique applied. We use a string column instead of
  -- an enum so the org can capture novel tactics without a migration;
  -- analytics jobs normalize the values offline.
  recovery_type   text          NOT NULL,
  -- Free text explaining the situation; structured fields capture the
  -- actions taken so we can compute pattern matches across projects.
  description     text,
  actions_taken   jsonb         NOT NULL DEFAULT '[]'::jsonb,
  affected_phase_ids text[]     NOT NULL DEFAULT ARRAY[]::text[],
  recorded_by     uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_recovery_events_project_idx
  ON public.schedule_recovery_events (project_id, observed_at DESC);

ALTER TABLE public.schedule_recovery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_recovery_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_recovery_events_select ON public.schedule_recovery_events;
CREATE POLICY schedule_recovery_events_select ON public.schedule_recovery_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.schedule_recovery_events.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS schedule_recovery_events_insert ON public.schedule_recovery_events;
CREATE POLICY schedule_recovery_events_insert ON public.schedule_recovery_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.schedule_recovery_events.project_id
        AND pm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.schedule_recovery_events IS
  'Captures how projects recover from schedule slips. Mined for the year-2 "Schedule recovery playbook" feature.';
