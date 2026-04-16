-- =============================================================================
-- Schedule Service Layer: Provenance, soft-delete, milestones, and RLS
-- =============================================================================
--
-- PURPOSE: Extend schedule_phases to support the service layer pattern used by
-- rfiService.ts: provenance columns (created_by, updated_by), soft-delete
-- (deleted_at, deleted_by), milestone tracking (is_milestone), and audit trail.
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds created_by, updated_by (provenance) to schedule_phases
--   2. Adds deleted_at, deleted_by (soft-delete) to schedule_phases
--   3. Adds is_milestone (boolean) for milestone phase tracking
--   4. Refines RLS policies: superintendents can now UPDATE (field progress)
--   5. Attaches the existing fn_audit_trigger() for audit trail
--   6. Adds a partial index for active (non-deleted) phase queries
--
-- EXISTING RLS (from 00052_enable_rls.sql):
--   SELECT: viewer+ (unchanged)
--   INSERT: project_manager+ (unchanged)
--   UPDATE: project_manager+ (EXPANDED to include superintendent)
--   DELETE: project_manager+ (unchanged, hard delete only via RLS)
--
-- SOFT DELETE NOTE:
--   Physical DELETE via the API is blocked for viewers/subs. The service layer
--   uses UPDATE to set deleted_at/deleted_by (soft delete), which the refined
--   UPDATE policy allows for superintendent+.
--
-- BACKWARD COMPATIBILITY:
--   All new columns are nullable/defaulted. Existing rows get NULL/false.
--   No existing queries break. The fn_audit_trigger() function already exists
--   from 20260415000002_rfi_audit_trigger.sql.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_schedule_phases_audit ON schedule_phases;
--   DROP POLICY IF EXISTS schedule_phases_update ON schedule_phases;
--   CREATE POLICY schedule_phases_update ON schedule_phases FOR UPDATE
--     USING (has_project_permission(project_id, 'project_manager'));
--   DROP INDEX IF EXISTS idx_schedule_phases_active;
--   ALTER TABLE schedule_phases
--     DROP COLUMN IF EXISTS created_by,
--     DROP COLUMN IF EXISTS updated_by,
--     DROP COLUMN IF EXISTS deleted_at,
--     DROP COLUMN IF EXISTS deleted_by,
--     DROP COLUMN IF EXISTS is_milestone;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Provenance columns
-- ---------------------------------------------------------------------------
ALTER TABLE schedule_phases
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 2. Soft-delete columns
-- ---------------------------------------------------------------------------
ALTER TABLE schedule_phases
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 3. Milestone flag
-- ---------------------------------------------------------------------------
ALTER TABLE schedule_phases
  ADD COLUMN IF NOT EXISTS is_milestone boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 4. Partial index for efficient active-only queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_schedule_phases_active
  ON schedule_phases (project_id, start_date)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Refine UPDATE policy: add superintendent access
--    Superintendents update percent_complete and status from the field.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS schedule_phases_update ON schedule_phases;
CREATE POLICY schedule_phases_update ON schedule_phases FOR UPDATE
  USING (has_project_permission(project_id, 'superintendent'));

-- ---------------------------------------------------------------------------
-- 6. Audit trigger using existing fn_audit_trigger()
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_schedule_phases_audit ON schedule_phases;
CREATE TRIGGER trg_schedule_phases_audit
  AFTER INSERT OR UPDATE OR DELETE ON schedule_phases
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

COMMIT;
