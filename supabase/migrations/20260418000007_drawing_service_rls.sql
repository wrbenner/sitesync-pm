-- Drawing service RLS policies.
-- Enforces role-based access on drawings and drawing_markups using the
-- has_project_permission() helper (defined in 00033_rls_permission_enforcement).
--
-- Access model:
--   drawings:         viewer=SELECT, project_manager=INSERT/UPDATE, admin/owner=DELETE
--   drawing_markups:  viewer=SELECT, superintendent+=INSERT/UPDATE, project_manager=DELETE

-- ---------------------------------------------------------------------------
-- drawings
-- ---------------------------------------------------------------------------

ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;

-- All project members can view non-archived drawings.
DROP POLICY IF EXISTS drawings_select ON drawings;
CREATE POLICY drawings_select ON drawings FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

-- Uploading and creating drawings requires at minimum project_manager role.
DROP POLICY IF EXISTS drawings_insert ON drawings;
CREATE POLICY drawings_insert ON drawings FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));

-- Updating drawing metadata or status requires project_manager role.
DROP POLICY IF EXISTS drawings_update ON drawings;
CREATE POLICY drawings_update ON drawings FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

-- Hard-deleting a drawing row requires admin or owner; normal removal uses
-- the 'archived' status transition enforced by the service layer.
DROP POLICY IF EXISTS drawings_delete ON drawings;
CREATE POLICY drawings_delete ON drawings FOR DELETE
  USING (has_project_permission(project_id, 'admin'));

-- ---------------------------------------------------------------------------
-- drawing_markups (annotations)
-- ---------------------------------------------------------------------------

ALTER TABLE drawing_markups ENABLE ROW LEVEL SECURITY;

-- Any project member can view annotations on drawings they can access.
DROP POLICY IF EXISTS dm_select ON drawing_markups;
CREATE POLICY dm_select ON drawing_markups FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

-- Superintendents and above can create annotations.
DROP POLICY IF EXISTS dm_insert ON drawing_markups;
CREATE POLICY dm_insert ON drawing_markups FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'superintendent'));

-- Superintendents and above can update annotations.
DROP POLICY IF EXISTS dm_update ON drawing_markups;
CREATE POLICY dm_update ON drawing_markups FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

-- Project managers and above can delete annotations.
DROP POLICY IF EXISTS dm_delete ON drawing_markups;
CREATE POLICY dm_delete ON drawing_markups FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));
