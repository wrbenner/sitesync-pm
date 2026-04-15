-- =============================================================================
-- Step 4: Legacy 'member' compatibility shim
-- =============================================================================
--
-- PURPOSE: Define a clear, documenteded compatibility strategy for legacy
-- 'member' rows. Existing RLS policies use ARRAY['owner','admin','member']
-- for INSERT/UPDATE. New policies (Batch 2) use kernel roles only.
--
-- PROBLEM:
--   The CHECK constraint now accepts kernel roles, but ~N existing
--   project_members rows still have role='member'. Until those are
--   remapped, 'member' users:
--   - CAN access tables with old-style policies (rfis, submittals, etc.)
--   - CANNOT access tables with Batch 2 policies (estimates, bid_packages,
--     safety_certifications) — these use kernel roles only
--   This inconsistency is by design (least-privilege for new high-risk
--   tables), but must be explicitly documented.
--
-- WHAT THIS DOES:
--   1. Creates a view (v_project_members_kernel) that shows effective kernel
--      role for each member. Legacy 'member' → 'viewer' (least-privilege).
--   2. Creates is_project_role_compat() that accepts BOTH kernel roles AND
--      legacy 'member' (maps member → viewer for policy evaluation).
--   3. Documents the remapping strategy in SQL comments.
--
-- WHAT THIS DOES NOT DO:
--   - Does NOT modify any existing RLS policies
--   - Does NOT backfill or rename any rows
--   - Does NOT change is_project_role() (existing function unchanged)
--
-- BACKWARD COMPATIBLE: 100%. Additive only — new view + new function.
--
-- ROLLBACK:
--   DROP VIEW IF EXISTS v_project_members_kernel;
--   DROP FUNCTION IF EXISTS is_project_role_compat(uuid, text[]);
-- =============================================================================

BEGIN;

-- 1. Kernel view: shows effective role for each project member
CREATE OR REPLACE VIEW v_project_members_kernel AS
SELECT
  id,
  project_id,
  user_id,
  role AS raw_role,
  CASE role
    WHEN 'member' THEN 'viewer'  -- least-privilege mapping
    ELSE role
  END AS effective_role,
  created_at
FROM project_members;

COMMENT ON VIEW v_project_members_kernel IS
  'Shows project_members with effective kernel role. Legacy ''member'' is '
  'mapped to ''viewer'' (least-privilege). Use raw_role for the stored value '
  'and effective_role for permission checks. No data is modified. '
  'See DEPRECATION_LEDGER.md §3.1 for the full remapping plan.';

-- 2. Compatibility function for new policies that want to handle both
--    kernel roles AND legacy 'member' gracefully.
--    Maps 'member' → 'viewer' before checking against the allowed roles.
CREATE OR REPLACE FUNCTION is_project_role_compat(
  p_project_id uuid,
  allowed_roles text[]
)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND (
        -- Direct match on kernel roles
        role = ANY(allowed_roles)
        -- Legacy 'member' mapped to 'viewer' for evaluation
        OR (role = 'member' AND 'viewer' = ANY(allowed_roles))
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_project_role_compat(uuid, text[]) IS
  'Like is_project_role() but maps legacy ''member'' → ''viewer'' before '
  'evaluating. Use for new policies where least-privilege is required. '
  'The original is_project_role() is unchanged for existing policies.';

COMMIT;
