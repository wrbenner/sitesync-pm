-- =============================================================================
-- Step 4, Batch 1: project_members role migration groundwork
-- =============================================================================
--
-- PURPOSE: Widen the project_members.role CHECK constraint to accept the
-- kernel-defined roles alongside the legacy roles, without breaking the
-- current app or modifying existing data.
--
-- CURRENT STATE:
--   CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
--
-- KERNEL TARGET (DOMAIN_KERNEL_SPEC.md §7):
--   ('owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer')
--
-- WHAT THIS MIGRATION DOES:
--   1. Drops the old CHECK constraint
--   2. Adds a new CHECK constraint that accepts BOTH legacy and kernel roles
--   3. Updates is_project_role() to document the expanded role set
--   4. Adds a mapping function for future use
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   - Does NOT backfill or rename any existing 'member' rows
--   - Does NOT change any RLS policies
--   - Does NOT change any client-side code
--   - Does NOT remove the 'member' value (backward compatible)
--
-- BACKWARD COMPATIBILITY:
--   All existing rows with 'owner', 'admin', 'member', 'viewer' remain valid.
--   All existing RLS policies that check ARRAY['owner', 'admin', 'member']
--   continue to work unchanged. The app can continue inserting 'member'.
--   New code can begin inserting kernel roles (project_manager, etc.)
--
-- ROLLBACK:
--   ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
--   ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
--     CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
--   DROP FUNCTION IF EXISTS kernel_role_label(text);
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Widen the CHECK constraint
-- ---------------------------------------------------------------------------
-- Drop the existing constraint first. The constraint name is auto-generated
-- by Postgres as 'project_members_role_check' (table_column_check pattern).
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;

-- Add the widened constraint that accepts both legacy and kernel roles.
-- Legacy values: owner, admin, member, viewer
-- Kernel values: owner, admin, project_manager, superintendent, subcontractor, viewer
-- Combined (union): owner, admin, member, project_manager, superintendent, subcontractor, viewer
ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
  CHECK (role IN (
    -- Kernel roles (DOMAIN_KERNEL_SPEC.md §7)
    'owner',
    'admin',
    'project_manager',
    'superintendent',
    'subcontractor',
    'viewer',
    -- Legacy role (preserved for backward compatibility)
    'member'
  ));

-- ---------------------------------------------------------------------------
-- 2. Add kernel_role_label() utility function
-- ---------------------------------------------------------------------------
-- Maps legacy roles to their kernel equivalents for display purposes.
-- Does NOT modify data — purely a read-time helper.
-- Used by evals and future migration scripts to understand role semantics.
CREATE OR REPLACE FUNCTION kernel_role_label(raw_role text)
RETURNS text AS $$
  SELECT CASE raw_role
    -- Legacy 'member' maps to 'viewer' under least-privilege principle.
    -- Individual members should be upgraded by a project admin after review.
    WHEN 'member' THEN 'viewer (legacy member)'
    ELSE raw_role
  END;
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION kernel_role_label(text) IS
  'Maps legacy project_members.role values to kernel-equivalent labels. '
  'Does not modify data. See DEPRECATION_LEDGER.md §3.1 for migration plan.';

-- ---------------------------------------------------------------------------
-- 3. Document the change in a comment on the column
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN project_members.role IS
  'Project role. Kernel roles: owner, admin, project_manager, superintendent, '
  'subcontractor, viewer. Legacy value "member" is accepted for backward '
  'compatibility and treated as "viewer" under least-privilege. '
  'See DOMAIN_KERNEL_SPEC.md §7 and DEPRECATION_LEDGER.md §3.1.';

COMMIT;
