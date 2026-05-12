-- =============================================================================
-- 20261010000000_rls_writable_restrictive_sweep.sql
-- BRT subsystem 4 §4.6 — additive RESTRICTIVE policy sweep.
--
-- For every org-scoped table (has organization_id column + already RLS-protected),
-- add three RESTRICTIVE policies (INSERT / UPDATE / DELETE) that require
-- is_org_writable(organization_id) to be true. Read paths are not touched —
-- a paused org can still SELECT everything they own so they can export.
--
-- Why RESTRICTIVE and not modifying existing PERMISSIVE policies:
--   - Existing policies have varied predicate shapes (organization_members lookups,
--     is_project_role helpers, custom-role joins). Modifying each one in place
--     risks dropping access for legitimate users on rollback or schema drift.
--   - RESTRICTIVE policies are AND-ed with permissive policies. Adding one is
--     additive and reversible: DROP POLICY removes the gate, no other policy
--     touched.
--   - Idempotent via DROP POLICY IF EXISTS before CREATE.
--
-- Exempt set: billing-domain tables (must remain writable so user can pay/restore),
-- admin/membership tables (admin must be able to manage the org out of paused state),
-- and audit/system tables that emit during transactions we may still want to deny
-- but whose audit row itself must land. Conservative — anything ambiguous is exempt.
--
-- After this migration:
--   - find_unprotected_tables() still returns the same set (this migration adds
--     policies; doesn't remove any). The drift baseline will need a refresh.
--   - Paused org INSERT/UPDATE/DELETE on a non-exempt table → 42501 RLS denial.
--   - Project-scoped tables (RLS via project_members) are NOT covered by this
--     migration — they lack organization_id directly. Follow-up sweep wires
--     is_project_org_writable(project_id) via the same restrictive pattern.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: identifies tables that must remain writable even when the org is in
-- read-only mode. Centralized so future changes touch one place.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_writable_exempt_table(p_table_name text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_table_name = ANY(ARRAY[
    -- Billing domain: needs writes so the user can pay/cancel/restore.
    'subscriptions',
    'invoices',
    'billing_customers',
    'cancellation_reasons',
    'dunning_email_log',
    'payment_methods',
    'stripe_connected_accounts',
    'usage_events',
    -- Membership & admin: must allow admin to manage the org while paused.
    'organization_members',
    'organization_settings',
    'invite_logs',
    'user_invitations',
    -- User-scoped (not org-locked even when present in column).
    'profiles',
    -- System/internal — bookkeeping that runs regardless of org state.
    'presence_heartbeats',
    'presence_room_keys',
    'search_index_dirty_flags',
    -- Audit chain — entries must be allowed to land for any action we DO permit
    -- (admin restoring access, support impersonation, billing webhooks).
    'audit_log',
    'audit_chain_checkpoints',
    'audit_incidents',
    -- Support tooling — impersonation sessions and Slack delivery cron.
    'impersonation_sessions',
    'slack_delivery_log',
    -- Rate-limit primitives.
    'rate_limit_buckets',
    'rate_limit_overrides'
  ]);
$$;

COMMENT ON FUNCTION is_writable_exempt_table IS
  'BRT sub-4 §4.6: returns true if a table is exempt from the read-only restrictive sweep (billing, admin, audit, system). Update this list, not policies, when adding new exempt tables.';

-- ---------------------------------------------------------------------------
-- The sweep itself. Idempotent: DROP IF EXISTS then CREATE for each table.
-- Skipped silently for tables that don't yet have RLS turned on (those are
-- caught by find_unprotected_tables() and have their own remediation).
-- ---------------------------------------------------------------------------

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
          AND column_name = 'organization_id'
      )
      AND NOT is_writable_exempt_table(c.relname)
    ORDER BY c.relname
  LOOP
    pol_insert := format('%I_restrictive_writable_insert', r.table_name);
    pol_update := format('%I_restrictive_writable_update', r.table_name);
    pol_delete := format('%I_restrictive_writable_delete', r.table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_insert, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT '
      'WITH CHECK (is_org_writable(organization_id))',
      pol_insert, r.table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_update, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE '
      'USING (is_org_writable(organization_id)) '
      'WITH CHECK (is_org_writable(organization_id))',
      pol_update, r.table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_delete, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE '
      'USING (is_org_writable(organization_id))',
      pol_delete, r.table_name
    );
  END LOOP;
END
$sweep$;

-- ---------------------------------------------------------------------------
-- Verification view — quick way to confirm coverage post-migration.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_writable_restrictive_coverage AS
WITH org_tables AS (
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
        AND column_name = 'organization_id'
    )
)
SELECT
  ot.table_name,
  is_writable_exempt_table(ot.table_name) AS is_exempt,
  (SELECT count(*) FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid
     WHERE c.relname = ot.table_name
       AND p.polname LIKE '%_restrictive_writable_%'
       AND p.polpermissive = false) AS restrictive_policies
FROM org_tables ot
ORDER BY ot.table_name;

COMMENT ON VIEW v_writable_restrictive_coverage IS
  'BRT sub-4 §4.6: per-table verification of the read-only-mode restrictive sweep. Non-exempt tables should show restrictive_policies = 3 (INSERT/UPDATE/DELETE).';

GRANT SELECT ON v_writable_restrictive_coverage TO authenticated, service_role;
