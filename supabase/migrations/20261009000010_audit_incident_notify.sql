-- =============================================================================
-- 20261009000010_audit_incident_notify.sql
-- BRT subsystem 7 §4.4 — audit_incidents → P0 paging path.
--
-- When a row lands in audit_incidents with a P0 category (rls_leak,
-- chain_break, key_leak), we emit a Postgres NOTIFY on the
-- 'audit_incident_p0' channel so the cron-error-rate-alert function
-- (and any future direct listener) can react immediately rather than
-- waiting for the hourly poll.
--
-- This migration also tightens the audit_incidents table to fail-closed
-- on category writes from non-service-role code paths (defense in depth
-- against a bug that writes a fake P0 from a user session).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Trigger: emit NOTIFY on every P0 audit_incident insert
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_audit_incident_p0()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.category IN ('rls_leak', 'chain_break', 'key_leak') THEN
    PERFORM pg_notify(
      'audit_incident_p0',
      jsonb_build_object(
        'id', NEW.id,
        'category', NEW.category,
        'severity', NEW.severity,
        'created_at', NEW.created_at
      )::text
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_incident_p0_notify ON audit_incidents;
CREATE TRIGGER trg_audit_incident_p0_notify
  AFTER INSERT ON audit_incidents
  FOR EACH ROW
  EXECUTE FUNCTION notify_audit_incident_p0();

COMMENT ON FUNCTION notify_audit_incident_p0 IS
  'BRT sub-7 §4.4: NOTIFY audit_incident_p0 channel for the listed categories. Cron-error-rate-alert + future direct listeners react.';

-- ---------------------------------------------------------------------------
-- Helper: write_audit_incident() — the canonical insert path. Constrains
-- callers to the documented severity vocabulary and validates category.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION write_audit_incident(
  p_category text,
  p_severity text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'write_audit_incident: severity must be low|medium|high|critical (got %)', p_severity;
  END IF;
  -- Categories enforced by the existing CHECK on audit_incidents.category.
  INSERT INTO audit_incidents (category, severity, metadata)
  VALUES (p_category, p_severity, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

COMMENT ON FUNCTION write_audit_incident IS
  'BRT sub-7 §4.4: canonical audit_incident insert. Validates severity. Emits NOTIFY via the AFTER INSERT trigger.';

REVOKE EXECUTE ON FUNCTION write_audit_incident(text, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION write_audit_incident(text, text, jsonb) TO service_role;
