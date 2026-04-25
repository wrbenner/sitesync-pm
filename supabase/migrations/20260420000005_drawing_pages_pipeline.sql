-- Drawing Pages Pipeline
-- Adds per-page image tracking (mirrors reference app's ConvertedPageImage model)
-- and updates the drawings table with processing/thumbnail fields.

-- ── drawing_pages: one row per rendered page image ──────────
CREATE TABLE IF NOT EXISTS drawing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_number integer NOT NULL,

  -- Storage paths (Supabase Storage, bucket: project-files)
  image_url text,           -- full-res page PNG
  thumbnail_url text,       -- ~400px wide thumbnail PNG

  -- Dimensions of the rendered image
  width integer,
  height integer,

  -- AI classification results (populated by classify-drawing edge function)
  classification text DEFAULT 'pending'
    CHECK (classification IN ('pending','processing','completed','failed')),
  discipline text,
  plan_type text,
  sheet_number text,
  drawing_title text,
  building_name text,
  floor_level text,
  scale_text text,
  scale_ratio numeric,
  classification_confidence numeric,
  is_pair_candidate boolean DEFAULT false,
  design_description jsonb DEFAULT '{}',
  viewport_details jsonb DEFAULT '{}',
  pairing_tokens jsonb DEFAULT '{}',

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (drawing_id, page_number)
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drawing_pages' AND column_name = 'drawing_id') THEN

    CREATE INDEX IF NOT EXISTS idx_drawing_pages_drawing
  ON drawing_pages(drawing_id);

  END IF;

END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drawing_pages' AND column_name = 'project_id') THEN
    CREATE INDEX IF NOT EXISTS idx_drawing_pages_project
  ON drawing_pages(project_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_drawing_pages_discipline
  ON drawing_pages(project_id, discipline);

ALTER TABLE drawing_pages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY drawing_pages_select ON drawing_pages FOR SELECT
    USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY drawing_pages_insert ON drawing_pages FOR INSERT
    WITH CHECK (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY drawing_pages_update ON drawing_pages FOR UPDATE
    USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY drawing_pages_delete ON drawing_pages FOR DELETE
    USING (is_project_member(project_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Add columns to drawings table ──────────────────────────
-- These are all safe ADD IF NOT EXISTS via DO blocks.

DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS total_pages integer DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS thumbnail_url text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending'
    CHECK (processing_status IN ('pending','splitting','classifying','completed','failed'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawings ADD COLUMN IF NOT EXISTS source_filename text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Widen the discipline CHECK constraint to include all values the classifier can return.
-- Drop existing constraint if it exists, then add the new one.
DO $$ BEGIN
  ALTER TABLE drawings DROP CONSTRAINT IF EXISTS drawings_discipline_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE drawings ADD CONSTRAINT drawings_discipline_check
    CHECK (discipline IS NULL OR discipline IN (
      'architectural','structural','mechanical','electrical',
      'plumbing','civil','fire_protection','landscape',
      'interior','interior_design','mep','unclassified'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE drawing_pages IS
  'Per-page rendered images from PDF drawing sets. Each page is independently classified by Gemini.';
