-- =============================================================================
-- Equipment Service Layer: Provenance, soft-delete, checkout, and RLS
-- =============================================================================
--
-- PURPOSE: Extend equipment tables to support the service layer pattern used by
-- rfiService.ts: provenance columns (created_by, updated_by), soft-delete
-- (deleted_at, deleted_by), checkout/checkin tracking, and audit trail.
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds created_by, updated_by (provenance) to equipment, equipment_maintenance,
--      equipment_logs
--   2. Adds deleted_at, deleted_by (soft-delete) to equipment, equipment_maintenance
--   3. Adds checkout tracking columns (assigned_to, checkout_date, checkin_date)
--      to equipment
--   4. Refines RLS policies for multi-tenant equipment access using
--      has_project_permission() on current_project_id
--   5. Attaches the existing fn_audit_trigger() for audit trail on equipment
--      and equipment_maintenance
--   6. Adds partial indexes for active (non-deleted, non-retired) equipment
--
-- EXISTING RLS (from 00052_enable_rls.sql):
--   Basic project-member checks via is_project_member(). This migration
--   replaces them with more granular has_project_permission() checks.
--
-- SOFT DELETE NOTE:
--   Physical DELETE is blocked by RLS for non-admins. The service layer
--   uses UPDATE to set deleted_at/deleted_by. "retired" equipment gets
--   deleted_at set so it is excluded from normal queries.
--
-- BACKWARD COMPATIBILITY:
--   All new columns are nullable/defaulted. Existing rows get NULL defaults.
--   No existing queries break. fn_audit_trigger() already exists from
--   20260415000002_rfi_audit_trigger.sql.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_equipment_audit ON equipment;
--   DROP TRIGGER IF EXISTS trg_equipment_maintenance_audit ON equipment_maintenance;
--   DROP INDEX IF EXISTS idx_equipment_active;
--   DROP INDEX IF EXISTS idx_equipment_maintenance_active;
--   ALTER TABLE equipment
--     DROP COLUMN IF EXISTS created_by,
--     DROP COLUMN IF EXISTS updated_by,
--     DROP COLUMN IF EXISTS deleted_at,
--     DROP COLUMN IF EXISTS deleted_by,
--     DROP COLUMN IF EXISTS assigned_to,
--     DROP COLUMN IF EXISTS checkout_date,
--     DROP COLUMN IF EXISTS checkin_date;
--   ALTER TABLE equipment_maintenance
--     DROP COLUMN IF EXISTS created_by,
--     DROP COLUMN IF EXISTS updated_by,
--     DROP COLUMN IF EXISTS deleted_at,
--     DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE equipment_logs
--     DROP COLUMN IF EXISTS created_by;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Provenance columns on equipment
-- ---------------------------------------------------------------------------
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 2. Soft-delete columns on equipment
-- ---------------------------------------------------------------------------
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 3. Checkout tracking columns on equipment
-- ---------------------------------------------------------------------------
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS assigned_to   uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS checkout_date timestamptz,
  ADD COLUMN IF NOT EXISTS checkin_date  timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Provenance + soft-delete on equipment_maintenance
-- ---------------------------------------------------------------------------
ALTER TABLE equipment_maintenance
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 5. Provenance on equipment_logs
-- ---------------------------------------------------------------------------
ALTER TABLE equipment_logs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 6. Partial indexes for active-only queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_equipment_active
  ON equipment (current_project_id, name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_active
  ON equipment_maintenance (equipment_id, scheduled_date)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 7. RLS: drop old policies and create granular ones
--    Uses has_project_permission() which checks project_members.role.
--    Equipment is multi-tenant: access is scoped to current_project_id.
-- ---------------------------------------------------------------------------

-- equipment table
DROP POLICY IF EXISTS equipment_select ON equipment;
DROP POLICY IF EXISTS equipment_insert ON equipment;
DROP POLICY IF EXISTS equipment_update ON equipment;
DROP POLICY IF EXISTS equipment_delete ON equipment;

CREATE POLICY equipment_select ON equipment FOR SELECT
  USING (
    current_project_id IS NOT NULL
    AND has_project_permission(current_project_id, 'viewer')
  );

CREATE POLICY equipment_insert ON equipment FOR INSERT
  WITH CHECK (
    project_id IS NOT NULL
    AND has_project_permission(project_id, 'foreman')
  );

CREATE POLICY equipment_update ON equipment FOR UPDATE
  USING (
    current_project_id IS NOT NULL
    AND has_project_permission(current_project_id, 'foreman')
  );

-- Hard deletes are forbidden — service layer uses soft-delete only
CREATE POLICY equipment_delete ON equipment FOR DELETE
  USING (
    current_project_id IS NOT NULL
    AND has_project_permission(current_project_id, 'admin')
  );

-- equipment_maintenance table
DROP POLICY IF EXISTS equipment_maintenance_select ON equipment_maintenance;
DROP POLICY IF EXISTS equipment_maintenance_insert ON equipment_maintenance;
DROP POLICY IF EXISTS equipment_maintenance_update ON equipment_maintenance;

CREATE POLICY equipment_maintenance_select ON equipment_maintenance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM equipment e
      WHERE e.id = equipment_maintenance.equipment_id
        AND e.current_project_id IS NOT NULL
        AND has_project_permission(e.current_project_id, 'viewer')
    )
  );

CREATE POLICY equipment_maintenance_insert ON equipment_maintenance FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM equipment e
      WHERE e.id = equipment_id
        AND e.current_project_id IS NOT NULL
        AND has_project_permission(e.current_project_id, 'superintendent')
    )
  );

CREATE POLICY equipment_maintenance_update ON equipment_maintenance FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM equipment e
      WHERE e.id = equipment_maintenance.equipment_id
        AND e.current_project_id IS NOT NULL
        AND has_project_permission(e.current_project_id, 'superintendent')
    )
  );

-- equipment_logs table
DROP POLICY IF EXISTS equipment_logs_select ON equipment_logs;
DROP POLICY IF EXISTS equipment_logs_insert ON equipment_logs;

CREATE POLICY equipment_logs_select ON equipment_logs FOR SELECT
  USING (
    project_id IS NOT NULL
    AND has_project_permission(project_id, 'viewer')
  );

CREATE POLICY equipment_logs_insert ON equipment_logs FOR INSERT
  WITH CHECK (
    project_id IS NOT NULL
    AND has_project_permission(project_id, 'foreman')
  );

-- ---------------------------------------------------------------------------
-- 8. Audit triggers using existing fn_audit_trigger()
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_equipment_audit ON equipment;
CREATE TRIGGER trg_equipment_audit
  AFTER INSERT OR UPDATE OR DELETE ON equipment
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_equipment_maintenance_audit ON equipment_maintenance;
CREATE TRIGGER trg_equipment_maintenance_audit
  AFTER INSERT OR UPDATE OR DELETE ON equipment_maintenance
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

COMMIT;
