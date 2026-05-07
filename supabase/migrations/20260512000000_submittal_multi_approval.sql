-- =============================================================================
-- Phase 7c-1 — Multi-Approval Workflow for Submittals
--
-- Closes 3 gaps vs Procore + 1 differentiator:
--   1. Sequential auto-advance after a disposition (move ball-in-court to
--      the next step atomically; transition status when chain completes)
--   2. Send-back to a prior reviewer (re-open target step + intermediates)
--   3. Per-step comment thread (multiple comments per reviewer, @-mentions,
--      attachments, edit history; audit-preserving deletion)
--   4. Iris one-line thread summary on each step (column shipped here;
--      LLM-augmented edge fn lands in Phase 7c-2)
--
-- ADDITIVE only. Idempotent re-apply via IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- ── 1. submittal_step_comments — threaded per-step comments ────────────────

CREATE TABLE IF NOT EXISTS public.submittal_step_comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_step_id    uuid NOT NULL REFERENCES public.submittal_reviewers(id) ON DELETE CASCADE,
  author_id           uuid REFERENCES auth.users(id),
  body_md             text NOT NULL,
  attachments         jsonb NOT NULL DEFAULT '[]'::jsonb,
  mentions            uuid[] NOT NULL DEFAULT '{}'::uuid[],
  -- Edit history: an "edit" is a NEW row whose parent_comment_id points at
  -- the prior version. The thread view always renders the latest leaf per
  -- parent chain. Deletion = is_deleted true (audit-preserving).
  parent_comment_id   uuid REFERENCES public.submittal_step_comments(id),
  is_deleted          boolean NOT NULL DEFAULT false,
  -- Optional structured reason code — populated by SendBackDialog's chip
  -- picker. Free-form for other entry methods.
  reason_code         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- Hash-chain audit per row.
  hash_chain_prev     text,
  hash_chain_self     text
);

CREATE INDEX IF NOT EXISTS idx_submittal_step_comments_step
  ON public.submittal_step_comments (reviewer_step_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submittal_step_comments_parent
  ON public.submittal_step_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

ALTER TABLE public.submittal_step_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS submittal_step_comments_project_member ON public.submittal_step_comments;
CREATE POLICY submittal_step_comments_project_member ON public.submittal_step_comments
  FOR SELECT
  USING (
    reviewer_step_id IN (
      SELECT r.id FROM public.submittal_reviewers r
       JOIN public.submittals s ON s.id = r.submittal_id
       JOIN public.project_members pm ON pm.project_id = s.project_id
      WHERE pm.user_id = auth.uid()
    )
  );

-- Inserts/updates/deletes go through SECURITY DEFINER RPCs only — no direct
-- client-side mutation policies (the RPCs enforce author + role checks).

COMMENT ON TABLE public.submittal_step_comments IS
  'Threaded comments per reviewer step. Mutations gated by SECURITY DEFINER '
  'RPCs (create/edit/delete). Audit-preserving deletion via is_deleted. '
  'Edit history via parent_comment_id chain.';

-- ── 2. ALTER submittal_reviewers — Iris summary + is_open materializer ─────

ALTER TABLE public.submittal_reviewers
  ADD COLUMN IF NOT EXISTS iris_thread_summary text,
  ADD COLUMN IF NOT EXISTS iris_summary_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_submittal_reviewers_open
  ON public.submittal_reviewers (submittal_id)
  WHERE is_open = true;

-- ── 3. Helper: advance the chain to the next step ─────────────────────────
-- Returns the id of the new current step (or NULL when the chain completes).
-- Skips parallel siblings: only advances when ALL parallel rows in the
-- current step's group have responded.

CREATE OR REPLACE FUNCTION public.submittal_advance_chain(p_submittal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_seq      int;
  v_current_parallel int;
  v_unresolved_par   int;
  v_next_step        public.submittal_reviewers;
BEGIN
  -- Find the current step's sequence + parallel_group.
  SELECT r.sequence, r.parallel_group INTO v_current_seq, v_current_parallel
    FROM public.submittal_reviewers r
   WHERE r.submittal_id = p_submittal_id AND r.is_open = true
   ORDER BY r.sequence ASC
   LIMIT 1;

  IF v_current_seq IS NULL THEN
    -- No open step — chain is at start or already complete. Pick the
    -- earliest unresponded step as the new current.
    SELECT * INTO v_next_step
      FROM public.submittal_reviewers r
     WHERE r.submittal_id = p_submittal_id
       AND r.responded_at IS NULL
     ORDER BY r.sequence ASC, COALESCE(r.parallel_group, -1) ASC
     LIMIT 1;
  ELSE
    -- Wait for parallel siblings to finish before advancing.
    IF v_current_parallel IS NOT NULL THEN
      SELECT count(*) INTO v_unresolved_par
        FROM public.submittal_reviewers r
       WHERE r.submittal_id = p_submittal_id
         AND r.sequence = v_current_seq
         AND r.parallel_group = v_current_parallel
         AND r.responded_at IS NULL;
      IF v_unresolved_par > 0 THEN
        -- Still waiting on parallel siblings — current_reviewer cycles
        -- among them. Pick the next unresolved one as the open step.
        SELECT * INTO v_next_step
          FROM public.submittal_reviewers r
         WHERE r.submittal_id = p_submittal_id
           AND r.sequence = v_current_seq
           AND r.parallel_group = v_current_parallel
           AND r.responded_at IS NULL
         ORDER BY r.id ASC
         LIMIT 1;
      ELSE
        -- All siblings done — advance to the next sequence.
        SELECT * INTO v_next_step
          FROM public.submittal_reviewers r
         WHERE r.submittal_id = p_submittal_id
           AND r.sequence > v_current_seq
           AND r.responded_at IS NULL
         ORDER BY r.sequence ASC, COALESCE(r.parallel_group, -1) ASC
         LIMIT 1;
      END IF;
    ELSE
      -- Sequential (no parallel group) — find the next unresponded step.
      SELECT * INTO v_next_step
        FROM public.submittal_reviewers r
       WHERE r.submittal_id = p_submittal_id
         AND r.sequence > v_current_seq
         AND r.responded_at IS NULL
       ORDER BY r.sequence ASC, COALESCE(r.parallel_group, -1) ASC
       LIMIT 1;
    END IF;
  END IF;

  -- Close all open flags first.
  UPDATE public.submittal_reviewers
     SET is_open = false
   WHERE submittal_id = p_submittal_id AND is_open = true;

  IF v_next_step.id IS NULL THEN
    -- Chain complete.
    UPDATE public.submittals
       SET current_reviewer_id   = NULL,
           current_reviewer_role = NULL,
           ball_in_court_since   = NULL,
           updated_at            = now()
     WHERE id = p_submittal_id;
    RETURN NULL;
  END IF;

  UPDATE public.submittal_reviewers
     SET is_open = true
   WHERE id = v_next_step.id;

  UPDATE public.submittals
     SET current_reviewer_id   = v_next_step.reviewer_id,
         current_reviewer_role = v_next_step.reviewer_role,
         ball_in_court_since   = now(),
         updated_at            = now()
   WHERE id = p_submittal_id;

  RETURN v_next_step.id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_advance_chain(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_advance_chain(uuid) TO authenticated;

-- ── 4. RPC: record_disposition_v2 (with auto-advance) ──────────────────────

CREATE OR REPLACE FUNCTION public.submittal_record_disposition_v2(
  p_reviewer_id   uuid,
  p_disposition   text,
  p_comment       text,
  p_stamp_url     text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_submittal_id uuid;
  v_next_step_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT submittal_id INTO v_submittal_id
    FROM public.submittal_reviewers WHERE id = p_reviewer_id;
  IF v_submittal_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer step % not found', p_reviewer_id;
  END IF;

  -- Project-member gate.
  IF NOT EXISTS (
    SELECT 1 FROM public.submittals s
     JOIN public.project_members pm ON pm.project_id = s.project_id
    WHERE s.id = v_submittal_id AND pm.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  -- Record disposition.
  UPDATE public.submittal_reviewers
     SET disposition  = p_disposition,
         comments     = p_comment,
         stamp_url    = p_stamp_url,
         responded_at = now()
   WHERE id = p_reviewer_id;

  -- Auto-advance the chain (parallel-aware via the helper).
  v_next_step_id := public.submittal_advance_chain(v_submittal_id);

  -- When chain completed, transition the submittal status by disposition.
  IF v_next_step_id IS NULL THEN
    UPDATE public.submittals
       SET status = CASE
                      WHEN p_disposition ILIKE '%reject%' OR p_disposition ILIKE '%revise%resubmit%'
                        THEN 'returned'
                      WHEN p_disposition ILIKE '%no exceptions%' OR p_disposition ILIKE '%approved%' OR p_disposition ILIKE '%as noted%'
                        THEN 'distribute'
                      ELSE status
                    END,
           updated_at = now()
     WHERE id = v_submittal_id;
  END IF;

  RETURN v_next_step_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_record_disposition_v2(uuid, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_record_disposition_v2(uuid, text, text, text) TO authenticated;

-- ── 5. RPC: send_back ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_send_back(
  p_target_step_id uuid,
  p_reason_code    text,
  p_comment_body   text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor         uuid := auth.uid();
  v_submittal_id  uuid;
  v_target_seq    int;
  v_current_seq   int;
  v_comment_id    uuid;
  v_target_role   text;
  v_target_user   uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT r.submittal_id, r.sequence, r.reviewer_role, r.reviewer_id
    INTO v_submittal_id, v_target_seq, v_target_role, v_target_user
    FROM public.submittal_reviewers r WHERE r.id = p_target_step_id;
  IF v_submittal_id IS NULL THEN
    RAISE EXCEPTION 'Target step % not found', p_target_step_id;
  END IF;

  -- Membership gate.
  IF NOT EXISTS (
    SELECT 1 FROM public.submittals s
     JOIN public.project_members pm ON pm.project_id = s.project_id
    WHERE s.id = v_submittal_id AND pm.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  -- Find current step's sequence.
  SELECT sequence INTO v_current_seq
    FROM public.submittal_reviewers
   WHERE submittal_id = v_submittal_id AND is_open = true
   ORDER BY sequence ASC LIMIT 1;
  IF v_current_seq IS NULL THEN
    -- No open step — fall back to the highest-sequence responded step.
    SELECT MAX(sequence) INTO v_current_seq
      FROM public.submittal_reviewers
     WHERE submittal_id = v_submittal_id;
  END IF;

  IF v_current_seq IS NULL OR v_target_seq >= v_current_seq THEN
    RAISE EXCEPTION 'Target step must be earlier than the current step in the chain';
  END IF;

  -- Re-open target + intermediate steps.
  UPDATE public.submittal_reviewers
     SET responded_at = NULL,
         disposition  = NULL,
         is_open      = false
   WHERE submittal_id = v_submittal_id
     AND sequence    >= v_target_seq
     AND sequence    <= v_current_seq;

  UPDATE public.submittal_reviewers
     SET is_open = true
   WHERE id = p_target_step_id;

  UPDATE public.submittals
     SET current_reviewer_id   = v_target_user,
         current_reviewer_role = v_target_role,
         ball_in_court_since   = now(),
         updated_at            = now()
   WHERE id = v_submittal_id;

  -- Auto-comment capturing the send-back reason.
  INSERT INTO public.submittal_step_comments
    (reviewer_step_id, author_id, body_md, reason_code)
  VALUES
    (p_target_step_id, v_actor,
     COALESCE(p_reason_code || E'\n\n', '') || COALESCE(p_comment_body, ''),
     p_reason_code)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_send_back(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_send_back(uuid, text, text) TO authenticated;

-- ── 6. RPC: create / edit / delete step comments ───────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_create_step_comment(
  p_reviewer_step_id uuid,
  p_body_md          text,
  p_attachments      jsonb,
  p_mentions         uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_project uuid;
  v_id      uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  IF p_body_md IS NULL OR length(trim(p_body_md)) = 0 THEN
    RAISE EXCEPTION 'Comment body is required';
  END IF;

  SELECT s.project_id INTO v_project
    FROM public.submittal_reviewers r
    JOIN public.submittals s ON s.id = r.submittal_id
   WHERE r.id = p_reviewer_step_id;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Reviewer step % not found', p_reviewer_step_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = v_project AND pm.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  INSERT INTO public.submittal_step_comments
    (reviewer_step_id, author_id, body_md, attachments, mentions)
  VALUES
    (p_reviewer_step_id, v_actor, p_body_md,
     COALESCE(p_attachments, '[]'::jsonb),
     COALESCE(p_mentions, '{}'::uuid[]))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_create_step_comment(uuid, text, jsonb, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_create_step_comment(uuid, text, jsonb, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.submittal_edit_step_comment(
  p_comment_id  uuid,
  p_body_md     text,
  p_attachments jsonb,
  p_mentions    uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_owner    uuid;
  v_step     uuid;
  v_new_id   uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;
  IF p_body_md IS NULL OR length(trim(p_body_md)) = 0 THEN
    RAISE EXCEPTION 'Comment body is required';
  END IF;

  SELECT author_id, reviewer_step_id INTO v_owner, v_step
    FROM public.submittal_step_comments WHERE id = p_comment_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Comment % not found', p_comment_id;
  END IF;
  IF v_owner <> v_actor THEN
    RAISE EXCEPTION 'Only the comment author can edit';
  END IF;

  -- An "edit" is a NEW row pointing at the prior version. The reader
  -- always renders the latest leaf per parent chain.
  INSERT INTO public.submittal_step_comments
    (reviewer_step_id, author_id, body_md, attachments, mentions, parent_comment_id)
  VALUES
    (v_step, v_actor, p_body_md,
     COALESCE(p_attachments, '[]'::jsonb),
     COALESCE(p_mentions, '{}'::uuid[]),
     p_comment_id)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_edit_step_comment(uuid, text, jsonb, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_edit_step_comment(uuid, text, jsonb, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.submittal_delete_step_comment(p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_owner   uuid;
  v_step    uuid;
  v_project uuid;
  v_role    text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT c.author_id, c.reviewer_step_id INTO v_owner, v_step
    FROM public.submittal_step_comments c WHERE c.id = p_comment_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Comment % not found', p_comment_id;
  END IF;

  -- Author can delete; PM/admin/owner role can delete any.
  IF v_owner = v_actor THEN
    UPDATE public.submittal_step_comments SET is_deleted = true WHERE id = p_comment_id;
    RETURN;
  END IF;

  SELECT s.project_id INTO v_project
    FROM public.submittal_reviewers r
    JOIN public.submittals s ON s.id = r.submittal_id
   WHERE r.id = v_step;
  SELECT pm.role INTO v_role
    FROM public.project_members pm
   WHERE pm.project_id = v_project AND pm.user_id = v_actor;
  IF v_role IN ('owner', 'admin', 'project_manager') THEN
    UPDATE public.submittal_step_comments SET is_deleted = true WHERE id = p_comment_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Not authorized to delete this comment';
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_delete_step_comment(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_delete_step_comment(uuid) TO authenticated;

-- =============================================================================
-- End of Phase 7c-1 multi-approval migration.
-- =============================================================================
