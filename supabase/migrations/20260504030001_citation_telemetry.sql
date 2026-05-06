-- Citation interactions — Lap 2 click-through telemetry.
--
-- Citations live as JSON inside drafted_actions.payload.citations
-- (array, no per-citation primary key). To track per-citation
-- interactions, this table keys on (drafted_action_id, citation_index)
-- where citation_index is the 0-based array position the user
-- interacted with.
--
-- Reference: docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md § Phase 5

BEGIN;

CREATE TABLE IF NOT EXISTS public.citation_interactions (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  drafted_action_id uuid          NOT NULL REFERENCES public.drafted_actions(id) ON DELETE CASCADE,
  citation_index    integer       NOT NULL CHECK (citation_index >= 0),
  citation_kind     text          NOT NULL,  -- denormalized for fast queries
  interaction_type  text          NOT NULL
                                  CHECK (interaction_type IN (
                                    'view',                  -- chip scrolled into viewport
                                    'open_panel',            -- user clicked → side panel opened
                                    'click_through_to_full', -- user clicked the "open in full page" link
                                    'copy_text'              -- user copied the snippet text
                                  )),
  user_id           uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at       timestamptz   NOT NULL DEFAULT NOW(),
  inbox_session_id  uuid
);

-- Per-draft drill-down: "did the user click any citation before deciding?"
CREATE INDEX IF NOT EXISTS idx_citation_interactions_draft_index
  ON public.citation_interactions (drafted_action_id, citation_index);

-- Aggregate: "what % of drafts had a citation clicked before approval"
CREATE INDEX IF NOT EXISTS idx_citation_interactions_draft_type
  ON public.citation_interactions (drafted_action_id, interaction_type, occurred_at);

COMMENT ON TABLE public.citation_interactions IS
  'Per-citation interaction telemetry. Read by Lap 2 dashboard for the click-through-rate diagnostic. Healthy band 20-50% per IRIS_CITATIONS_SPEC.';

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.citation_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citation_interactions FORCE ROW LEVEL SECURITY;

-- Users see only their own interactions on drafts in projects they belong to.
DROP POLICY IF EXISTS citation_interactions_select_own ON public.citation_interactions;
CREATE POLICY citation_interactions_select_own ON public.citation_interactions
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.drafted_actions da
       JOIN public.project_members pm ON pm.project_id = da.project_id
       WHERE da.id = citation_interactions.drafted_action_id
         AND pm.user_id = auth.uid()
    )
  );

-- Users insert only their own interactions, only against drafts they can see.
DROP POLICY IF EXISTS citation_interactions_insert_own ON public.citation_interactions;
CREATE POLICY citation_interactions_insert_own ON public.citation_interactions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.drafted_actions da
       JOIN public.project_members pm ON pm.project_id = da.project_id
       WHERE da.id = citation_interactions.drafted_action_id
         AND pm.user_id = auth.uid()
    )
  );

-- ── RPC: record a citation interaction ────────────────────────────
-- The hooks (useRecordCitationView, useOpenCitationPanel,
-- useFollowThroughToFull) call this single RPC. Centralizing through
-- a SECURITY DEFINER fn lets us batch-validate the (draft, citation
-- index, kind) tuple in one place rather than duplicating it across
-- four client surfaces.

CREATE OR REPLACE FUNCTION public.record_citation_interaction(
  p_draft_id         uuid,
  p_citation_index   integer,
  p_citation_kind    text,
  p_interaction_type text,
  p_session_id       uuid DEFAULT NULL
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

  IF p_interaction_type NOT IN ('view','open_panel','click_through_to_full','copy_text') THEN
    RAISE EXCEPTION 'Invalid interaction_type: %', p_interaction_type;
  END IF;

  -- Project-membership check (mirrors RLS).
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

  INSERT INTO public.citation_interactions (
    drafted_action_id, citation_index, citation_kind,
    interaction_type, user_id, inbox_session_id
  ) VALUES (
    p_draft_id, p_citation_index, p_citation_kind,
    p_interaction_type, v_user_id, p_session_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_citation_interaction(uuid, integer, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_citation_interaction(uuid, integer, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_citation_interaction(uuid, integer, text, text, uuid) IS
  'Single client write-path for citation interaction telemetry. Validates project membership + interaction type; inserts a citation_interactions row.';

COMMIT;
