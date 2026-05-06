-- =============================================================================
-- bonds — payment + performance bonds, parallel to insurance_certificates
-- =============================================================================
-- Watcher fires alerts ahead of expiration. A sub on N projects with an
-- expiring bond affects N projects, not 1 — the cross-project dashboard
-- aggregates across this table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS bonds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  /** Bond type per construction practice. */
  bond_type       text NOT NULL CHECK (bond_type IN ('payment','performance','bid','maintenance','warranty','license')),
  /** Bonded counterparty company name (sub or GC). */
  company         text NOT NULL,
  /** Optional FK to an existing crew or directory_contact for cross-linking. */
  contractor_id   uuid,
  surety_company  text,
  bond_number     text,
  bond_amount     numeric(14,2) NOT NULL,
  effective_date  date,
  expiration_date date,
  document_url    text,
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','released','disputed')),
  released_at     timestamptz,
  released_reason text,
  notes           text,
  verified        boolean NOT NULL DEFAULT false,
  verified_by     uuid REFERENCES auth.users(id),
  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bonds_project ON bonds(project_id);
CREATE INDEX IF NOT EXISTS idx_bonds_expiration ON bonds(expiration_date)
  WHERE status = 'active' AND expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bonds_company ON bonds(company);

ALTER TABLE bonds ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY bonds_member_select ON bonds
    FOR SELECT USING (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY bonds_member_write ON bonds
    FOR ALL USING (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    ) WITH CHECK (
      project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
