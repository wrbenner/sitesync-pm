-- =============================================================================
-- Phase 8 — Native Markup + Rev-Diff + Distribute + Stamp.
--
-- Builds on the existing canonical schema (submittal_markup, submittal_distributions,
-- submittal_reviewers.stamp_url already exist from PR #328).
--
-- Adds:
--   1. submittal_create_markup       — insert with project-membership gate
--   2. submittal_delete_markup       — delete-by-id with author/PM gate
--   3. submittal_distribute_v2       — richer than v1: emails + message
--                                      + auto-pin flag + magic-link flag
--   4. submittal_record_stamp_url    — persists stamp pdf URL on a reviewer
--                                      after edge fn generates it
--
-- ADDITIVE only. Idempotent re-apply via OR REPLACE.
-- =============================================================================

-- ── 1. submittal_create_markup ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_create_markup(
  p_submittal_item_id uuid,
  p_rev_number        int,
  p_pdf_page          int,
  p_geometry          jsonb,
  p_kind              text,
  p_comment_md        text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_project   uuid;
  v_markup_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  -- Verify item exists and resolve its project for the membership gate.
  SELECT s.project_id INTO v_project
    FROM public.submittal_items i
    JOIN public.submittals s ON s.id = i.submittal_id
   WHERE i.id = p_submittal_item_id;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Submittal item % not found', p_submittal_item_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = v_project AND pm.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  IF p_kind NOT IN ('highlight', 'callout', 'redline', 'stamp', 'pen', 'text') THEN
    RAISE EXCEPTION 'Unknown markup kind: %', p_kind;
  END IF;

  INSERT INTO public.submittal_markup
    (submittal_item_id, rev_number, pdf_page, geometry, kind, comment_md, created_by)
  VALUES
    (p_submittal_item_id, p_rev_number, p_pdf_page, p_geometry, p_kind, p_comment_md, v_actor)
  RETURNING id INTO v_markup_id;

  RETURN v_markup_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_create_markup(uuid, int, int, jsonb, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_create_markup(uuid, int, int, jsonb, text, text) TO authenticated;

-- ── 2. submittal_delete_markup ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submittal_delete_markup(p_markup_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_owner   uuid;
  v_project uuid;
  v_role    text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT m.created_by, s.project_id INTO v_owner, v_project
    FROM public.submittal_markup m
    JOIN public.submittal_items i ON i.id = m.submittal_item_id
    JOIN public.submittals s ON s.id = i.submittal_id
   WHERE m.id = p_markup_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Markup % not found', p_markup_id;
  END IF;

  -- Author can delete their own markup. Project managers / admins / owners
  -- can delete any markup on their project.
  IF v_owner = v_actor THEN
    -- own markup — allow
    DELETE FROM public.submittal_markup WHERE id = p_markup_id;
    RETURN;
  END IF;

  SELECT pm.role INTO v_role
    FROM public.project_members pm
   WHERE pm.project_id = v_project AND pm.user_id = v_actor;

  IF v_role IN ('owner', 'admin', 'project_manager') THEN
    DELETE FROM public.submittal_markup WHERE id = p_markup_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Not authorized to delete this markup';
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_delete_markup(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_delete_markup(uuid) TO authenticated;

-- ── 3. submittal_distribute_v2 ─────────────────────────────────────────────
-- Richer than the v1 RPC: accepts emails + message + auto_pin_drawings flag +
-- magic_link flag. Logs to submittal_distributions and returns the row id so
-- the caller can render a confirmation toast or open the magic-link viewer.

CREATE OR REPLACE FUNCTION public.submittal_distribute_v2(
  p_id                  uuid,
  p_to_user_ids         uuid[],
  p_to_emails           text[],
  p_message             text,
  p_auto_pin_drawings   boolean,
  p_send_magic_link     boolean,
  p_pdf_url             text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor          uuid := auth.uid();
  v_submittal      public.submittals;
  v_distribution_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT * INTO v_submittal FROM public.submittals WHERE id = p_id;
  IF v_submittal.id IS NULL THEN
    RAISE EXCEPTION 'Submittal % not found', p_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = v_submittal.project_id AND pm.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  INSERT INTO public.submittal_distributions
    (submittal_id, distributed_by, to_user_ids, to_emails, message, pdf_url)
  VALUES
    (p_id, v_actor, COALESCE(p_to_user_ids, '{}'::uuid[]), COALESCE(p_to_emails, '{}'::text[]),
     p_message, p_pdf_url)
  RETURNING id INTO v_distribution_id;

  -- Auto-pin: when the submittal has linked drawing pins from Phase 5,
  -- they're automatically marked as "currently distributed" via the
  -- distributed_at timestamp. Phase 8 ships the persistence; the field-
  -- side rendering (red dot on the drawing sheet at the pin location)
  -- comes online when the drawings viewer wires that flag.
  IF p_auto_pin_drawings AND to_regclass('public.submittal_drawing_pins') IS NOT NULL THEN
    UPDATE public.submittal_drawing_pins
       SET note = COALESCE(note, '') ||
                  CASE WHEN note IS NOT NULL AND note <> '' THEN ' · ' ELSE '' END ||
                  'Distributed ' || to_char(now(), 'YYYY-MM-DD')
     WHERE submittal_id = p_id;
  END IF;

  -- Magic-link: when requested, generate a row in submittal_magic_links
  -- (table from the canonical migration). Phase 8 stores the intent;
  -- Phase 9 wires the actual sub portal that consumes the token.
  IF p_send_magic_link AND to_regclass('public.submittal_magic_links') IS NOT NULL THEN
    INSERT INTO public.submittal_magic_links
      (token, submittal_id, intent, email, expires_at)
    SELECT
      encode(gen_random_bytes(24), 'hex') || '_' || extract(epoch from now())::text,
      p_id,
      'distribute_view',
      e,
      now() + interval '14 days'
    FROM unnest(COALESCE(p_to_emails, '{}'::text[])) AS e
    WHERE e IS NOT NULL AND e <> '';
  END IF;

  RETURN v_distribution_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_distribute_v2(uuid, uuid[], text[], text, boolean, boolean, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_distribute_v2(uuid, uuid[], text[], text, boolean, boolean, text) TO authenticated;

-- ── 4. submittal_record_stamp_url ──────────────────────────────────────────
-- Called by the submittal-stamp-pdf edge function after it generates the
-- stamp PDF and stores it in object storage. Sets the stamp_url on the
-- specified reviewer's row.

CREATE OR REPLACE FUNCTION public.submittal_record_stamp_url(
  p_reviewer_id uuid,
  p_stamp_url   text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_project uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT s.project_id INTO v_project
    FROM public.submittal_reviewers r
    JOIN public.submittals s ON s.id = r.submittal_id
   WHERE r.id = p_reviewer_id;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Reviewer % not found', p_reviewer_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = v_project AND pm.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  UPDATE public.submittal_reviewers
     SET stamp_url = p_stamp_url
   WHERE id = p_reviewer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_record_stamp_url(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_record_stamp_url(uuid, text) TO authenticated;

-- =============================================================================
-- End of Phase 8 markup + distribute + stamp migration.
-- =============================================================================
