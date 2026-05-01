-- Walk-Through Mode — sessions table.
--
-- A walk-through session represents one continuous owner/architect/closeout
-- walk of a project. The GC's super (or whoever opened the app for them)
-- holds down the capture button, mumbles a sentence, and snaps a photo.
-- Each capture lands in `walkthrough_captures` (next migration). When the
-- walk ends, the session is reviewed (PM bulk-approves drafts), and a PDF
-- snapshot is generated for the owner record.
--
-- Why a session table at all? Three reasons:
--   1. Counts. We surface "47 captured / 41 approved / 6 deferred" to the
--      PM during review, and the dashboard shows recent walks.
--   2. Attendees. The PDF needs an attendee list, and that's a property
--      of the walk, not of any one capture.
--   3. PDF provenance. Owner reps occasionally challenge punch lists weeks
--      later — having a content-hashed PDF + ISO timestamp lets us prove
--      the snapshot is original.
--
-- RLS: project members read/write. The "GC's super opens session for owner"
-- case is covered by project-membership — we don't require started_by_user
-- = auth.uid() because the super may be running the device on behalf of
-- the visiting owner rep, and both are project members.

CREATE TABLE IF NOT EXISTS public.walkthrough_sessions (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  started_by_user   uuid          NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at        timestamptz   NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  -- JSON array of { name, role, email? } — captured at start of walk.
  attendees         jsonb         NOT NULL DEFAULT '[]'::jsonb,
  -- Aggregate counts kept in-row to avoid joining captures every render.
  -- A trigger on walkthrough_captures keeps total_drafted in sync.
  total_drafted     int           NOT NULL DEFAULT 0,
  total_approved    int           NOT NULL DEFAULT 0,
  total_rejected    int           NOT NULL DEFAULT 0,
  -- Set after the PM clicks "Generate PDF" on the review page.
  pdf_export_url    text,
  -- SHA-256 over the PDF bytes; lets us prove a later download is the
  -- same artifact the owner saw on walk-day.
  pdf_content_hash  text,
  status            text          NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active','reviewing','finalized')),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

-- Idempotently add columns when the table predates this migration in dev.
ALTER TABLE public.walkthrough_sessions
  ADD COLUMN IF NOT EXISTS pdf_content_hash text;

CREATE INDEX IF NOT EXISTS walkthrough_sessions_project_status_idx
  ON public.walkthrough_sessions (project_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS walkthrough_sessions_recent_idx
  ON public.walkthrough_sessions (started_at DESC);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.walkthrough_sessions_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS walkthrough_sessions_set_updated_at ON public.walkthrough_sessions;
CREATE TRIGGER walkthrough_sessions_set_updated_at
  BEFORE UPDATE ON public.walkthrough_sessions
  FOR EACH ROW EXECUTE FUNCTION public.walkthrough_sessions_set_updated_at();

ALTER TABLE public.walkthrough_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walkthrough_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS walkthrough_sessions_select_member ON public.walkthrough_sessions;
CREATE POLICY walkthrough_sessions_select_member ON public.walkthrough_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.walkthrough_sessions.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS walkthrough_sessions_insert_member ON public.walkthrough_sessions;
CREATE POLICY walkthrough_sessions_insert_member ON public.walkthrough_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.walkthrough_sessions.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS walkthrough_sessions_update_member ON public.walkthrough_sessions;
CREATE POLICY walkthrough_sessions_update_member ON public.walkthrough_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.walkthrough_sessions.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS walkthrough_sessions_delete_member ON public.walkthrough_sessions;
CREATE POLICY walkthrough_sessions_delete_member ON public.walkthrough_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.walkthrough_sessions.project_id
        AND pm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.walkthrough_sessions IS
  'One row per owner/architect walk-through session. Aggregates capture counts and stores the signed PDF snapshot.';
COMMENT ON COLUMN public.walkthrough_sessions.attendees IS
  'JSON array of { name, role, email? } captured at start of walk. Rendered into the PDF header.';
COMMENT ON COLUMN public.walkthrough_sessions.pdf_content_hash IS
  'SHA-256 hex of the PDF bytes. Used to prove a later download matches what the owner saw.';
