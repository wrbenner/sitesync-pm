-- BIM Markups & Clash Detection: 3D annotations, measurements, and
-- inter-discipline clash tracking for the digital twin viewer.
--
-- NOTE: bim_markups was already created in 00038_bim_models.sql with
-- column "created_by" (not "user_id"). This migration adds any missing
-- columns and creates the bim_clash_reports table.

-- ── Add missing columns to bim_markups ─────────────────────

CREATE TABLE IF NOT EXISTS bim_markups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES auth.users(id),
  markup_type         VARCHAR(50) NOT NULL CHECK (markup_type IN ('annotation', 'measurement', 'clash', 'note', 'section')),
  title               VARCHAR(255),
  description         TEXT,
  annotation_text     TEXT,
  start_position      JSONB,
  end_position        JSONB,
  measurement_value   FLOAT,
  measurement_unit    VARCHAR(10),
  area_value          FLOAT,
  area_unit           VARCHAR(20),
  volume_value        FLOAT,
  volume_unit         VARCHAR(20),
  markup_data         JSONB DEFAULT '{}',
  image_url           TEXT,
  element_ids         INT[],
  shared_with         UUID[],
  visibility_public   BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ
);

ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS annotation_text TEXT;
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS measurement_value FLOAT;
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS measurement_unit VARCHAR(10);
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS area_value FLOAT;
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS area_unit VARCHAR(20);
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS volume_value FLOAT;
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS volume_unit VARCHAR(20);
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS start_position JSONB;
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS element_ids INT[];
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS shared_with UUID[];
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS visibility_public BOOLEAN DEFAULT false;
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE bim_markups ADD COLUMN IF NOT EXISTS markup_data JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_markups_project ON bim_markups(project_id);
CREATE INDEX IF NOT EXISTS idx_markups_created_by ON bim_markups(created_by);
CREATE INDEX IF NOT EXISTS idx_markups_type ON bim_markups(project_id, markup_type);

-- ── Clash Reports ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bim_clash_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  severity        VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status          VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'deferred')),
  element_a_id    INT NOT NULL,
  element_b_id    INT NOT NULL,
  clash_location  JSONB,
  clash_volume_cm3 FLOAT,
  resolution      TEXT,
  assigned_to     UUID REFERENCES auth.users(id),
  markup_id       UUID REFERENCES bim_markups(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clash_project ON bim_clash_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_clash_status ON bim_clash_reports(project_id, status);
CREATE INDEX IF NOT EXISTS idx_clash_assigned ON bim_clash_reports(assigned_to) WHERE assigned_to IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────

ALTER TABLE bim_markups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_clash_reports ENABLE ROW LEVEL SECURITY;

-- Markups: project members can read public or own markups
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'markups_select' AND tablename = 'bim_markups') THEN
    CREATE POLICY markups_select ON bim_markups FOR SELECT
      USING (
        project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
        AND (visibility_public = true OR created_by = auth.uid() OR auth.uid() = ANY(shared_with))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'markups_insert' AND tablename = 'bim_markups') THEN
    CREATE POLICY markups_insert ON bim_markups FOR INSERT
      WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'markups_update' AND tablename = 'bim_markups') THEN
    CREATE POLICY markups_update ON bim_markups FOR UPDATE
      USING (created_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'markups_delete' AND tablename = 'bim_markups') THEN
    CREATE POLICY markups_delete ON bim_markups FOR DELETE
      USING (created_by = auth.uid() OR project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'project_manager')
      ));
  END IF;
END $$;

-- Clash reports: project members can read, managers can write
CREATE POLICY clash_select ON bim_clash_reports FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY clash_insert ON bim_clash_reports FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY clash_update ON bim_clash_reports FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY clash_delete ON bim_clash_reports FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'project_manager')
  ));
