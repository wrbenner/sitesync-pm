-- ═══════════════════════════════════════════════════════════════
-- Migration: external_ids + import_jobs
-- Version: 20260502120000
--
-- Adds the provenance column `external_ids jsonb` to every entity
-- that an enterprise import populates, and creates the resumable
-- `import_jobs` queue used by procore-import-extended and the other
-- Tab-C edge functions.
--
-- Idempotent. Each ADD COLUMN guarded with IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════

-- ── import_jobs ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  started_by        uuid REFERENCES auth.users(id),
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  status            text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','partial')),
  source_system     text NOT NULL DEFAULT 'procore',
  entity_type       text NOT NULL,
  total_count       integer NOT NULL DEFAULT 0,
  processed_count   integer NOT NULL DEFAULT 0,
  error_log         jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Resumable cursor: { last_page: int, last_id: int, ... }
  -- Each entity-type worker writes its own cursor shape.
  resumable_cursor  jsonb NOT NULL DEFAULT '{}'::jsonb,
  config            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_org_status
  ON import_jobs (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_started_by
  ON import_jobs (started_by);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_jobs_select_org_member ON import_jobs;
CREATE POLICY import_jobs_select_org_member ON import_jobs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS import_jobs_insert_org_admin ON import_jobs;
CREATE POLICY import_jobs_insert_org_admin ON import_jobs
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS import_jobs_update_org_admin ON import_jobs;
CREATE POLICY import_jobs_update_org_admin ON import_jobs
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- ── external_ids columns on every importable entity ──────────
-- Each ADD COLUMN guarded so the migration is replayable. Tables
-- guaranteed to exist by earlier migrations are listed first; tables
-- that may not exist in older databases are wrapped in DO blocks.

ALTER TABLE rfis ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT '{}'::jsonb;
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT '{}'::jsonb;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_logs') THEN
    EXECUTE 'ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT ''{}''::jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drawings') THEN
    EXECUTE 'ALTER TABLE drawings ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT ''{}''::jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'photos') THEN
    EXECUTE 'ALTER TABLE photos ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT ''{}''::jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'directory_contacts') THEN
    EXECUTE 'ALTER TABLE directory_contacts ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT ''{}''::jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule_phases') THEN
    EXECUTE 'ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT ''{}''::jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_items') THEN
    EXECUTE 'ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT ''{}''::jsonb';
  END IF;
END $$;

-- Helpful GIN indexes for the most-common provenance lookup
-- (`external_ids ? 'procore_id'`).
CREATE INDEX IF NOT EXISTS idx_rfis_external_ids
  ON rfis USING GIN (external_ids);
CREATE INDEX IF NOT EXISTS idx_submittals_external_ids
  ON submittals USING GIN (external_ids);
CREATE INDEX IF NOT EXISTS idx_change_orders_external_ids
  ON change_orders USING GIN (external_ids);
