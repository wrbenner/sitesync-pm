-- 20260508020000_fix_rfis_assignees_rls_recursion.sql
--
-- Fix the infinite-recursion 500 on every SELECT against public.rfis.
--
-- Cycle introduced by 20260507000001_rfi_p1b_workflow_depth.sql:
--
--   rfis_select USING (
--     ...
--     OR EXISTS (SELECT 1 FROM rfi_assignees a
--                 WHERE a.rfi_id = rfis.id AND a.user_id = auth.uid())
--   )
--
--   rfi_assignees_select USING (
--     is_project_member((SELECT project_id FROM rfis WHERE rfis.id = rfi_id))
--   )
--
-- A SELECT on rfis fires rfis_select, which scans rfi_assignees, which
-- fires rfi_assignees_select, which scans rfis again -> Postgres detects
-- the recursion and aborts: "infinite recursion detected in policy for
-- relation rfis", returning 500 to every PostgREST request.
--
-- Fix: introduce two SECURITY DEFINER helpers that bypass RLS for the
-- exact lookups each policy needs, then rewrite both policies in terms
-- of the helpers. Either rewrite alone breaks the cycle; doing both
-- (defense in depth) also pays down the fragile pattern used across
-- every other child-of-rfis policy.
--
-- Idempotent. Safe to re-apply.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Helpers
-- ─────────────────────────────────────────────────────────────────────

-- Does (p_user_id) have an rfi_assignees row for (p_rfi_id)?
-- SECURITY DEFINER so the call does NOT re-enter rfi_assignees RLS.
CREATE OR REPLACE FUNCTION public.fn_user_is_rfi_assignee(
  p_rfi_id  uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.rfi_assignees
     WHERE rfi_id  = p_rfi_id
       AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.fn_user_is_rfi_assignee(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_user_is_rfi_assignee(uuid, uuid) TO authenticated;

-- Which project does (p_rfi_id) belong to?
-- SECURITY DEFINER so child-of-rfis policies can resolve project_id
-- without firing rfis_select.
CREATE OR REPLACE FUNCTION public.fn_rfi_project_id(p_rfi_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT project_id FROM public.rfis WHERE id = p_rfi_id;
$$;

REVOKE ALL ON FUNCTION public.fn_rfi_project_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_rfi_project_id(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 2. Rewrite rfis_select to use the helper
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rfis_select ON public.rfis;
CREATE POLICY rfis_select ON public.rfis FOR SELECT
  USING (
    is_project_member(project_id)
    AND deleted_at IS NULL
    AND (
      is_private = false
      OR is_project_role(project_id, ARRAY['owner','admin'])
      OR created_by    = (SELECT auth.uid())
      OR ball_in_court = (SELECT auth.uid())
      OR fn_user_is_rfi_assignee(id, (SELECT auth.uid()))
    )
  );


-- ─────────────────────────────────────────────────────────────────────
-- 3. Rewrite rfi_assignees_* to use the helper
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rfi_assignees_select ON public.rfi_assignees;
CREATE POLICY rfi_assignees_select ON public.rfi_assignees FOR SELECT
  USING (
    is_project_member(fn_rfi_project_id(rfi_id))
  );

DROP POLICY IF EXISTS rfi_assignees_insert ON public.rfi_assignees;
CREATE POLICY rfi_assignees_insert ON public.rfi_assignees FOR INSERT
  WITH CHECK (
    is_project_role(
      fn_rfi_project_id(rfi_id),
      ARRAY['owner','admin','member']
    )
  );

DROP POLICY IF EXISTS rfi_assignees_update ON public.rfi_assignees;
CREATE POLICY rfi_assignees_update ON public.rfi_assignees FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR is_project_role(
         fn_rfi_project_id(rfi_id),
         ARRAY['owner','admin','member']
       )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR is_project_role(
         fn_rfi_project_id(rfi_id),
         ARRAY['owner','admin','member']
       )
  );

DROP POLICY IF EXISTS rfi_assignees_delete ON public.rfi_assignees;
CREATE POLICY rfi_assignees_delete ON public.rfi_assignees FOR DELETE
  USING (
    is_project_role(
      fn_rfi_project_id(rfi_id),
      ARRAY['owner','admin','member']
    )
  );

COMMIT;
