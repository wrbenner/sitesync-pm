-- =============================================================================
-- 20261010000001_rls_writable_restrictive_sweep_project.sql
-- BRT subsystem 4 §4.6 — read-only mode for project-scoped tables.
--
-- Sibling of 20261010000000_rls_writable_restrictive_sweep.sql. That migration
-- covered tables with an `organization_id` column directly. This one covers
-- the much larger set of tables that scope by `project_id` only — the bulk of
-- day-to-day mutations (RFIs, daily logs, change orders, punch items, time
-- entries, drawings markup, …).
--
-- Approach mirrors the org-scoped sweep:
--   - Additive RESTRICTIVE policies (no existing policy bodies touched)
--   - Idempotent (DROP IF EXISTS then CREATE in dynamic DO loop)
--   - Predicate uses is_project_org_writable(project_id) → resolves the
--     project's organization_id and calls is_org_writable
--
-- The helper is SECURITY DEFINER so it can read `projects` regardless of the
-- caller's RLS context (otherwise an admin without project membership but
-- with org-level admin role would fail to evaluate the predicate, denying
-- access incorrectly).
--
-- Tables with BOTH project_id and organization_id columns are already covered
-- by the org-scoped sweep — this migration skips them via NOT EXISTS check.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: resolve the project's org and delegate to is_org_writable. Returns
-- true (allow) when the project is missing (i.e., the row is orphaned —
-- never happens in practice, but better to fall to other RLS predicates).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_project_org_writable(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_org_writable(p.organization_id)
     FROM projects p
     WHERE p.id = p_project_id),
    true   -- project not found (orphan row): fall to other predicates
  );
$$;

COMMENT ON FUNCTION is_project_org_writable IS
  'BRT sub-4 §4.6: resolves project_id → organization_id and delegates to is_org_writable. SECURITY DEFINER so org-admins without project_members rows can still pass the predicate check on their own org.';

REVOKE EXECUTE ON FUNCTION is_project_org_writable(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_project_org_writable(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Sweep. Targets tables that have project_id but NOT organization_id (those
-- are already handled). Skips an admin/system exempt set.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_project_writable_exempt_table(p_table_name text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_table_name = ANY(ARRAY[
    -- Magic-link infrastructure — support tooling needs to issue/revoke
    -- portal links even while the org is paused (e.g., kill a leaked link).
    'magic_link_tokens',
    'portal_access_tokens',
    'portal_invitations',
    -- Audit chain on project artifacts — must still land if any allowed
    -- mutation triggers an audit row through service-role paths.
    'audit_trail',
    'entity_audit_chain',
    -- AI/system telemetry — internal writes (cron, edge functions) use
    -- service-role and bypass RLS regardless; listing here just documents
    -- intent for client-side paths.
    'ai_cost_tracking',
    'ai_usage',
    'iris_telemetry',
    'drafted_action_dedupe',
    'notification_queue',
    'notifications',
    -- Presence / typing indicators — ephemeral, harmless during paused state.
    'typing_indicators'
  ]);
$$;

COMMENT ON FUNCTION is_project_writable_exempt_table IS
  'BRT sub-4 §4.6: project-scoped exempt list (portal/magic-link tokens, audit chain emission paths, telemetry, presence). Most exemptions are theoretical — internal writers use service_role and bypass RLS anyway — but keeping the list explicit prevents future client-side regressions.';

DO $sweep$
DECLARE
  r record;
  pol_insert text;
  pol_update text;
  pol_delete text;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = c.relname
          AND column_name = 'project_id'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = c.relname
          AND column_name = 'organization_id'
      )
      AND NOT is_project_writable_exempt_table(c.relname)
    ORDER BY c.relname
  LOOP
    pol_insert := format('%I_restrictive_writable_insert', r.table_name);
    pol_update := format('%I_restrictive_writable_update', r.table_name);
    pol_delete := format('%I_restrictive_writable_delete', r.table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_insert, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT '
      'WITH CHECK (is_project_org_writable(project_id))',
      pol_insert, r.table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_update, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE '
      'USING (is_project_org_writable(project_id)) '
      'WITH CHECK (is_project_org_writable(project_id))',
      pol_update, r.table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_delete, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE '
      'USING (is_project_org_writable(project_id))',
      pol_delete, r.table_name
    );
  END LOOP;
END
$sweep$;

-- ---------------------------------------------------------------------------
-- Verification view extension — combines org-scoped + project-scoped coverage.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_writable_restrictive_coverage AS
WITH org_tables AS (
  SELECT c.relname AS table_name, 'org' AS scope_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = c.relname
        AND column_name = 'organization_id'
    )
),
project_only_tables AS (
  SELECT c.relname AS table_name, 'project' AS scope_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = c.relname
        AND column_name = 'project_id'
    )
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = c.relname
        AND column_name = 'organization_id'
    )
),
combined AS (
  SELECT * FROM org_tables
  UNION ALL
  SELECT * FROM project_only_tables
)
SELECT
  combined.table_name,
  combined.scope_kind,
  CASE combined.scope_kind
    WHEN 'org'     THEN is_writable_exempt_table(combined.table_name)
    WHEN 'project' THEN is_project_writable_exempt_table(combined.table_name)
  END AS is_exempt,
  (SELECT count(*) FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid
     WHERE c.relname = combined.table_name
       AND p.polname LIKE '%_restrictive_writable_%'
       AND p.polpermissive = false) AS restrictive_policies
FROM combined
ORDER BY combined.table_name;

COMMENT ON VIEW v_writable_restrictive_coverage IS
  'BRT sub-4 §4.6: per-table verification of the read-only-mode restrictive sweep across both org-scoped and project-scoped tables. Non-exempt rows should show restrictive_policies = 3.';

GRANT SELECT ON v_writable_restrictive_coverage TO authenticated, service_role;
