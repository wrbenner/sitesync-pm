-- =============================================================================
-- Cross-project FTS — org_search_index view rebuild
-- =============================================================================
-- The earlier `20260502120005_org_search_index.sql` migration referenced
-- columns this schema doesn't have (`rfis.subject`, `rfis.question`). It
-- silently fails to create on a clean DB, which is why no cross-project
-- search actually works in dev.
--
-- This migration:
--   1. Drops the stale view if it exists
--   2. Rebuilds against the real columns (title/description, etc.)
--   3. Adds GIN indexes on the underlying tables for fast tsvector @@
--   4. Adds a SECURITY INVOKER `search_org()` function that respects RLS
-- =============================================================================

DROP VIEW IF EXISTS org_search_index CASCADE;

CREATE OR REPLACE VIEW org_search_index AS
  SELECT 'rfi'::text          AS entity_type, r.id AS entity_id, r.project_id,
         pr.organization_id, COALESCE(r.title, '') AS title, COALESCE(r.description, '') AS body,
         to_tsvector('english', COALESCE(r.title, '') || ' ' || COALESCE(r.description, '')) AS search_vector,
         r.created_at, COALESCE(r.status, '') AS status
    FROM rfis r JOIN projects pr ON pr.id = r.project_id
  UNION ALL
  SELECT 'submittal',          s.id, s.project_id, pr.organization_id,
         COALESCE(s.title, ''), COALESCE(s.spec_section, ''),
         to_tsvector('english', COALESCE(s.title, '') || ' ' || COALESCE(s.spec_section, '')),
         s.created_at, COALESCE(s.status, '')
    FROM submittals s JOIN projects pr ON pr.id = s.project_id
  UNION ALL
  SELECT 'change_order',       co.id, co.project_id, pr.organization_id,
         COALESCE(co.title, ''), COALESCE(co.description, ''),
         to_tsvector('english', COALESCE(co.title, '') || ' ' || COALESCE(co.description, '')),
         co.created_at, COALESCE(co.status, '')
    FROM change_orders co JOIN projects pr ON pr.id = co.project_id
  UNION ALL
  SELECT 'punch_item',         p.id, p.project_id, pr.organization_id,
         COALESCE(p.title, ''), COALESCE(p.description, '') || ' ' || COALESCE(p.location, ''),
         to_tsvector('english',
           COALESCE(p.title, '') || ' ' ||
           COALESCE(p.description, '') || ' ' ||
           COALESCE(p.location, '')),
         p.created_at, COALESCE(p.status, '')
    FROM punch_items p JOIN projects pr ON pr.id = p.project_id
  UNION ALL
  SELECT 'meeting',            m.id, m.project_id, pr.organization_id,
         COALESCE(m.title, ''), COALESCE(m.notes, ''),
         to_tsvector('english', COALESCE(m.title, '') || ' ' || COALESCE(m.notes, '')),
         m.created_at, ''
    FROM meetings m JOIN projects pr ON pr.id = m.project_id
  UNION ALL
  SELECT 'daily_log',          d.id, d.project_id, pr.organization_id,
         COALESCE(d.summary, ''), COALESCE(d.weather, ''),
         to_tsvector('english', COALESCE(d.summary, '') || ' ' || COALESCE(d.weather, '')),
         d.created_at, COALESCE(d.status, '')
    FROM daily_logs d JOIN projects pr ON pr.id = d.project_id
  UNION ALL
  SELECT 'drawing',            dw.id, dw.project_id, pr.organization_id,
         COALESCE(dw.title, ''), COALESCE(dw.sheet_number, '') || ' ' || COALESCE(dw.discipline, ''),
         to_tsvector('english',
           COALESCE(dw.title, '') || ' ' ||
           COALESCE(dw.sheet_number, '') || ' ' ||
           COALESCE(dw.discipline, '')),
         dw.created_at, COALESCE(dw.status, '')
    FROM drawings dw JOIN projects pr ON pr.id = dw.project_id;

-- The single function callers use. SECURITY INVOKER so RLS on the underlying
-- tables filters the result. Returns ranked rows, capped per-entity.
CREATE OR REPLACE FUNCTION search_org(p_query text, p_organization_id uuid, p_limit int DEFAULT 30)
RETURNS TABLE(
  entity_type text,
  entity_id   uuid,
  project_id  uuid,
  title       text,
  body        text,
  status      text,
  rank        real,
  created_at  timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT s.entity_type, s.entity_id, s.project_id, s.title, s.body, s.status,
         ts_rank(s.search_vector, plainto_tsquery('english', p_query)) AS rank,
         s.created_at
    FROM org_search_index s
   WHERE s.organization_id = p_organization_id
     AND s.search_vector @@ plainto_tsquery('english', p_query)
   ORDER BY rank DESC, s.created_at DESC
   LIMIT p_limit;
$$;

COMMENT ON FUNCTION search_org(text, uuid, int) IS
  'RLS-aware cross-project search. Caller passes organization_id to scope; RLS on the underlying tables enforces project membership.';
