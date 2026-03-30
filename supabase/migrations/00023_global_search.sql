-- Global Search Infrastructure

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_rfis_fts ON rfis USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_submittals_fts ON submittals USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(spec_section, '')));
CREATE INDEX IF NOT EXISTS idx_tasks_fts ON tasks USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_punch_items_fts ON punch_items USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(location, '')));
CREATE INDEX IF NOT EXISTS idx_drawings_fts ON drawings USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(sheet_number, '') || ' ' || coalesce(discipline, '')));
CREATE INDEX IF NOT EXISTS idx_directory_fts ON directory_contacts USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(company, '') || ' ' || coalesce(role, '')));
CREATE INDEX IF NOT EXISTS idx_meetings_fts ON meetings USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(notes, '')));
CREATE INDEX IF NOT EXISTS idx_daily_logs_fts ON daily_logs USING gin(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(weather, '')));
CREATE INDEX IF NOT EXISTS idx_files_fts ON files USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(folder, '')));

-- Global search function across all entities
CREATE OR REPLACE FUNCTION search_project(p_project_id uuid, p_query text, p_limit int DEFAULT 20)
RETURNS TABLE(
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text,
  link text,
  rank real
) AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  -- Build the tsquery with prefix matching for partial words
  tsquery_val := plainto_tsquery('english', p_query);

  RETURN QUERY
  (
    SELECT 'rfi'::text, r.id, ('RFI ' || r.number || ': ' || r.title)::text, r.status::text, '/rfis'::text,
      ts_rank(to_tsvector('english', coalesce(r.title, '') || ' ' || coalesce(r.description, '')), tsquery_val)
    FROM rfis r WHERE r.project_id = p_project_id
      AND to_tsvector('english', coalesce(r.title, '') || ' ' || coalesce(r.description, '')) @@ tsquery_val
  ) UNION ALL (
    SELECT 'submittal'::text, s.id, ('SUB ' || s.number || ': ' || s.title)::text, s.status::text, '/submittals'::text,
      ts_rank(to_tsvector('english', coalesce(s.title, '') || ' ' || coalesce(s.spec_section, '')), tsquery_val)
    FROM submittals s WHERE s.project_id = p_project_id
      AND to_tsvector('english', coalesce(s.title, '') || ' ' || coalesce(s.spec_section, '')) @@ tsquery_val
  ) UNION ALL (
    SELECT 'task'::text, t.id, t.title::text, t.status::text, '/tasks'::text,
      ts_rank(to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, '')), tsquery_val)
    FROM tasks t WHERE t.project_id = p_project_id
      AND to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, '')) @@ tsquery_val
  ) UNION ALL (
    SELECT 'punch_item'::text, p.id, ('PL ' || p.number || ': ' || p.title)::text, p.status::text, '/punch-list'::text,
      ts_rank(to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.location, '')), tsquery_val)
    FROM punch_items p WHERE p.project_id = p_project_id
      AND to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.location, '')) @@ tsquery_val
  ) UNION ALL (
    SELECT 'drawing'::text, d.id, (coalesce(d.sheet_number, '') || ': ' || d.title)::text, d.discipline::text, '/drawings'::text,
      ts_rank(to_tsvector('english', coalesce(d.title, '') || ' ' || coalesce(d.sheet_number, '') || ' ' || coalesce(d.discipline, '')), tsquery_val)
    FROM drawings d WHERE d.project_id = p_project_id
      AND to_tsvector('english', coalesce(d.title, '') || ' ' || coalesce(d.sheet_number, '') || ' ' || coalesce(d.discipline, '')) @@ tsquery_val
  ) UNION ALL (
    SELECT 'contact'::text, dc.id, dc.name::text, (coalesce(dc.company, '') || ' ' || coalesce(dc.role, ''))::text, '/directory'::text,
      ts_rank(to_tsvector('english', coalesce(dc.name, '') || ' ' || coalesce(dc.company, '') || ' ' || coalesce(dc.role, '')), tsquery_val)
    FROM directory_contacts dc WHERE dc.project_id = p_project_id
      AND to_tsvector('english', coalesce(dc.name, '') || ' ' || coalesce(dc.company, '') || ' ' || coalesce(dc.role, '')) @@ tsquery_val
  ) UNION ALL (
    SELECT 'meeting'::text, m.id, m.title::text, m.type::text, '/meetings'::text,
      ts_rank(to_tsvector('english', coalesce(m.title, '') || ' ' || coalesce(m.notes, '')), tsquery_val)
    FROM meetings m WHERE m.project_id = p_project_id
      AND to_tsvector('english', coalesce(m.title, '') || ' ' || coalesce(m.notes, '')) @@ tsquery_val
  ) UNION ALL (
    SELECT 'file'::text, f.id, f.name::text, coalesce(f.folder, 'Files')::text, '/files'::text,
      ts_rank(to_tsvector('english', coalesce(f.name, '') || ' ' || coalesce(f.folder, '')), tsquery_val)
    FROM files f WHERE f.project_id = p_project_id
      AND to_tsvector('english', coalesce(f.name, '') || ' ' || coalesce(f.folder, '')) @@ tsquery_val
  )
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
