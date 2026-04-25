-- ════════════════════════════════════════════════════════════════
-- Drawing Tiles, Sets, and Enhanced Annotations
-- Adds tile support, drawing sets, and enhanced markup columns.
-- Fully idempotent — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════

-- ── Tile metadata on drawings table ───────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drawings' AND column_name = 'tile_status'
  ) THEN
    ALTER TABLE drawings ADD COLUMN tile_status TEXT DEFAULT 'pending'
      CHECK (tile_status IN ('pending', 'processing', 'ready', 'failed'));
  END IF;
END$$;

ALTER TABLE drawings ADD COLUMN IF NOT EXISTS tile_levels INTEGER;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS tile_format TEXT DEFAULT 'jpeg';

-- ── Drawing sets (working, issued, record, IFC) ─────────────

CREATE TABLE IF NOT EXISTS drawing_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  set_type TEXT NOT NULL CHECK (set_type IN ('working', 'issued', 'record', 'ifc')),
  description TEXT,
  drawing_ids UUID[] NOT NULL DEFAULT '{}',
  issued_date TIMESTAMPTZ,
  issued_by UUID REFERENCES auth.users(id),
  cover_letter TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_drawing_sets_project ON drawing_sets(project_id);

-- ── Bulletins / ASIs ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drawing_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bulletin_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  affected_drawing_ids UUID[] NOT NULL DEFAULT '{}',
  issued_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_drawing_bulletins_project ON drawing_bulletins(project_id);

-- ── Distribution tracking ────────────────────────────────────

CREATE TABLE IF NOT EXISTS drawing_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transmittal_id UUID REFERENCES transmittals(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  drawing_set_id UUID REFERENCES drawing_sets(id),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);

-- ── OCR text content ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drawing_text_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  text_blocks JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (drawing_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_drawing_text_drawing ON drawing_text_content(drawing_id);

-- ── Enhanced annotation columns on drawing_markups ───────────
-- (drawing_markups table + base columns created in 00019 & 20260418)

ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS geometry_type TEXT;
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS normalized_coords JSONB;

-- layer and visibility may already exist with different CHECK constraints.
-- Use a safe DO block to add only if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drawing_markups' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE drawing_markups ADD COLUMN visibility TEXT DEFAULT 'team';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drawing_markups' AND column_name = 'markup_status'
  ) THEN
    ALTER TABLE drawing_markups ADD COLUMN markup_status TEXT DEFAULT 'active';
  END IF;
END$$;

ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS stamp_type TEXT;
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS linked_submittal_id UUID;
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS linked_photo_id UUID;
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS measurement_value NUMERIC;
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS measurement_unit TEXT;
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS measurement_scale NUMERIC;
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS shape_data JSONB DEFAULT '{}';
ALTER TABLE drawing_markups ADD COLUMN IF NOT EXISTS content TEXT;

-- ── RLS policies (idempotent via IF NOT EXISTS pattern) ──────

ALTER TABLE drawing_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_bulletins ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_text_content ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drawing_sets_project_access') THEN
    CREATE POLICY drawing_sets_project_access ON drawing_sets
      FOR ALL USING (
        project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drawing_bulletins_project_access') THEN
    CREATE POLICY drawing_bulletins_project_access ON drawing_bulletins
      FOR ALL USING (
        project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drawing_distributions_access') THEN
    CREATE POLICY drawing_distributions_access ON drawing_distributions
      FOR ALL USING (
        transmittal_id IN (
          SELECT id FROM transmittals WHERE project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drawing_text_project_access') THEN
    CREATE POLICY drawing_text_project_access ON drawing_text_content
      FOR ALL USING (
        drawing_id IN (
          SELECT id FROM drawings WHERE project_id IN (
            SELECT project_id FROM project_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END$$;
