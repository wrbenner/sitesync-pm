-- =============================================================================
-- Inspection Service Layer: tables, RLS, and provenance columns
-- =============================================================================
--
-- Creates the normalized inspections and inspection_findings tables used by
-- inspectionService.ts and the inspection-transition edge function.
--
-- Soft deletes: deleted_at / deleted_by. All SELECT RLS policies exclude rows
-- where deleted_at IS NOT NULL.
--
-- Lifecycle: scheduled -> in_progress -> completed -> approved | rejected
--            rejected -> scheduled
--            any non-final -> cancelled
-- =============================================================================

-- ── inspections ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inspections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  type             text NOT NULL CHECK (type IN ('safety','quality','building','fire','electrical','structural','general')),
  status           text NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','in_progress','completed','approved','rejected','cancelled')),
  priority         text NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('low','medium','high','critical')),
  scheduled_date   date,
  completed_date   timestamptz,
  inspector_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location         text,
  score            smallint CHECK (score >= 0 AND score <= 100),
  findings         text,
  checklist_items  jsonb,

  -- Provenance
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── inspection_findings ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inspection_findings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id   uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  description     text NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('critical','major','minor','observation')),
  attachments     jsonb,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── updated_at trigger ───────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE OR REPLACE FUNCTION update_inspections_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $fn$;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER inspections_updated_at
    BEFORE UPDATE ON inspections
    FOR EACH ROW EXECUTE FUNCTION update_inspections_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RLS: inspections ─────────────────────────────────────────────────────────

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

-- Project members can read non-deleted inspections
DO $$ BEGIN
  CREATE POLICY "inspections_select_member"
    ON inspections FOR SELECT
    USING (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = inspections.project_id
          AND pm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Project members with field roles can insert
DO $$ BEGIN
  CREATE POLICY "inspections_insert_member"
    ON inspections FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = inspections.project_id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner','admin','project_manager','superintendent','foreman')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Project members with field roles can update (status transitions enforced by service/edge fn)
DO $$ BEGIN
  CREATE POLICY "inspections_update_member"
    ON inspections FOR UPDATE
    USING (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = inspections.project_id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner','admin','project_manager','superintendent','foreman')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RLS: inspection_findings ──────────────────────────────────────────────────

ALTER TABLE inspection_findings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "inspection_findings_select_member"
    ON inspection_findings FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM inspections i
        JOIN project_members pm ON pm.project_id = i.project_id
        WHERE i.id = inspection_findings.inspection_id
          AND pm.user_id = auth.uid()
          AND i.deleted_at IS NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "inspection_findings_insert_member"
    ON inspection_findings FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM inspections i
        JOIN project_members pm ON pm.project_id = i.project_id
        WHERE i.id = inspection_findings.inspection_id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner','admin','project_manager','superintendent','foreman')
          AND i.deleted_at IS NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS inspections_project_id_idx ON inspections(project_id);
CREATE INDEX IF NOT EXISTS inspections_status_idx ON inspections(status);
CREATE INDEX IF NOT EXISTS inspections_deleted_at_idx ON inspections(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS inspection_findings_inspection_id_idx ON inspection_findings(inspection_id);
