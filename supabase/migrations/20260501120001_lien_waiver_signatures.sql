-- =============================================================================
-- Lien Waivers & Signatures
-- =============================================================================
-- We separate the legal document (lien_waivers) from the signing event
-- (lien_waiver_signatures) so a single waiver can carry multiple signatures
-- (multi-tier subs, or counter-signatures) and so the audit trail captures
-- the IP/user-agent context at signing time.
--
-- `content_hash` matters because lien waivers are admissible legal evidence.
-- Once a waiver is signed, mutating its body would constitute tampering.
-- We hash the rendered body at signing time and store it on the signature
-- row. Verification = recompute hash of the document at audit time, compare.
--
-- Compat note: an earlier migration (00037_payment_applications.sql)
-- created `lien_waivers` with a simpler schema (application_id /
-- contractor_name / waiver_state / through_date). This migration extends
-- that table additively with the columns the lien-waiver-generator edge
-- function and signature workflow need. New columns are NULLABLE except
-- where a DEFAULT or a deterministic backfill from old columns exists.
-- =============================================================================

-- Idempotent base — only fires on a brand-new DB; on existing DBs the prior
-- migration already created the table with the legacy schema.
CREATE TABLE IF NOT EXISTS lien_waivers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount              numeric(15,2) NOT NULL DEFAULT 0
                          CHECK (amount >= 0),
  status              text NOT NULL DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Additive schema extension ──────────────────────────────────────────────
ALTER TABLE lien_waivers
  ADD COLUMN IF NOT EXISTS pay_app_id          uuid REFERENCES payment_applications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subcontractor_id    uuid,
  ADD COLUMN IF NOT EXISTS subcontractor_name  text,
  ADD COLUMN IF NOT EXISTS template_id         text,
  ADD COLUMN IF NOT EXISTS template_version    text,
  ADD COLUMN IF NOT EXISTS jurisdiction        text NOT NULL DEFAULT 'AIA',
  ADD COLUMN IF NOT EXISTS type                text,
  ADD COLUMN IF NOT EXISTS period_through      date,
  ADD COLUMN IF NOT EXISTS magic_token_hash    text,
  ADD COLUMN IF NOT EXISTS expires_at          timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_email       text,
  ADD COLUMN IF NOT EXISTS sent_at             timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS created_via         text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_drafted_action_id uuid;

-- Backfill from legacy columns where they exist. The DO block is wrapped so
-- it's a no-op when the legacy columns aren't present (fresh DB).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'lien_waivers'
       AND column_name = 'application_id'
  ) THEN
    EXECUTE 'UPDATE lien_waivers SET pay_app_id = application_id WHERE pay_app_id IS NULL AND application_id IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'lien_waivers'
       AND column_name = 'contractor_name'
  ) THEN
    EXECUTE 'UPDATE lien_waivers SET subcontractor_name = contractor_name WHERE subcontractor_name IS NULL AND contractor_name IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'lien_waivers'
       AND column_name = 'through_date'
  ) THEN
    EXECUTE 'UPDATE lien_waivers SET period_through = through_date WHERE period_through IS NULL AND through_date IS NOT NULL';
  END IF;
END $$;

-- ── Constraints (added with safe names; idempotent) ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'lien_waivers_jurisdiction_chk'
  ) THEN
    ALTER TABLE lien_waivers
      ADD CONSTRAINT lien_waivers_jurisdiction_chk
      CHECK (jurisdiction IN ('AIA','CA','TX','FL','NY','GENERIC'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'lien_waivers_type_chk'
  ) THEN
    ALTER TABLE lien_waivers
      ADD CONSTRAINT lien_waivers_type_chk
      CHECK (type IS NULL OR type IN (
        'conditional_progress',
        'unconditional_progress',
        'conditional_final',
        'unconditional_final'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lien_waivers_pay_app
  ON lien_waivers(pay_app_id);
CREATE INDEX IF NOT EXISTS idx_lien_waivers_project_status
  ON lien_waivers(project_id, status);
CREATE INDEX IF NOT EXISTS idx_lien_waivers_token_hash
  ON lien_waivers(magic_token_hash) WHERE magic_token_hash IS NOT NULL;

-- ── lien_waiver_signatures (genuinely new) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS lien_waiver_signatures (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id           uuid NOT NULL REFERENCES lien_waivers(id) ON DELETE CASCADE,
  signed_by_email     text NOT NULL,
  signed_by_name      text,
  signed_by_title     text,
  signer_ip           inet,
  signer_ua           text,
  signed_at           timestamptz NOT NULL DEFAULT now(),
  -- Image of a drawn signature, or null when the waiver is e-checked.
  signature_image_url text,
  -- SHA-256 of the rendered waiver body at the moment of signing. Used at
  -- audit time to detect tampering: rerender the body, hash, compare.
  content_hash        text NOT NULL,
  -- The exact rendered body as signed. Stored verbatim so the hash can be
  -- verified without depending on template availability years later.
  signed_body         text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lien_waiver_sigs_waiver
  ON lien_waiver_signatures(waiver_id);
CREATE INDEX IF NOT EXISTS idx_lien_waiver_sigs_email
  ON lien_waiver_signatures(signed_by_email);

ALTER TABLE lien_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lien_waiver_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lw_member_select ON lien_waivers;
CREATE POLICY lw_member_select ON lien_waivers
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS lw_member_insert ON lien_waivers;
CREATE POLICY lw_member_insert ON lien_waivers
  FOR INSERT WITH CHECK (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS lw_member_update ON lien_waivers;
CREATE POLICY lw_member_update ON lien_waivers
  FOR UPDATE USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS lws_member_select ON lien_waiver_signatures;
CREATE POLICY lws_member_select ON lien_waiver_signatures
  FOR SELECT USING (
    waiver_id IN (
      SELECT id FROM lien_waivers
      WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- Signatures are written from the public magic-link endpoint via service role,
-- so we leave INSERT to bypass RLS (service role) — clients never insert.

COMMENT ON COLUMN lien_waiver_signatures.content_hash
  IS 'SHA-256 of signed_body at signing time. Tampering detector: rerender, hash, compare.';
