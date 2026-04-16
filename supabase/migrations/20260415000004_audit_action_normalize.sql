-- =============================================================================
-- Fix: Normalize audit action naming in fn_audit_trigger
-- =============================================================================
--
-- PROBLEM: The trigger writes raw Postgres TG_OP values (INSERT, UPDATE,
-- DELETE) while the existing app writes semantic values (create, update,
-- delete, status_change, etc.). This creates mixed vocabulary in the
-- audit_log.action field, making queries and evals harder.
--
-- FIX: Map TG_OP to canonical event names using the pattern:
--   {entity_type}.{operation}
--
-- Examples:
--   INSERT on rfis      → rfi.created
--   UPDATE on rfis      → rfi.updated
--   DELETE on rfis      → rfi.deleted
--   INSERT on rfi_responses → rfi_response.added
--
-- BACKWARD COMPATIBLE:
--   - Existing audit_log rows are NOT modified
--   - The CHECK constraint is widened to accept new canonical names
--   - Old values (create, update, INSERT, etc.) remain valid
--
-- ROLLBACK:
--   Revert fn_audit_trigger() to use TG_OP directly.
--   Revert audit_log_action_check to previous constraint.
-- =============================================================================

BEGIN;

-- 1. Widen CHECK to accept canonical event names (idempotent)
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN (
    -- Original app-generated values
    'create', 'update', 'delete', 'status_change', 'approve', 'reject', 'submit', 'close',
    -- Trigger-generated canonical values
    'rfi.created', 'rfi.updated', 'rfi.deleted',
    'rfi_response.added',
    -- Generic trigger values (for tables not yet mapped)
    'entity.created', 'entity.updated', 'entity.deleted',
    -- Legacy TG_OP values (preserved for backward compat with existing rows)
    'INSERT', 'UPDATE', 'DELETE'
  ));

-- 2. Replace fn_audit_trigger with canonical naming
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS trigger AS $$
DECLARE
  v_action text;
  v_entity text;
BEGIN
  -- Map table name to canonical entity name
  v_entity := CASE TG_TABLE_NAME
    WHEN 'rfis' THEN 'rfi'
    WHEN 'rfi_responses' THEN 'rfi_response'
    -- Default: use table name as entity
    ELSE TG_TABLE_NAME
  END;

  -- Map operation to canonical action
  v_action := CASE TG_OP
    WHEN 'INSERT' THEN
      CASE WHEN v_entity = 'rfi_response' THEN v_entity || '.added'
           ELSE v_entity || '.created'
      END
    WHEN 'UPDATE' THEN v_entity || '.updated'
    WHEN 'DELETE' THEN v_entity || '.deleted'
  END;

  INSERT INTO audit_log (
    action,
    entity_type,
    entity_id,
    project_id,
    user_id,
    before_state,
    after_state,
    created_at
  ) VALUES (
    v_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.project_id, OLD.project_id),
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_audit_trigger() IS
  'Audit trigger with canonical event naming. Writes {entity}.{operation} '
  'actions (e.g., rfi.created, rfi_response.added) instead of raw TG_OP. '
  'See DOMAIN_KERNEL_SPEC.md §8.';

COMMIT;
