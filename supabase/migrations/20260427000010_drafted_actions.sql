-- Drafted Actions — the substrate for "Iris that ACTS, not chats."
--
-- When the AI copilot identifies an action the project needs (a missing
-- RFI, a daily log waiting to be written, a pay-app draft, a schedule
-- conflict, a punch-item it spotted in a photo), it does not execute it
-- immediately. It writes a row here, with a payload describing what it
-- would do, citations explaining why, and a status of 'pending'.
--
-- The user reviews the draft in the Iris Inbox, approves or rejects it.
-- On approve, an audit-logged executor function carries out the action
-- (insert RFI, finalize daily log, etc.) and marks the draft 'executed'.
--
-- Every column here is intentional:
--   • action_type          discriminator → which executor handles it
--   • payload              JSON of the would-be insert/update
--   • citations            JSON array of {kind, ref, snippet} so the user
--                          knows WHY Iris drafted this
--   • confidence           0-1 — when very low, surface a "needs review"
--                          badge; when high, allow auto-execute on opt-in
--   • status               pending | approved | rejected | executed | failed
--   • drafted_by           the AI source — model + version
--   • decided_by           profile id (or null when auto-executed)
--   • execution_result     JSON of what the executor actually did
--                          (linked resource id, error text on failure)
--
-- This table is the unique kernel of our category-reframing bet. Treat it
-- with the same care as the audit_log table: never drop columns without
-- migrating data, never store secrets, RLS-tight by project scope.

CREATE TABLE IF NOT EXISTS public.drafted_actions (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action_type   text          NOT NULL,
  title         text          NOT NULL,
  summary       text,
  payload       jsonb         NOT NULL DEFAULT '{}'::jsonb,
  citations     jsonb         NOT NULL DEFAULT '[]'::jsonb,
  confidence    numeric(4,3)  NOT NULL DEFAULT 0.5
                              CHECK (confidence >= 0 AND confidence <= 1),
  status        text          NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected','executed','failed')),
  drafted_by    text          NOT NULL,
  draft_reason  text,
  related_resource_type text,
  related_resource_id   uuid,
  executed_resource_type text,
  executed_resource_id   uuid,
  execution_result jsonb,
  decided_by    uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at    timestamptz,
  decision_note text,
  executed_at   timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drafted_actions_project_status_idx
  ON public.drafted_actions (project_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS drafted_actions_pending_idx
  ON public.drafted_actions (project_id, created_at DESC)
  WHERE status = 'pending';

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.drafted_actions_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drafted_actions_set_updated_at ON public.drafted_actions;
CREATE TRIGGER drafted_actions_set_updated_at
  BEFORE UPDATE ON public.drafted_actions
  FOR EACH ROW EXECUTE FUNCTION public.drafted_actions_set_updated_at();

-- Row-level security: only project members read/write their project's drafts.
ALTER TABLE public.drafted_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafted_actions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drafted_actions_select_member ON public.drafted_actions;
CREATE POLICY drafted_actions_select_member ON public.drafted_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.drafted_actions.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drafted_actions_insert_member ON public.drafted_actions;
CREATE POLICY drafted_actions_insert_member ON public.drafted_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.drafted_actions.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drafted_actions_update_member ON public.drafted_actions;
CREATE POLICY drafted_actions_update_member ON public.drafted_actions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.drafted_actions.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS drafted_actions_delete_member ON public.drafted_actions;
CREATE POLICY drafted_actions_delete_member ON public.drafted_actions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = public.drafted_actions.project_id
        AND pm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.drafted_actions IS
  'AI-generated actions awaiting user approval. The substrate for "Iris that acts."';
COMMENT ON COLUMN public.drafted_actions.action_type IS
  'Discriminator: rfi.draft, daily_log.draft, pay_app.draft, schedule.resequence, punch_item.draft, etc.';
COMMENT ON COLUMN public.drafted_actions.citations IS
  'JSON array of {kind, ref, snippet, drawing_id?, x?, y?} citations explaining why Iris drafted this.';
COMMENT ON COLUMN public.drafted_actions.confidence IS
  'Iris confidence 0-1. Below 0.5 → require explicit approval. Above 0.9 + opt-in → auto-execute.';
