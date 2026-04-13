-- =============================================================================
-- Step 4, Batch 2: RLS policies for CRITICAL/HIGH tables with zero policies
-- =============================================================================
--
-- PURPOSE: Add RLS policies to tables that have RLS enabled but no policies.
-- These tables are currently completely inaccessible via the Supabase REST API
-- (RLS enabled + no policies = all access denied). This migration adds
-- standard project-scoped policies.
--
-- TABLES AFFECTED:
--   1. estimates (P0 CRITICAL — bid/estimate values, competitive advantage)
--   2. bid_packages (P0 CRITICAL — bid scope, competitive information)
--   3. safety_certifications (P1 HIGH — worker PII, certification data)
--
-- POLICY PATTERN:
--   SELECT: any project member can read
--   INSERT: owner, admin, member can create (matches existing convention)
--   UPDATE: owner, admin, member can update
--   DELETE: owner, admin only (destructive = restricted)
--
-- BACKWARD COMPATIBILITY:
--   These tables were completely inaccessible via REST API before this
--   migration. Adding policies EXPANDS access for project members.
--   No existing access is removed. Any code using service_role key
--   bypasses RLS and is unaffected.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS estimates_select ON estimates;
--   DROP POLICY IF EXISTS estimates_insert ON estimates;
--   DROP POLICY IF EXISTS estimates_update ON estimates;
--   DROP POLICY IF EXISTS estimates_delete ON estimates;
--   DROP POLICY IF EXISTS bid_packages_select ON bid_packages;
--   DROP POLICY IF EXISTS bid_packages_insert ON bid_packages;
--   DROP POLICY IF EXISTS bid_packages_update ON bid_packages;
--   DROP POLICY IF EXISTS bid_packages_delete ON bid_packages;
--   DROP POLICY IF EXISTS safety_certifications_select ON safety_certifications;
--   DROP POLICY IF EXISTS safety_certifications_insert ON safety_certifications;
--   DROP POLICY IF EXISTS safety_certifications_update ON safety_certifications;
--   DROP POLICY IF EXISTS safety_certifications_delete ON safety_certifications;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. estimates — CRITICAL: bid/estimate values
-- ---------------------------------------------------------------------------
CREATE POLICY estimates_select ON estimates FOR SELECT
    USING (is_project_member(project_id));

CREATE POLICY estimates_insert ON estimates FOR INSERT
    WITH CHECK (is_project_role(project_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY estimates_update ON estimates FOR UPDATE
    USING (is_project_role(project_id, ARRAY['owner', 'admin', 'member']))
    WITH CHECK (is_project_role(project_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY estimates_delete ON estimates FOR DELETE
    USING (is_project_role(project_id, ARRAY['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- 2. bid_packages — CRITICAL: bid scope, competitive information
-- ---------------------------------------------------------------------------
CREATE POLICY bid_packages_select ON bid_packages FOR SELECT
    USING (is_project_member(project_id));

CREATE POLICY bid_packages_insert ON bid_packages FOR INSERT
    WITH CHECK (is_project_role(project_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY bid_packages_update ON bid_packages FOR UPDATE
    USING (is_project_role(project_id, ARRAY['owner', 'admin', 'member']))
    WITH CHECK (is_project_role(project_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY bid_packages_delete ON bid_packages FOR DELETE
    USING (is_project_role(project_id, ARRAY['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- 3. safety_certifications — HIGH: worker PII, certification data
-- ---------------------------------------------------------------------------
CREATE POLICY safety_certifications_select ON safety_certifications FOR SELECT
    USING (is_project_member(project_id));

CREATE POLICY safety_certifications_insert ON safety_certifications FOR INSERT
    WITH CHECK (is_project_role(project_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY safety_certifications_update ON safety_certifications FOR UPDATE
    USING (is_project_role(project_id, ARRAY['owner', 'admin', 'member']))
    WITH CHECK (is_project_role(project_id, ARRAY['owner', 'admin', 'member']));

CREATE POLICY safety_certifications_delete ON safety_certifications FOR DELETE
    USING (is_project_role(project_id, ARRAY['owner', 'admin']));

COMMIT;
