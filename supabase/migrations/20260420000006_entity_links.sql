-- Entity Links: bidirectional cross-references between any two entities
-- Supports CO ↔ RFI ↔ Submittal ↔ Drawing ↔ Meeting ↔ Punch Item etc.

CREATE TABLE IF NOT EXISTS entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate links (either direction covered by app logic)
  CONSTRAINT entity_links_no_self_link CHECK (
    NOT (source_type = target_type AND source_id = target_id)
  ),
  CONSTRAINT entity_links_unique_pair UNIQUE (project_id, source_type, source_id, target_type, target_id)
);

-- Indexes for fast bidirectional lookup
CREATE INDEX IF NOT EXISTS idx_entity_links_source
  ON entity_links(project_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target
  ON entity_links(project_id, target_type, target_id);

-- RLS: project members can read/write links for their projects
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_links_select" ON entity_links
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "entity_links_insert" ON entity_links
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "entity_links_delete" ON entity_links
  FOR DELETE USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Also add change_order_line_items table for Phase 2 Task 4
CREATE TABLE IF NOT EXISTS change_order_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cost_code TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit TEXT DEFAULT 'LS',
  unit_cost NUMERIC(14,2),
  budget_item_id UUID REFERENCES budget_items(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'change_order_line_items' AND column_name = 'change_order_id') THEN

    CREATE INDEX IF NOT EXISTS idx_co_line_items_co
  ON change_order_line_items(change_order_id);

  END IF;

END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'change_order_line_items' AND column_name = 'project_id') THEN
    CREATE INDEX IF NOT EXISTS idx_co_line_items_project
  ON change_order_line_items(project_id);
  END IF;
END $$;

ALTER TABLE change_order_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "co_line_items_select" ON change_order_line_items
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "co_line_items_insert" ON change_order_line_items
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "co_line_items_update" ON change_order_line_items
  FOR UPDATE USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "co_line_items_delete" ON change_order_line_items
  FOR DELETE USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );
