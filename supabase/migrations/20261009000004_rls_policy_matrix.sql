-- =============================================================================
-- 20261009000004_rls_policy_matrix.sql
-- BRT subsystem 1 §4.2 — RLS policy coverage audit infrastructure.
--
-- Defines a stable read-only view over pg_policies + pg_class so the
-- nightly drift detector and CI gate can compare against a checked-in
-- baseline. Without this view, every consumer would need to know the
-- pg_catalog joins to compose the matrix; with it, comparing live → baseline
-- is a single SELECT.
--
-- Pairs with:
--   - scripts/rls-matrix-audit.ts (snapshots the view to markdown)
--   - docs/audits/RLS_POLICY_MATRIX_BASELINE.md (committed baseline)
--   - supabase/functions/rls-policy-drift/index.ts (nightly cron, follow-up)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- v_rls_policy_matrix — one row per (table, policy) for every public RLS
-- policy. Includes whether the table itself has RLS enabled (a table with
-- no policies AND no rls is the worst failure mode).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_rls_policy_matrix AS
SELECT
  c.relname             AS table_name,
  c.relrowsecurity      AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  pol.polname           AS policy_name,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE pol.polcmd::text
  END                   AS policy_cmd,
  pol.polpermissive     AS permissive,
  -- Roles the policy applies to. NULL/empty = applies to all (PUBLIC).
  array_to_string(
    array(
      SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles) ORDER BY rolname
    ),
    ', '
  )                     AS applied_roles,
  -- USING clause (the WHERE for SELECT/UPDATE/DELETE)
  pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
  -- WITH CHECK clause (the predicate for INSERT/UPDATE)
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy pol ON pol.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'  -- ordinary tables only (no views, no matviews)
ORDER BY c.relname, pol.polname;

COMMENT ON VIEW v_rls_policy_matrix IS
  'BRT sub-1 §4.2: stable projection of every public table + its RLS policies. Audit script + nightly drift detector compare snapshots of this view against a checked-in baseline.';

GRANT SELECT ON v_rls_policy_matrix TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- v_rls_table_coverage — one row per table summarizing whether it's
-- protected at all. Useful for "find me every table with RLS off" scans.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_rls_table_coverage AS
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = c.relname
            AND column_name = 'organization_id')   AS has_org_id_column,
  (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid)::int AS policy_count,
  (SELECT count(*) FILTER (WHERE polcmd = 'r') FROM pg_policy WHERE polrelid = c.oid)::int AS select_policies,
  (SELECT count(*) FILTER (WHERE polcmd = 'a') FROM pg_policy WHERE polrelid = c.oid)::int AS insert_policies,
  (SELECT count(*) FILTER (WHERE polcmd = 'w') FROM pg_policy WHERE polrelid = c.oid)::int AS update_policies,
  (SELECT count(*) FILTER (WHERE polcmd = 'd') FROM pg_policy WHERE polrelid = c.oid)::int AS delete_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

COMMENT ON VIEW v_rls_table_coverage IS
  'BRT sub-1 §4.2: per-table RLS coverage summary. A table where has_org_id_column=true AND policy_count<4 is a likely cross-tenant risk.';

GRANT SELECT ON v_rls_table_coverage TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- find_unprotected_tables() — convenience function for CI gating.
-- Returns rows for any table that has organization_id but lacks SELECT,
-- INSERT, UPDATE, AND DELETE policies. CI fails on non-empty result.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION find_unprotected_tables()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count int,
  missing_cmds text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    table_name,
    rls_enabled,
    policy_count,
    CASE
      WHEN NOT rls_enabled THEN 'all (RLS disabled)'
      ELSE
        nullif(trim(BOTH ', ' FROM
          (CASE WHEN select_policies = 0 THEN 'SELECT, ' ELSE '' END) ||
          (CASE WHEN insert_policies = 0 THEN 'INSERT, ' ELSE '' END) ||
          (CASE WHEN update_policies = 0 THEN 'UPDATE, ' ELSE '' END) ||
          (CASE WHEN delete_policies = 0 THEN 'DELETE'   ELSE '' END)
        ), '')
    END AS missing_cmds
  FROM v_rls_table_coverage
  WHERE has_org_id_column = true
    AND (
      NOT rls_enabled
      OR select_policies = 0
      OR insert_policies = 0
      OR update_policies = 0
      OR delete_policies = 0
    )
  ORDER BY table_name;
$$;

COMMENT ON FUNCTION find_unprotected_tables IS
  'BRT sub-1 §4.2: CI gate. Returns tables with organization_id missing one or more policy commands. Empty result = pass.';

REVOKE EXECUTE ON FUNCTION find_unprotected_tables() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION find_unprotected_tables() TO authenticated, service_role;
