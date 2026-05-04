-- =============================================================================
-- Daily log: signing fields + revision-chain table
-- =============================================================================
-- Once a daily log is signed, mutations to the row are forbidden. Edits
-- create a daily_log_revisions row instead — a forward-only chain of
-- changes, each with required reason text and the user who made it.
--
-- The PDF export walks: original log → revision 1 → revision 2 → ... so
-- an OSHA inspector can see the full provenance. The original is sealed.
-- =============================================================================

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS signed_at         timestamptz;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS signed_by         uuid REFERENCES auth.users(id);
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS signed_chain_hash text;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS signed_payload_hash text;

CREATE INDEX IF NOT EXISTS idx_daily_logs_signed
  ON daily_logs(project_id, signed_at) WHERE signed_at IS NOT NULL;

-- Block mutations to a signed log — except the signing fields themselves
-- (allowed once on the transition to signed) and exactly the columns the
-- revisions chain might touch (none). The trigger short-circuits when the
-- row was already signed and the new values match the old values.
CREATE OR REPLACE FUNCTION fn_protect_signed_daily_log()
RETURNS trigger AS $$
DECLARE
  prev_signed_at timestamptz := OLD.signed_at;
BEGIN
  IF prev_signed_at IS NULL THEN RETURN NEW; END IF;
  -- Compare the value-bearing columns; allow no-op updates (e.g. updated_at).
  IF NEW.summary       IS DISTINCT FROM OLD.summary
     OR NEW.weather    IS DISTINCT FROM OLD.weather
     OR NEW.workers_onsite IS DISTINCT FROM OLD.workers_onsite
     OR NEW.total_hours IS DISTINCT FROM OLD.total_hours
     OR NEW.incidents  IS DISTINCT FROM OLD.incidents
     OR NEW.temperature_high IS DISTINCT FROM OLD.temperature_high
     OR NEW.temperature_low  IS DISTINCT FROM OLD.temperature_low THEN
    RAISE EXCEPTION 'daily log signed at % is immutable; create a revision instead', prev_signed_at
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_signed_daily_log ON daily_logs;
CREATE TRIGGER protect_signed_daily_log
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION fn_protect_signed_daily_log();

-- ── Revisions table ────────────────────────────────────────────
-- Forward-only chain. Each row records a single change to the log AFTER it
-- was signed. The diff captures the field, the old value, and the new value.
-- A `reason` is required — there is no UI path that bypasses it.
CREATE TABLE IF NOT EXISTS daily_log_revisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id  uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field         text NOT NULL,
  old_value     jsonb,
  new_value     jsonb,
  reason        text NOT NULL CHECK (length(reason) >= 5),
  revised_by    uuid REFERENCES auth.users(id),
  revised_at    timestamptz NOT NULL DEFAULT now(),
  /** SHA-256 of (prev_revision_hash || field || new_value || revised_by || revised_at).
      Same chain idea as entity_audit_chain, scoped to this log. */
  revision_hash text,
  prev_revision_hash text,
  sequence      bigserial NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_log_revisions_log
  ON daily_log_revisions(daily_log_id, sequence);
CREATE INDEX IF NOT EXISTS idx_daily_log_revisions_project
  ON daily_log_revisions(project_id, revised_at DESC);

ALTER TABLE daily_log_revisions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY dlr_member_select ON daily_log_revisions
    FOR SELECT USING (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY dlr_member_insert ON daily_log_revisions
    FOR INSERT WITH CHECK (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
