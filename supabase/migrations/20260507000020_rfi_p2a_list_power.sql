-- ═══════════════════════════════════════════════════════════════
-- Migration: RFI P2a — list power
-- Version:   20260507000020
--
-- Drives:    saved views, column prefs, and the "exports use the right
--            template" path called out in
--            docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md §"List
--            manipulation".
--
-- Scope (DB only):
--
--   1. rfi_saved_views — Procore-mirror Saved Views with three scopes:
--        company  — visible to all org members; insert by org_admin/owner
--        project  — visible to project members; insert by project owner/admin
--        personal — visible only to owner; insert by self
--      Each view stores filter / column / sort JSONB. The UI reads the
--      JSONB blobs and applies them client-side so the same view shape
--      can drive Table, Kanban, and Calendar.
--
--   2. rfi_user_column_prefs — per-user column layout (visibility,
--      order, pin-left, width). Single-row-per-user-per-project upsert.
--
--   3. Default seed: each existing project gets the company-scope
--      "All RFIs" + "Overdue" baseline. Personal-scope defaults are
--      seeded on the user's first list visit (UI-side, not migration).
--
-- Idempotent: safe to rerun.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. rfi_saved_views ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfi_view_scope') THEN
    CREATE TYPE public.rfi_view_scope AS ENUM ('company', 'project', 'personal');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.rfi_saved_views (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- NULL when the view is company-scope or project-scope.
  owner_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scope        public.rfi_view_scope NOT NULL,
  name         TEXT NOT NULL,
  filters      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- columns: array of { id, visible, pinned, width } objects.
  columns      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- sort: array of { columnId, direction:'asc'|'desc' } objects (multi-sort).
  sort         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- color_by: optional 'status' | 'priority' for Calendar/Kanban tints.
  color_by     TEXT,
  -- view_mode: 'table' | 'kanban' | 'calendar' — the default mode this
  -- view opens in. UI overrides via URL param.
  view_mode    TEXT NOT NULL DEFAULT 'table',
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, scope, owner_id, name)
);

CREATE INDEX IF NOT EXISTS idx_rfi_saved_views_project_scope
  ON public.rfi_saved_views(project_id, scope);
CREATE INDEX IF NOT EXISTS idx_rfi_saved_views_owner
  ON public.rfi_saved_views(owner_id)
  WHERE owner_id IS NOT NULL;

ALTER TABLE public.rfi_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfi_saved_views_select ON public.rfi_saved_views;
CREATE POLICY rfi_saved_views_select ON public.rfi_saved_views FOR SELECT
  USING (
    -- Company scope: any org member of the project's org.
    (scope = 'company' AND EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = rfi_saved_views.project_id
        AND om.user_id = (SELECT auth.uid())
    ))
    -- Project scope: project member.
    OR (scope = 'project' AND is_project_member(project_id))
    -- Personal scope: owner only.
    OR (scope = 'personal' AND owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS rfi_saved_views_insert ON public.rfi_saved_views;
CREATE POLICY rfi_saved_views_insert ON public.rfi_saved_views FOR INSERT
  WITH CHECK (
    -- Company: org owner/admin.
    (scope = 'company' AND EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = rfi_saved_views.project_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner','admin')
    ))
    -- Project: project owner/admin.
    OR (scope = 'project' AND is_project_role(project_id, ARRAY['owner','admin']))
    -- Personal: self.
    OR (scope = 'personal' AND owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS rfi_saved_views_update ON public.rfi_saved_views;
CREATE POLICY rfi_saved_views_update ON public.rfi_saved_views FOR UPDATE
  USING (
    (scope = 'company' AND EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = rfi_saved_views.project_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner','admin')
    ))
    OR (scope = 'project' AND is_project_role(project_id, ARRAY['owner','admin']))
    OR (scope = 'personal' AND owner_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    (scope = 'company' AND EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = rfi_saved_views.project_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner','admin')
    ))
    OR (scope = 'project' AND is_project_role(project_id, ARRAY['owner','admin']))
    OR (scope = 'personal' AND owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS rfi_saved_views_delete ON public.rfi_saved_views;
CREATE POLICY rfi_saved_views_delete ON public.rfi_saved_views FOR DELETE
  USING (
    (scope = 'company' AND EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = rfi_saved_views.project_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner','admin')
    ))
    OR (scope = 'project' AND is_project_role(project_id, ARRAY['owner','admin']))
    OR (scope = 'personal' AND owner_id = (SELECT auth.uid()))
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION fn_rfi_saved_views_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rfi_saved_views_touch ON public.rfi_saved_views;
CREATE TRIGGER trg_rfi_saved_views_touch
  BEFORE UPDATE ON public.rfi_saved_views
  FOR EACH ROW EXECUTE FUNCTION fn_rfi_saved_views_touch();


-- ── 2. rfi_user_column_prefs ────────────────────────────────────
-- Per-user column layout. One row per (user_id, project_id). Upsert
-- pattern from the UI; absence falls back to the default column set.
CREATE TABLE IF NOT EXISTS public.rfi_user_column_prefs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- columns: array of { id, visible, pinned, width }.
  columns      JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_rfi_user_column_prefs_user
  ON public.rfi_user_column_prefs(user_id, project_id);

ALTER TABLE public.rfi_user_column_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfi_user_column_prefs_select ON public.rfi_user_column_prefs;
CREATE POLICY rfi_user_column_prefs_select ON public.rfi_user_column_prefs FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS rfi_user_column_prefs_insert ON public.rfi_user_column_prefs;
CREATE POLICY rfi_user_column_prefs_insert ON public.rfi_user_column_prefs FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS rfi_user_column_prefs_update ON public.rfi_user_column_prefs;
CREATE POLICY rfi_user_column_prefs_update ON public.rfi_user_column_prefs FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS rfi_user_column_prefs_delete ON public.rfi_user_column_prefs;
CREATE POLICY rfi_user_column_prefs_delete ON public.rfi_user_column_prefs FOR DELETE
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION fn_rfi_user_column_prefs_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rfi_user_column_prefs_touch ON public.rfi_user_column_prefs;
CREATE TRIGGER trg_rfi_user_column_prefs_touch
  BEFORE UPDATE ON public.rfi_user_column_prefs
  FOR EACH ROW EXECUTE FUNCTION fn_rfi_user_column_prefs_touch();


-- ── 3. Seed defaults — company + project scope ──────────────────
-- "All RFIs" — visible to all org members.
INSERT INTO public.rfi_saved_views (project_id, owner_id, scope, name, filters, view_mode, is_default)
SELECT p.id, NULL, 'company', 'All RFIs', '{}'::jsonb, 'table', true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.rfi_saved_views v
  WHERE v.project_id = p.id AND v.scope = 'company' AND v.name = 'All RFIs'
);

-- "Overdue" — Status open + due < today. Mirrors the existing chip filter.
INSERT INTO public.rfi_saved_views (project_id, owner_id, scope, name, filters, view_mode)
SELECT p.id, NULL, 'company', 'Overdue',
       '{"status": ["open","under_review","submitted"], "overdue": true}'::jsonb,
       'table'
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.rfi_saved_views v
  WHERE v.project_id = p.id AND v.scope = 'company' AND v.name = 'Overdue'
);

-- "At risk this week" — project-scope. Status not closed + due in next 7 days.
INSERT INTO public.rfi_saved_views (project_id, owner_id, scope, name, filters, view_mode)
SELECT p.id, NULL, 'project', 'At risk this week',
       '{"status_not": ["closed","void"], "due_within_days": 7}'::jsonb,
       'table'
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.rfi_saved_views v
  WHERE v.project_id = p.id AND v.scope = 'project' AND v.name = 'At risk this week'
);

COMMENT ON TABLE public.rfi_saved_views IS
  'Procore-mirror Saved Views for the RFI list. Three scopes: company, project, personal.';
COMMENT ON TABLE public.rfi_user_column_prefs IS
  'Per-user column layout for the RFI list (visibility/order/pin/width).';
