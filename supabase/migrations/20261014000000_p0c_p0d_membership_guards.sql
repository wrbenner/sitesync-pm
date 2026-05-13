-- BRT sub-0 Day 3 AM — P0-C + P0-D: add project_members membership guards
-- to search_project + write_audit_entry SECURITY DEFINER functions.
--
-- Per Standing Decisions §3 (modify in place, no new wrappers): both
-- functions get `CREATE OR REPLACE FUNCTION` with the existing body
-- preserved verbatim, plus:
--   1. A canonical membership-guard IF NOT EXISTS at the top.
--   2. `SET search_path = public` pinned (was unpinned).
--   3. Trailing `REVOKE ALL FROM PUBLIC, anon` + `GRANT EXECUTE TO
--      authenticated, service_role` per Standing Decisions §2.
--
-- Lint count target: `authenticated_security_definer_function_executable`
-- stays at 82 (no +2). Modify-in-place — no stragglers.
--
-- Both functions existed prior to this migration:
--   search_project — 00023_global_search.sql:15-75 (no guard)
--   write_audit_entry — 00032_permission_system.sql:89-103 (no guard)
--
-- Both had no `SET search_path` either, contributing to the Stage-2
-- `function_search_path_mutable` lint (83 total). Pinning them here
-- nudges that count to 81. Not in Day 3 scope but is a side benefit.

-- ─────────────────────────────────────────────────────────────────────────
-- P0-C — search_project membership guard
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_project(
  p_project_id uuid,
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(entity_type text, entity_id uuid, title text, subtitle text, link text, rank real)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- BRT sub-0 day-3 P0-C: added membership guard.
DECLARE
  tsquery_val tsquery;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
     WHERE pm.project_id = p_project_id
       AND pm.user_id    = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden: caller not a member of project %', p_project_id
      USING ERRCODE = '42501';
  END IF;

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
$$;

REVOKE ALL     ON FUNCTION public.search_project(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_project(uuid, text, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.search_project(uuid, text, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_project(uuid, text, integer) IS
  'BRT sub-0 day-3 P0-C: SECURITY DEFINER full-text search gated by '
  'project_members membership. Cross-tenant callers raise 42501.';

-- ─────────────────────────────────────────────────────────────────────────
-- P0-D — write_audit_entry membership guard
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.write_audit_entry(
  p_project_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_entity_title text DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- BRT sub-0 day-3 P0-D: added membership guard.
DECLARE
  entry_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
     WHERE pm.project_id = p_project_id
       AND pm.user_id    = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden: caller not a member of project %', p_project_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO audit_trail (project_id, actor_id, action, entity_type, entity_id, entity_title, old_value, new_value)
  VALUES (p_project_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_entity_title, p_old_value, p_new_value)
  RETURNING id INTO entry_id;
  RETURN entry_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.write_audit_entry(uuid, text, text, uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.write_audit_entry(uuid, text, text, uuid, text, jsonb, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.write_audit_entry(uuid, text, text, uuid, text, jsonb, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.write_audit_entry(uuid, text, text, uuid, text, jsonb, jsonb) IS
  'BRT sub-0 day-3 P0-D: SECURITY DEFINER audit-write gated by '
  'project_members membership. Cross-tenant callers raise 42501. '
  'actor_id captured from auth.uid() at INSERT time.';
