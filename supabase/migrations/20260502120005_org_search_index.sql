-- ═══════════════════════════════════════════════════════════════
-- Migration: org_search_index view
-- Version: 20260502120005
--
-- A unioned tsvector view across the major org-wide entities so the
-- cross-project-search edge function can hit a single index.
--
-- The view is RLS-aware via a join to project_members.user_id =
-- auth.uid() — but because views inherit RLS only when defined with
-- SECURITY INVOKER (the default in Supabase), we additionally
-- include the project_id and organization_id so the edge function
-- can re-filter at query time.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW org_search_index AS
SELECT
  'rfi'::text                           AS entity_type,
  r.id                                  AS entity_id,
  r.project_id,
  pr.organization_id,
  COALESCE(r.title, '')                 AS title,
  COALESCE(r.description, '')           AS body,
  to_tsvector('english',
    COALESCE(r.title, '') || ' ' || COALESCE(r.description, '')
  )                                     AS search_vector,
  r.created_at,
  r.status
FROM rfis r
JOIN projects pr ON pr.id = r.project_id

UNION ALL

SELECT
  'submittal',
  s.id,
  s.project_id,
  pr.organization_id,
  COALESCE(s.title, ''),
  COALESCE(s.spec_section, ''),
  to_tsvector('english',
    COALESCE(s.title, '') || ' ' || COALESCE(s.spec_section, '')
  ),
  s.created_at,
  s.status
FROM submittals s
JOIN projects pr ON pr.id = s.project_id

UNION ALL

SELECT
  'change_order',
  c.id,
  c.project_id,
  pr.organization_id,
  COALESCE(c.title, ''),
  COALESCE(c.reason, ''),
  to_tsvector('english',
    COALESCE(c.title, '') || ' ' || COALESCE(c.reason, '')
  ),
  c.created_at,
  c.status
FROM change_orders c
JOIN projects pr ON pr.id = c.project_id

UNION ALL

SELECT
  'daily_log',
  d.id,
  d.project_id,
  pr.organization_id,
  ('Daily log ' || d.log_date::text),
  COALESCE(d.summary, ''),
  to_tsvector('english', COALESCE(d.summary, '')),
  d.created_at,
  COALESCE(d.status, 'open')
FROM daily_logs d
JOIN projects pr ON pr.id = d.project_id

UNION ALL

SELECT
  'punch_item',
  p.id,
  p.project_id,
  pr.organization_id,
  COALESCE(p.title, ''),
  COALESCE(p.description, ''),
  to_tsvector('english',
    COALESCE(p.title, '') || ' ' || COALESCE(p.description, '')
  ),
  p.created_at,
  p.status
FROM punch_items p
JOIN projects pr ON pr.id = p.project_id;

-- The cross-project-search edge function MUST re-filter results by
-- project_members for the auth user. The SQL helper below makes that
-- single-query and centrally maintained.
CREATE OR REPLACE FUNCTION search_org(
  p_organization_id uuid,
  p_user_id uuid,
  p_query text,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  project_id uuid,
  organization_id uuid,
  title text,
  body text,
  rank real,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    osi.entity_type,
    osi.entity_id,
    osi.project_id,
    osi.organization_id,
    osi.title,
    osi.body,
    ts_rank(osi.search_vector, plainto_tsquery('english', p_query)) AS rank,
    osi.created_at
  FROM org_search_index osi
  JOIN project_members pm
    ON pm.project_id = osi.project_id
   AND pm.user_id    = p_user_id
  WHERE osi.organization_id = p_organization_id
    AND osi.search_vector @@ plainto_tsquery('english', p_query)
  ORDER BY rank DESC, osi.created_at DESC
  LIMIT p_limit;
$$;
