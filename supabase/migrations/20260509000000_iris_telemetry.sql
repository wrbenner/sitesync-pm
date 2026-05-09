-- Iris Telemetry — page-event substrate (Phase 2B).
--
-- Distinct from the drafted_actions telemetry shipped Day 30.5
-- (20260504010000_drafted_actions_telemetry.sql), which is decision-centric
-- and feeds the Lap-2 acceptance matview. THIS table is page-event-centric
-- and powers per-page adoption signal for the soft pilot + future engagement
-- matviews.
--
-- Convention: event_name is `<page>.<action>` (e.g., `day.opened`,
-- `rfi.status_changed`). The schema does NOT enforce the convention — the
-- helper at src/lib/telemetry/track.ts owns the call sites.
--
-- Retention: 12mo per ADR-008. Soft pilot orgs retain 24mo, then anonymize.
-- Retention enforcement is out of scope for this migration; a follow-on
-- pg_cron job will purge rows older than the retention window.
--
-- Reference: docs/audits/PAGE_CARD_*_2026-05-08.md (every card flagged
--            "⚠️ none emitted from page" before this migration shipped).

BEGIN;

-- ── Table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.iris_telemetry (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name  text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.iris_telemetry IS
  'Page-event telemetry. Powers per-page adoption signal for the soft pilot. 12mo retention per ADR-008. Distinct from drafted_actions telemetry (which is decision-centric and feeds the Lap-2 gate).';
COMMENT ON COLUMN public.iris_telemetry.event_name IS
  'Convention: <page>.<action>. Free-form by design; the track() helper owns the call sites.';
COMMENT ON COLUMN public.iris_telemetry.details IS
  'Per-event payload. JSONB to avoid migration churn; payload shape is documented per event in the matching Page Card.';

-- ── Indexes ───────────────────────────────────────────────────────────

-- Per-project event-stream queries: "every day.opened in the last 7 days"
CREATE INDEX IF NOT EXISTS idx_iris_telemetry_project_event_created
  ON public.iris_telemetry (project_id, event_name, created_at DESC);

-- Per-user activity: "show this user's last N actions across all projects"
CREATE INDEX IF NOT EXISTS idx_iris_telemetry_user_created
  ON public.iris_telemetry (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.iris_telemetry ENABLE ROW LEVEL SECURITY;

-- Block ALL direct INSERT/UPDATE/DELETE. The RPC below is the only writer.
-- Mirrors the pattern from the drafted_actions telemetry guard.
CREATE POLICY iris_telemetry_no_direct_write_insert
  ON public.iris_telemetry
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY iris_telemetry_no_update
  ON public.iris_telemetry
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY iris_telemetry_no_delete
  ON public.iris_telemetry
  FOR DELETE TO authenticated
  USING (false);

-- Project members may read their own project's events.
CREATE POLICY iris_telemetry_select_project_member
  ON public.iris_telemetry
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = iris_telemetry.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- ── Insert RPC (the only writer) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_event(
  p_project_id uuid,
  p_event_name text,
  p_details    jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Auth guard: caller must be an authenticated user with project membership.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'record_event: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'record_event: not a project member';
  END IF;

  -- Sanity guard on event_name shape. Loose by design; just blocks empty
  -- strings and absurd lengths. Convention enforcement lives in the helper.
  IF p_event_name IS NULL OR length(p_event_name) = 0 OR length(p_event_name) > 128 THEN
    RAISE EXCEPTION 'record_event: invalid event_name';
  END IF;

  INSERT INTO public.iris_telemetry (project_id, user_id, event_name, details)
  VALUES (p_project_id, auth.uid(), p_event_name, COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_event(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_event(uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.record_event IS
  'Insert one page-event row. Membership-checked. Fire-and-forget from the client; the RAISE EXCEPTION cases are bugs in the caller, not user-facing.';

COMMIT;
