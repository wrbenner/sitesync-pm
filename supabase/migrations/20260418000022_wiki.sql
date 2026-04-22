-- Project Wiki / Knowledge Base
-- Hierarchical markdown pages for project docs, SOPs, meeting notes, lessons learned.

CREATE TABLE IF NOT EXISTS wiki_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text DEFAULT '',
  parent_id uuid REFERENCES wiki_pages(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  is_template boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wiki_pages' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_wiki_pages_project ON wiki_pages(project_id);

  END IF;

END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wiki_pages' AND column_name = 'parent_id') THEN
    CREATE INDEX IF NOT EXISTS idx_wiki_pages_parent ON wiki_pages(parent_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_wiki_pages_search ON wiki_pages USING GIN (to_tsvector('english', title || ' ' || content));

ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wiki_pages_select ON wiki_pages;
CREATE POLICY wiki_pages_select ON wiki_pages FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS wiki_pages_insert ON wiki_pages;
CREATE POLICY wiki_pages_insert ON wiki_pages FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS wiki_pages_update ON wiki_pages;
CREATE POLICY wiki_pages_update ON wiki_pages FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS wiki_pages_delete ON wiki_pages;
CREATE POLICY wiki_pages_delete ON wiki_pages FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
