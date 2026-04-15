-- =============================================================================
-- Step 4: Audit trail trigger for rfis and rfi_responses
-- =============================================================================
--
-- PURPOSE: Automatically write to audit_log on every rfis INSERT/UPDATE/DELETE
-- and rfi_responses INSERT. Required by DOMAIN_KERNEL_SPEC.md §8 and
-- eval harness Layer 3 Fixture #4 (expects audit log entries after RFI lifecycle).
--
-- DESIGN:
--   - Uses a generic trigger function that captures table_name, operation,
--     old/new row as JSONB, and the acting user from auth.uid()
--   - Attached to rfis (INSERT, UPDATE, DELETE) and rfi_responses (INSERT)
--   - Writes to existing audit_log table
--
-- BACKWARD COMPATIBLE:
--   - audit_log table already exists (created in 00002_audit_trail.sql)
--   - No existing triggers on rfis or rfi_responses (verified)
--   - Adding triggers only creates new audit_log rows — does not modify
--     any existing data or behavior
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_rfis_audit ON rfis;
--   DROP TRIGGER IF EXISTS trg_rfi_responses_audit ON rfi_responses;
--   DROP FUNCTION IF EXISTS fn_audit_trigger();
-- =============================================================================

BEGIN;

-- 1. Widen audit_log.action CHECK to accept trigger-generated values
--    Existing values (create, update, delete, etc.) remain valid.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN (
    -- Original values
    'create', 'update', 'delete', 'status_change', 'approve', 'reject', 'submit', 'close',
    -- Trigger-generated values (Postgres TG_OP is uppercase)
    'INSERT', 'UPDATE', 'DELETE'
  ));

-- 2. Generic audit trigger function (reusable for future tables)
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS trigger AS $$
BEGIN
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
    TG_OP,                                           -- INSERT, UPDATE, DELETE
    TG_TABLE_NAME,                                   -- rfis, rfi_responses, etc.
    COALESCE(NEW.id, OLD.id),                        -- entity UUID
    COALESCE(NEW.project_id, OLD.project_id),        -- project scope
    auth.uid(),                                      -- acting user (NULL if system)
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_audit_trigger() IS
  'Generic audit trigger. Writes to audit_log on INSERT/UPDATE/DELETE. '
  'Captures old/new row as JSONB, acting user, table name, and operation. '
  'See DOMAIN_KERNEL_SPEC.md §8.';

-- 3. Attach to rfis (all operations)
CREATE TRIGGER trg_rfis_audit
  AFTER INSERT OR UPDATE OR DELETE ON rfis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- 4. Attach to rfi_responses (INSERT only — responses are immutable)
CREATE TRIGGER trg_rfi_responses_audit
  AFTER INSERT ON rfi_responses
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

COMMIT;
