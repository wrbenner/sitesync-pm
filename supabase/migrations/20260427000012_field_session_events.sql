-- Field-session events — the PMF signal for our category-reframe bet.
--
-- We claim the right metric isn't "logins per week." It's "field
-- supers opening SiteSync 8+ times per shift without being told to."
-- This table is how we know whether that's actually happening.
--
-- Each row represents one app-foreground session for one user on one
-- project. We log the start time, end time, role context (was the user
-- acting as a super, PM, or admin?), and a coarse activity bucket
-- (capture / view / navigate). High-cardinality detail belongs in
-- analytics, not in this table.
--
-- Reads are by-project for the dashboard panel. Writes are bursty (one
-- per session). RLS-tight by project.

CREATE TABLE IF NOT EXISTS public.field_session_events (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id         uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_at_event   text,
  surface         text          NOT NULL CHECK (surface IN ('field','desktop','tablet','unknown')),
  -- Activity bucket: low-cardinality so we can pivot without a join.
  activity        text          NOT NULL CHECK (activity IN (
                    'capture','view','navigate','log','transition','search','offline_queue'
                  )),
  started_at      timestamptz   NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  -- Whether this session resulted in at least one mutation. Lets us
  -- distinguish "opened the app" from "did work" when computing PMF.
  did_mutate      boolean       NOT NULL DEFAULT false,
  -- Coarse network state at session start. Helpful when correlating
  -- field signal quality with adoption.
  network         text          CHECK (network IN ('online','offline','slow') OR network IS NULL),
  app_build       text,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS field_session_events_project_user_day_idx
  ON public.field_session_events (project_id, user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS field_session_events_recent_idx
  ON public.field_session_events (started_at DESC);

ALTER TABLE public.field_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_session_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS field_session_events_self_insert ON public.field_session_events;
CREATE POLICY field_session_events_self_insert ON public.field_session_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS field_session_events_self_update ON public.field_session_events;
CREATE POLICY field_session_events_self_update ON public.field_session_events
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS field_session_events_project_read ON public.field_session_events;
CREATE POLICY field_session_events_project_read ON public.field_session_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.field_session_events.project_id
        AND pm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.field_session_events IS
  'PMF telemetry: per-user, per-project app sessions. Target: 8+ field-super sessions per day within 30 days of onboarding (see VISION.md).';
