-- =============================================================================
-- submittal_saved_views — Phase 3 of submittals page rebuild
--
-- Spec: docs/audits/SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 3 §C
-- Stores filter + columns + sort + view-type + grouping + pinned columns +
-- column widths per saved view. Four scopes: my / project / company / iris.
--
-- RLS:
--   * my-scope     → owner_user_id = auth.uid()
--   * project-scope → caller is a project_member
--   * company-scope → caller is in the project's organization (org-wide
--                     shared view; admin creates, team members read+apply)
--   * iris-scope    → project members read-only (Iris creates via SECURITY
--                     DEFINER seed RPC; users can't INSERT/UPDATE/DELETE)
--
-- ADDITIVE only. Idempotent re-apply via IF NOT EXISTS.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE submittal_saved_view_scope AS ENUM ('my', 'project', 'company', 'iris');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.submittal_saved_views (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scope           submittal_saved_view_scope NOT NULL,
  -- NULL for project / company / iris scopes (anyone in scope can read)
  owner_user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  -- view_state shape (per Phase 3 §C):
  --   {
  --     filters: { [chipId: string]: <chip-specific-shape> },
  --     columns: { id, hidden?, pin?, width?, sort? }[],
  --     sort:    { columnId, direction } | null,
  --     viewType: 'items' | 'packages' | 'spec_sections' | 'ball_in_court' |
  --               'kanban' | 'timeline' | 'schedule' | 'recycle_bin',
  --     grouping: 'none' | 'csi_section' | 'sub' | 'reviewer',
  --   }
  view_state      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- True iff this is the user's default view in their scope (UI shows it
  -- pre-applied on first project visit). Only meaningful for 'my' scope;
  -- ignored for shared scopes.
  is_default      boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- A 'my' scope row MUST have an owner; iris/project/company MUST NOT.
  CONSTRAINT submittal_saved_views_scope_owner_check CHECK (
    (scope = 'my' AND owner_user_id IS NOT NULL)
    OR (scope IN ('project', 'company', 'iris') AND owner_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_submittal_saved_views_project_scope
  ON public.submittal_saved_views (project_id, scope);
CREATE INDEX IF NOT EXISTS idx_submittal_saved_views_owner
  ON public.submittal_saved_views (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

ALTER TABLE public.submittal_saved_views ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ────────────────────────────────────────────────────────────

-- 1. SELECT — scope-dependent.
DROP POLICY IF EXISTS submittal_saved_views_select ON public.submittal_saved_views;
CREATE POLICY submittal_saved_views_select ON public.submittal_saved_views
  FOR SELECT
  USING (
    -- my-scope: owner only
    (scope = 'my' AND owner_user_id = auth.uid())
    OR
    -- project-scope + iris-scope: any project member
    (scope IN ('project', 'iris')
      AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
    OR
    -- company-scope: any organization member (project's org)
    (scope = 'company'
      AND project_id IN (
        SELECT p.id FROM public.projects p
        JOIN public.organization_members om
          ON om.organization_id::uuid = p.organization_id
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- 2. INSERT — only by users with the right scope authority.
DROP POLICY IF EXISTS submittal_saved_views_insert ON public.submittal_saved_views;
CREATE POLICY submittal_saved_views_insert ON public.submittal_saved_views
  FOR INSERT
  WITH CHECK (
    -- my-scope: any project member can save their own view
    (scope = 'my'
      AND owner_user_id = auth.uid()
      AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
      )
    )
    OR
    -- project-scope: project_members with role admin/owner/project_manager
    (scope = 'project'
      AND owner_user_id IS NULL
      AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    )
    OR
    -- company-scope: organization_members with role admin/owner only
    (scope = 'company'
      AND owner_user_id IS NULL
      AND project_id IN (
        SELECT p.id FROM public.projects p
        JOIN public.organization_members om
          ON om.organization_id::uuid = p.organization_id
        WHERE om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    )
    -- iris-scope: BLOCKED for direct INSERT. The seed RPC runs as
    -- SECURITY DEFINER and bypasses this policy; users can't manually
    -- create iris views.
  );

-- 3. UPDATE — same authority as INSERT.
DROP POLICY IF EXISTS submittal_saved_views_update ON public.submittal_saved_views;
CREATE POLICY submittal_saved_views_update ON public.submittal_saved_views
  FOR UPDATE
  USING (
    (scope = 'my' AND owner_user_id = auth.uid())
    OR (scope = 'project'
      AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    )
    OR (scope = 'company'
      AND project_id IN (
        SELECT p.id FROM public.projects p
        JOIN public.organization_members om
          ON om.organization_id::uuid = p.organization_id
        WHERE om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    )
    -- iris-scope: not editable by users
  );

-- 4. DELETE — same authority.
DROP POLICY IF EXISTS submittal_saved_views_delete ON public.submittal_saved_views;
CREATE POLICY submittal_saved_views_delete ON public.submittal_saved_views
  FOR DELETE
  USING (
    (scope = 'my' AND owner_user_id = auth.uid())
    OR (scope = 'project'
      AND project_id IN (
        SELECT pm.project_id FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'project_manager')
      )
    )
    OR (scope = 'company'
      AND project_id IN (
        SELECT p.id FROM public.projects p
        JOIN public.organization_members om
          ON om.organization_id::uuid = p.organization_id
        WHERE om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    )
  );

-- ── updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_submittal_saved_views_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submittal_saved_views_updated_at
  ON public.submittal_saved_views;
CREATE TRIGGER trg_submittal_saved_views_updated_at
  BEFORE UPDATE ON public.submittal_saved_views
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_submittal_saved_views_updated_at();

-- ── Iris-suggested seed RPC ─────────────────────────────────────────────────
-- Called per-project on first /submittals visit. Idempotent — only seeds
-- if the project has no iris-scope views yet. Returns the count seeded.

CREATE OR REPLACE FUNCTION public.seed_iris_suggested_submittal_views(
  p_project_id  uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  -- Idempotency: if project already has iris views, no-op.
  SELECT count(*) INTO v_count
    FROM public.submittal_saved_views
   WHERE project_id = p_project_id AND scope = 'iris';
  IF v_count > 0 THEN
    RETURN 0;
  END IF;

  -- Membership check: caller must be on the project.
  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  INSERT INTO public.submittal_saved_views
    (project_id, scope, owner_user_id, name, description, view_state, is_default)
  VALUES
    (p_project_id, 'iris', NULL,
     'Overdue at Architect',
     'BIC role contains "arch" + days_in_court > project SLA',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'ball_in_court_role_substring', 'arch',
         'days_in_court_over_sla', true
       ),
       'viewType', 'items',
       'grouping', 'none'
     ),
     false),
    (p_project_id, 'iris', NULL,
     'Long-lead → Schedule Risk',
     'Lead time > 8 weeks AND on critical path',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'lead_time_weeks_gte', 8,
         'is_critical_path', true
       ),
       'viewType', 'items',
       'grouping', 'none'
     ),
     false),
    (p_project_id, 'iris', NULL,
     'Resubmit count > 1',
     'Submittals with rev_number ≥ 2 (multiple resubmissions)',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'rev_number_gte', 2
       ),
       'viewType', 'items',
       'grouping', 'none'
     ),
     false),
    (p_project_id, 'iris', NULL,
     'Federal Closeout Package',
     'Warranty / closeout / maintenance kinds, federal projects only',
     jsonb_build_object(
       'filters', jsonb_build_object(
         'kind', jsonb_build_array('warranty', 'closeout', 'maintenance'),
         'is_federal', true
       ),
       'viewType', 'items',
       'grouping', 'csi_section'
     ),
     false);

  RETURN 4;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_iris_suggested_submittal_views(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.seed_iris_suggested_submittal_views(uuid) TO authenticated;

COMMENT ON FUNCTION public.seed_iris_suggested_submittal_views(uuid) IS
  'Seeds 4 iris-scope views per project on first call. Idempotent — no-ops '
  'if the project already has iris views. Caller must be a project member.';

-- =============================================================================
-- End of Phase 3 saved-views migration.
-- =============================================================================
