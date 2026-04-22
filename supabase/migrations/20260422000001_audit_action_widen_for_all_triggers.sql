-- =============================================================================
-- Fix: audit_log_action_check rejects actions from fn_audit_trigger()
-- =============================================================================
--
-- PROBLEM: fn_audit_trigger() produces actions shaped as
--   {TG_TABLE_NAME}.{created|updated|deleted}
-- for any table not explicitly mapped (e.g. schedule_phases.created,
-- files.updated, equipment.deleted, equipment_maintenance.created).
--
-- The current CHECK only whitelists a small set of these (rfi.*,
-- rfi_response.added, entity.*). Any INSERT/UPDATE/DELETE on
-- schedule_phases, files, equipment, equipment_maintenance therefore
-- fails with:
--   new row for relation "audit_log" violates check constraint
--   "audit_log_action_check"
--
-- This surfaced during Schedule import (bulk insert into schedule_phases).
--
-- FIX: Widen the CHECK to accept any action matching the canonical
-- {entity}.{verb} shape, while keeping the legacy short values and the
-- raw TG_OP values that historical rows already contain.
-- =============================================================================

BEGIN;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (
    action IN (
      'create', 'update', 'delete', 'status_change',
      'approve', 'reject', 'submit', 'close',
      'INSERT', 'UPDATE', 'DELETE'
    )
    OR action ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'
  );

COMMIT;
