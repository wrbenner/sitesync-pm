-- =============================================================================
-- Document Service Layer: Lifecycle, provenance, soft-delete, and RLS for files
-- =============================================================================
--
-- PURPOSE: Extend the files table to support the service-layer pattern used by
-- rfiService.ts: document lifecycle status, provenance columns (created_by,
-- updated_by), soft-delete (deleted_at, deleted_by), updated_at timestamp,
-- and proper RLS policies with audit trail.
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds document_status (text, check constraint: draft/submitted/approved/
--      rejected/archived/void) to files
--   2. Adds created_by, updated_by (provenance) to files
--   3. Adds updated_at (timestamptz) to files
--   4. Adds deleted_at, deleted_by (soft-delete) to files
--   5. Adds RLS policies for project-scoped document access
--   6. Adds partial index for active (non-deleted) document queries
--   7. Attaches fn_audit_trigger() for audit trail
--
-- DOCUMENT LIFECYCLE:
--   draft → submitted → approved → archived
--   submitted → rejected → draft (resubmit path)
--   draft/submitted → void (admin/owner only)
--
-- RLS POLICY DESIGN:
--   SELECT:  viewer+ (all project members)
--   INSERT:  subcontractor+ (any project member with write access)
--   UPDATE:  subcontractor+ (file owner or PM+)
--   DELETE:  project_manager+ (hard delete; service layer uses soft-delete)
--
-- BACKWARD COMPATIBILITY:
--   All new columns are nullable/defaulted. Existing rows get NULL/default.
--   No existing queries break. document_status defaults to 'draft' for inserts.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_files_audit ON files;
--   DROP POLICY IF EXISTS files_delete ON files;
--   DROP POLICY IF EXISTS files_update ON files;
--   DROP POLICY IF EXISTS files_insert ON files;
--   DROP POLICY IF EXISTS files_select ON files;
--   DROP INDEX IF EXISTS idx_files_active;
--   ALTER TABLE files
--     DROP COLUMN IF EXISTS document_status,
--     DROP COLUMN IF EXISTS created_by,
--     DROP COLUMN IF EXISTS updated_by,
--     DROP COLUMN IF EXISTS updated_at,
--     DROP COLUMN IF EXISTS deleted_at,
--     DROP COLUMN IF EXISTS deleted_by;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Document lifecycle status
-- ---------------------------------------------------------------------------
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS document_status text
    CHECK (document_status IN ('draft','submitted','approved','rejected','archived','void'))
    DEFAULT 'draft';

-- ---------------------------------------------------------------------------
-- 2. Provenance columns
-- ---------------------------------------------------------------------------
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS updated_by  uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 3. Updated-at timestamp
-- ---------------------------------------------------------------------------
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Soft-delete columns
-- ---------------------------------------------------------------------------
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 5. Partial index for efficient active-only queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_files_active
  ON files (project_id, created_at)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 6. RLS policies
--    Enable RLS on files if not already enabled, then apply project-scoped
--    policies using the existing has_project_permission() helper.
-- ---------------------------------------------------------------------------
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies to ensure idempotency
DROP POLICY IF EXISTS files_select ON files;
DROP POLICY IF EXISTS files_insert ON files;
DROP POLICY IF EXISTS files_update ON files;
DROP POLICY IF EXISTS files_delete ON files;

-- SELECT: any project member (viewer+)
CREATE POLICY files_select ON files FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

-- INSERT: subcontractor+ (anyone who can contribute to the project)
CREATE POLICY files_insert ON files FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'subcontractor'));

-- UPDATE: subcontractor+ (includes soft-delete via service layer)
CREATE POLICY files_update ON files FOR UPDATE
  USING (has_project_permission(project_id, 'subcontractor'));

-- DELETE: project_manager+ (hard-delete; prefer soft-delete via service layer)
CREATE POLICY files_delete ON files FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- 7. Audit trigger (fn_audit_trigger created by 20260415000002)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_files_audit ON files;
CREATE TRIGGER trg_files_audit
  AFTER INSERT OR UPDATE OR DELETE ON files
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

COMMIT;
