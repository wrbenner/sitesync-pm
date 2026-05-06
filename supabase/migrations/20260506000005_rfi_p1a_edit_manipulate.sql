-- ═══════════════════════════════════════════════════════════════
-- Migration: RFI P1a — edit & manipulate parity
-- Version:   20260506000005
--
-- Drives:    Procore-parity edit/manipulate work per
--            docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md
--
-- Scope (DB shape only; UI lives in src/):
--   1. Soft-delete on rfis: deleted_at TIMESTAMPTZ + RLS filter
--   2. New columns for full Edit panel: schedule_days_impact,
--      cost_impact_cents (per src/types/money.ts), is_private,
--      reference, question (rich-text body)
--   3. New table project_role_groups for distribution role-group
--      quick-add ("All MEP designers", "Architect of record")
--   4. Seed one role group on each existing project so the typeahead
--      has data immediately for the demo
--
-- Idempotent: safe to rerun.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Soft-delete on rfis ─────────────────────────────────────
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Active-rows lookup is by far the hottest path; partial index keeps it
-- cheap. The Recycle Bin tab queries the inverse and accepts the seq scan
-- (population is small by definition).
CREATE INDEX IF NOT EXISTS idx_rfis_deleted_at_active
  ON rfis(project_id, status)
  WHERE deleted_at IS NULL;

-- Update the SELECT policy to filter out soft-deleted rows. Soft-deleted
-- rows are surfaced through the dedicated recycle bin RPC below, which
-- runs SECURITY DEFINER so the RLS filter doesn't fire.
DROP POLICY IF EXISTS rfis_select ON rfis;
CREATE POLICY rfis_select ON rfis FOR SELECT
  USING (
    is_project_member(project_id) AND deleted_at IS NULL
  );

-- ── 2. New rfi columns for the full Edit panel ─────────────────
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS question TEXT;
-- Schedule impact: positive integer = days the RFI is forecast to push
-- the schedule. NULL = unknown / TBD.
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS schedule_days_impact INTEGER;
-- Cost impact: stored in cents per src/types/money.ts. NULL = unknown.
-- The legacy `cost_impact NUMERIC` column from 00013 is kept for backward
-- compatibility; new writes go to cost_impact_cents and the UI reads cents
-- preferentially.
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS cost_impact_cents BIGINT;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS reference TEXT;

-- ── 3. project_role_groups for distribution quick-add ──────────
CREATE TABLE IF NOT EXISTS project_role_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  -- Member emails carry external addresses too (not every distribution
  -- recipient is a SiteSync user). Store emails directly so the typeahead
  -- doesn't have to dual-resolve user_ids + outside contacts.
  member_emails TEXT[] NOT NULL DEFAULT '{}',
  -- Optional names paralleling member_emails for prettier chip rendering.
  member_names  TEXT[] NOT NULL DEFAULT '{}',
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_project_role_groups_project
  ON project_role_groups(project_id);

ALTER TABLE project_role_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_role_groups_select ON project_role_groups;
CREATE POLICY project_role_groups_select ON project_role_groups FOR SELECT
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS project_role_groups_insert ON project_role_groups;
CREATE POLICY project_role_groups_insert ON project_role_groups FOR INSERT
  WITH CHECK (
    is_project_role(project_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS project_role_groups_update ON project_role_groups;
CREATE POLICY project_role_groups_update ON project_role_groups FOR UPDATE
  USING (is_project_role(project_id, ARRAY['owner', 'admin']))
  WITH CHECK (is_project_role(project_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS project_role_groups_delete ON project_role_groups;
CREATE POLICY project_role_groups_delete ON project_role_groups FOR DELETE
  USING (is_project_role(project_id, ARRAY['owner', 'admin']));

-- updated_at trigger
CREATE OR REPLACE FUNCTION fn_project_role_groups_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_role_groups_touch ON project_role_groups;
CREATE TRIGGER trg_project_role_groups_touch
  BEFORE UPDATE ON project_role_groups
  FOR EACH ROW
  EXECUTE FUNCTION fn_project_role_groups_touch();

-- ── 4. Recycle bin RPC (bypasses the deleted_at IS NULL filter) ─
-- Returns soft-deleted RFIs for a project. RLS-equivalent: only project
-- members can read (re-checked here), even though the function is
-- SECURITY DEFINER (which bypasses the column-level filter on rfis).
CREATE OR REPLACE FUNCTION list_deleted_rfis(p_project_id uuid)
RETURNS SETOF rfis
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_project_member(p_project_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT * FROM rfis
    WHERE project_id = p_project_id
      AND deleted_at IS NOT NULL
    ORDER BY deleted_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_deleted_rfis(uuid) TO authenticated;

-- Restore RPC: clear deleted_at + deleted_by. SECURITY DEFINER so the
-- restored row reappears via the standard SELECT policy on the next
-- query. Write permission re-checked against project membership.
CREATE OR REPLACE FUNCTION restore_rfi(p_rfi_id uuid)
RETURNS rfis
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_row rfis;
BEGIN
  SELECT project_id INTO v_project_id FROM rfis WHERE id = p_rfi_id;
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42704';
  END IF;
  IF NOT is_project_role(v_project_id, ARRAY['owner', 'admin', 'member']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE rfis
    SET deleted_at = NULL, deleted_by = NULL, updated_at = now()
    WHERE id = p_rfi_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION restore_rfi(uuid) TO authenticated;

-- ── 5. Seed one role group per existing project ─────────────────
-- The MEP-designers group is a sensible cross-project default for a
-- multifamily/commercial GC; demo data needs at least one row so the
-- typeahead has something to surface on first load.
INSERT INTO project_role_groups (project_id, name, member_emails, member_names)
SELECT p.id, 'All MEP designers',
       ARRAY['mep-design@example.com', 'plumbing-design@example.com', 'electrical-design@example.com'],
       ARRAY['MEP Design Lead', 'Plumbing Designer', 'Electrical Designer']
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM project_role_groups g
  WHERE g.project_id = p.id AND g.name = 'All MEP designers'
);

INSERT INTO project_role_groups (project_id, name, member_emails, member_names)
SELECT p.id, 'Architect of record',
       ARRAY['architect@example.com'],
       ARRAY['Architect of Record']
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM project_role_groups g
  WHERE g.project_id = p.id AND g.name = 'Architect of record'
);
