-- =============================================================================
-- Phase 5b — submittal_initialize_chain RPC
--
-- Atomically inserts a multi-reviewer chain when a new submittal is created
-- via the UnifiedCreateModal's ReviewerChainBuilder. Each step gets a
-- submittal_reviewers row with sequence + parallel_group + due_date + role.
-- Then calls submittal_advance_chain to flag the first step as is_open.
--
-- Idempotent re-apply via OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submittal_initialize_chain(
  p_submittal_id uuid,
  p_steps        jsonb  -- [{ sequence, reviewer_role, reviewer_name, parallel_group?, due_date_offset_days? }, ...]
) RETURNS int  -- count of steps inserted
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_project  uuid;
  v_count    int := 0;
  v_step     jsonb;
  v_due      date;
  v_offset   int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  SELECT project_id INTO v_project FROM public.submittals WHERE id = p_submittal_id;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Submittal % not found', p_submittal_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = v_project AND pm.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  -- Wipe any existing chain (idempotent re-init).
  DELETE FROM public.submittal_reviewers WHERE submittal_id = p_submittal_id;

  FOR v_step IN SELECT * FROM jsonb_array_elements(COALESCE(p_steps, '[]'::jsonb))
  LOOP
    v_offset := COALESCE((v_step->>'due_date_offset_days')::int, 7);
    v_due := (now() + (v_offset || ' days')::interval)::date;

    INSERT INTO public.submittal_reviewers
      (submittal_id, sequence, reviewer_role, reviewer_email, parallel_group, due_date)
    VALUES
      (p_submittal_id,
       (v_step->>'sequence')::int,
       v_step->>'reviewer_role',
       v_step->>'reviewer_name',         -- placeholder until typeahead lands
       NULLIF((v_step->>'parallel_group')::int, 0),
       v_due);
    v_count := v_count + 1;
  END LOOP;

  -- Flip is_open on the first step + set submittals.current_reviewer_role.
  -- (submittal_advance_chain is from Phase 7c-1 migration.)
  IF v_count > 0 THEN
    PERFORM public.submittal_advance_chain(p_submittal_id);
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.submittal_initialize_chain(uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submittal_initialize_chain(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.submittal_initialize_chain(uuid, jsonb) IS
  'Phase 5b: atomically materializes a multi-reviewer chain on a new submittal. '
  'Wipes any existing chain (idempotent). Calls submittal_advance_chain to '
  'flag the first step as is_open. reviewer_email holds the typed name '
  'until Phase 5b-2 wires the typeahead picker.';

-- =============================================================================
-- End of Phase 5b migration.
-- =============================================================================
