-- Tamper-evident audit log: append-only hash chain.
--
-- Why: Phase 1 SOC 2 / mid-size GC IT prerequisite. The audit_log table
-- captures who-did-what (services call logAuditEntry from
-- src/lib/auditLogger.ts), but without a hash chain a DBA with direct
-- DB access can edit history undetectably. Any compliance auditor will
-- flag this.
--
-- Design:
--   * previous_hash  — entry_hash of the row immediately before this one
--                      in chronological order (null only for the first row)
--   * entry_hash     — SHA-256 over a canonical JSON of this row's
--                      authoritative fields concatenated with previous_hash
--   * trigger        — BEFORE INSERT computes both fields server-side so
--                      application code cannot forge values. INSERT-only;
--                      UPDATE / DELETE are blocked on these columns.
--
-- Verification: a separate edge function (verify-audit-chain) walks the
-- table in order and recomputes each entry_hash. If anything diverges,
-- the chain is broken and an alert fires.

-- pgcrypto provides digest() for SHA-256.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Schema ───────────────────────────────────────────────────────────

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS entry_hash    text;

CREATE INDEX IF NOT EXISTS idx_audit_log_chain_order
  ON audit_log (created_at, id);

-- ── Trigger: compute previous_hash + entry_hash on insert ───────────

CREATE OR REPLACE FUNCTION audit_log_compute_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prev_hash text;
  payload   text;
BEGIN
  -- Always trust the trigger over caller-supplied values.
  -- Look up the most recent prior entry's hash. NULL for the first row.
  SELECT entry_hash
    INTO prev_hash
    FROM audit_log
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  NEW.previous_hash := prev_hash;

  -- Canonical content. Order is fixed; jsonb_build_object preserves
  -- insertion order, but we serialize manually to be explicit.
  payload :=
       coalesce(NEW.id::text, '')              || '|' ||
       coalesce(NEW.created_at::text, '')      || '|' ||
       coalesce(NEW.user_id::text, '')         || '|' ||
       coalesce(NEW.user_email, '')            || '|' ||
       coalesce(NEW.project_id::text, '')      || '|' ||
       coalesce(NEW.organization_id::text, '') || '|' ||
       NEW.entity_type                         || '|' ||
       NEW.entity_id::text                     || '|' ||
       NEW.action                              || '|' ||
       coalesce(NEW.before_state::text, '')    || '|' ||
       coalesce(NEW.after_state::text, '')     || '|' ||
       coalesce(array_to_string(NEW.changed_fields, ','), '') || '|' ||
       coalesce(NEW.metadata::text, '{}')      || '|' ||
       coalesce(prev_hash, '');

  NEW.entry_hash := encode(extensions.digest(payload, 'sha256'), 'hex');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_hash_chain ON audit_log;
CREATE TRIGGER audit_log_hash_chain
  BEFORE INSERT ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_compute_hash();

-- ── Block UPDATE / DELETE on hash columns ───────────────────────────
-- Project admins legitimately might want to delete OTHER columns?
-- No — audit_log is append-only by policy. Block both verbs entirely.

CREATE OR REPLACE FUNCTION audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow when running as the postgres superuser (migration / DBA escape
  -- hatch) but not for any application role. RLS prevents normal users
  -- from getting here, so this is belt-and-suspenders.
  IF current_user = 'postgres' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_log is append-only; UPDATE/DELETE not permitted';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_block_update ON audit_log;
CREATE TRIGGER audit_log_block_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_block_mutation();

DROP TRIGGER IF EXISTS audit_log_block_delete ON audit_log;
CREATE TRIGGER audit_log_block_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_block_mutation();

-- ── Backfill: compute the chain for any pre-existing rows ──────────
-- One-shot. After this, the trigger handles everything.
DO $$
DECLARE
  rec       record;
  prev      text := NULL;
  payload   text;
  this_hash text;
BEGIN
  FOR rec IN
    SELECT id, created_at, user_id, user_email, project_id, organization_id,
           entity_type, entity_id, action,
           before_state, after_state, changed_fields, metadata,
           entry_hash
      FROM audit_log
     ORDER BY created_at, id
  LOOP
    payload :=
         coalesce(rec.id::text, '')              || '|' ||
         coalesce(rec.created_at::text, '')      || '|' ||
         coalesce(rec.user_id::text, '')         || '|' ||
         coalesce(rec.user_email, '')            || '|' ||
         coalesce(rec.project_id::text, '')      || '|' ||
         coalesce(rec.organization_id::text, '') || '|' ||
         rec.entity_type                         || '|' ||
         rec.entity_id::text                     || '|' ||
         rec.action                              || '|' ||
         coalesce(rec.before_state::text, '')    || '|' ||
         coalesce(rec.after_state::text, '')     || '|' ||
         coalesce(array_to_string(rec.changed_fields, ','), '') || '|' ||
         coalesce(rec.metadata::text, '{}')      || '|' ||
         coalesce(prev, '');

    this_hash := encode(extensions.digest(payload, 'sha256'), 'hex');

    -- Direct UPDATE bypasses the block trigger because we ARE postgres
    -- during a migration. The block trigger checks current_user.
    UPDATE audit_log
       SET previous_hash = prev,
           entry_hash    = this_hash
     WHERE id = rec.id;

    prev := this_hash;
  END LOOP;
END;
$$;

-- ── Verification helper (callable by service role + cron) ──────────

CREATE OR REPLACE FUNCTION verify_audit_chain(
  start_after timestamptz DEFAULT NULL
)
RETURNS TABLE (
  broken_at_id  uuid,
  broken_at_seq bigint,
  expected_hash text,
  actual_hash   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec      record;
  prev     text := NULL;
  payload  text;
  expected text;
  seq      bigint := 0;
BEGIN
  -- Resume from a known checkpoint (callers should pass the timestamp
  -- of the last successful verification to skip already-verified rows).
  IF start_after IS NOT NULL THEN
    SELECT entry_hash
      INTO prev
      FROM audit_log
     WHERE created_at <= start_after
     ORDER BY created_at DESC, id DESC
     LIMIT 1;
  END IF;

  FOR rec IN
    SELECT id, created_at, user_id, user_email, project_id, organization_id,
           entity_type, entity_id, action,
           before_state, after_state, changed_fields, metadata,
           entry_hash, previous_hash
      FROM audit_log
     WHERE start_after IS NULL OR created_at > start_after
     ORDER BY created_at, id
  LOOP
    seq := seq + 1;

    -- Check the previous_hash linkage first.
    IF rec.previous_hash IS DISTINCT FROM prev THEN
      broken_at_id  := rec.id;
      broken_at_seq := seq;
      expected_hash := coalesce(prev, '<NULL>');
      actual_hash   := coalesce(rec.previous_hash, '<NULL>');
      RETURN NEXT;
      RETURN;
    END IF;

    payload :=
         coalesce(rec.id::text, '')              || '|' ||
         coalesce(rec.created_at::text, '')      || '|' ||
         coalesce(rec.user_id::text, '')         || '|' ||
         coalesce(rec.user_email, '')            || '|' ||
         coalesce(rec.project_id::text, '')      || '|' ||
         coalesce(rec.organization_id::text, '') || '|' ||
         rec.entity_type                         || '|' ||
         rec.entity_id::text                     || '|' ||
         rec.action                              || '|' ||
         coalesce(rec.before_state::text, '')    || '|' ||
         coalesce(rec.after_state::text, '')     || '|' ||
         coalesce(array_to_string(rec.changed_fields, ','), '') || '|' ||
         coalesce(rec.metadata::text, '{}')      || '|' ||
         coalesce(prev, '');

    expected := encode(extensions.digest(payload, 'sha256'), 'hex');

    IF rec.entry_hash IS DISTINCT FROM expected THEN
      broken_at_id  := rec.id;
      broken_at_seq := seq;
      expected_hash := expected;
      actual_hash   := rec.entry_hash;
      RETURN NEXT;
      RETURN;
    END IF;

    prev := rec.entry_hash;
  END LOOP;

  -- All rows verified. No output rows = chain intact.
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_audit_chain(timestamptz) TO service_role;

-- ── Verification checkpoint table ──────────────────────────────────
-- The verify-audit-chain edge function records its high-water mark here
-- so subsequent runs only re-verify rows added since the last success.

CREATE TABLE IF NOT EXISTS audit_chain_checkpoints (
  id            int PRIMARY KEY DEFAULT 1,
  last_verified timestamptz,
  last_run_at   timestamptz NOT NULL DEFAULT now(),
  single_row    boolean NOT NULL DEFAULT true,
  CHECK (id = 1)
);

-- Service role only — no RLS access for app users.
ALTER TABLE audit_chain_checkpoints ENABLE ROW LEVEL SECURITY;

INSERT INTO audit_chain_checkpoints (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN audit_log.previous_hash IS
  'Hash of the prior audit_log row in chronological order. Computed by trigger; NULL only for the first row.';
COMMENT ON COLUMN audit_log.entry_hash IS
  'SHA-256 over canonical row content concatenated with previous_hash. Computed by trigger; tamper detection only.';
