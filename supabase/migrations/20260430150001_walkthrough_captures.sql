-- Walk-Through Mode — captures table.
--
-- One row per "press-and-hold + photo" capture during a walkthrough. The
-- audio is uploaded to Storage (path stored here, not the blob), Whisper
-- transcribes it asynchronously, then Sonnet structures the transcript
-- into a ParsedCapture { title, description, trade, severity, ... }.
--
-- The capture lifecycle:
--   pending_transcription  →  audio uploaded, transcript not yet returned
--   pending_review         →  parsed; waiting on PM review
--   approved               →  PM approved; an actual punch_items row was
--                             created and executed_punch_item_id is set
--   rejected               →  PM rejected; nothing was created
--   deferred               →  "decide later" — kept for re-review
--   failed                 →  transcription / parsing failed permanently;
--                             surface "manual entry" UX so the walk isn't lost
--
-- The provenance pattern (created_via + source_drafted_action_id) mirrors
-- the executor convention from src/services/iris/executors/*.

CREATE TABLE IF NOT EXISTS public.walkthrough_captures (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               uuid          NOT NULL REFERENCES public.walkthrough_sessions(id) ON DELETE CASCADE,
  -- project_id is denormalized here (also reachable via session_id) so
  -- RLS by project doesn't require a join on every read.
  project_id               uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  captured_at              timestamptz   NOT NULL DEFAULT now(),
  audio_storage_path       text,
  photo_storage_path       text,
  transcript               text,
  -- Whisper returns no native confidence; we synthesize from
  -- segment-level avg_logprob in the edge function. 0..1.
  transcript_confidence    numeric(4,3)  CHECK (transcript_confidence IS NULL
                                                OR (transcript_confidence >= 0 AND transcript_confidence <= 1)),
  -- The structured output: ParsedCapture from src/types/walkthrough.ts.
  -- Stored as JSON to avoid a 6-column denormalization and to let the
  -- LLM evolve the shape without a migration each time.
  parsed                   jsonb,
  gps_lat                  numeric(9,6),
  gps_lon                  numeric(9,6),
  -- Optional drawing pin: PM may drop the capture on a sheet later.
  drawing_id               uuid,
  drawing_x                numeric,
  drawing_y                numeric,
  status                   text          NOT NULL DEFAULT 'pending_transcription'
                                         CHECK (status IN (
                                           'pending_transcription',
                                           'pending_review',
                                           'approved',
                                           'rejected',
                                           'deferred',
                                           'failed'
                                         )),
  -- When approved, the punch_items row id we wrote.
  executed_punch_item_id   uuid,
  -- Provenance tags — match the iris executor pattern.
  created_via              text          NOT NULL DEFAULT 'walkthrough_capture',
  source_drafted_action_id uuid,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS walkthrough_captures_session_idx
  ON public.walkthrough_captures (session_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS walkthrough_captures_project_status_idx
  ON public.walkthrough_captures (project_id, status, captured_at DESC);

CREATE INDEX IF NOT EXISTS walkthrough_captures_pending_review_idx
  ON public.walkthrough_captures (project_id, captured_at DESC)
  WHERE status = 'pending_review';

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.walkthrough_captures_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS walkthrough_captures_set_updated_at ON public.walkthrough_captures;
CREATE TRIGGER walkthrough_captures_set_updated_at
  BEFORE UPDATE ON public.walkthrough_captures
  FOR EACH ROW EXECUTE FUNCTION public.walkthrough_captures_set_updated_at();

-- Counter trigger: bump walkthrough_sessions.total_drafted on insert,
-- and reflect approve / reject transitions on UPDATE.
CREATE OR REPLACE FUNCTION public.walkthrough_captures_bump_session_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.walkthrough_sessions
       SET total_drafted = total_drafted + 1
     WHERE id = NEW.session_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only fire on status transitions into approved / rejected.
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
      UPDATE public.walkthrough_sessions
         SET total_approved = total_approved + 1
       WHERE id = NEW.session_id;
    ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
      UPDATE public.walkthrough_sessions
         SET total_rejected = total_rejected + 1
       WHERE id = NEW.session_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS walkthrough_captures_bump_counts ON public.walkthrough_captures;
CREATE TRIGGER walkthrough_captures_bump_counts
  AFTER INSERT OR UPDATE OF status ON public.walkthrough_captures
  FOR EACH ROW EXECUTE FUNCTION public.walkthrough_captures_bump_session_counts();

ALTER TABLE public.walkthrough_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walkthrough_captures FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS walkthrough_captures_select_member ON public.walkthrough_captures;
CREATE POLICY walkthrough_captures_select_member ON public.walkthrough_captures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.walkthrough_captures.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS walkthrough_captures_insert_member ON public.walkthrough_captures;
CREATE POLICY walkthrough_captures_insert_member ON public.walkthrough_captures
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.walkthrough_captures.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS walkthrough_captures_update_member ON public.walkthrough_captures;
CREATE POLICY walkthrough_captures_update_member ON public.walkthrough_captures
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.walkthrough_captures.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS walkthrough_captures_delete_member ON public.walkthrough_captures;
CREATE POLICY walkthrough_captures_delete_member ON public.walkthrough_captures
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.walkthrough_captures.project_id
        AND pm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.walkthrough_captures IS
  'One row per audio+photo capture during a walkthrough. Becomes a punch_items row on PM approval.';
COMMENT ON COLUMN public.walkthrough_captures.parsed IS
  'Structured ParsedCapture JSON: { title, description, trade?, severity, location_hint?, suggested_subcontractor_id?, modify_previous }.';
COMMENT ON COLUMN public.walkthrough_captures.created_via IS
  'Provenance tag — value walkthrough_capture marks rows produced by this feature for audit-trail filtering.';
