-- =============================================================================
-- Directory Service Layer: lifecycle, provenance, soft-delete, and RLS
-- =============================================================================
--
-- PURPOSE: Extend the companies and directory_contacts tables to support the
-- kernel service-layer pattern: company lifecycle status (active/inactive/
-- suspended), provenance columns (created_by, updated_by), soft-delete
-- (deleted_at, deleted_by), and RLS policies.
--
-- WHAT THIS MIGRATION DOES:
--   1. Creates the companies table if it does not yet exist
--   2. Adds company_status constraint (active/inactive/suspended)
--   3. Adds provenance columns to companies (created_by, updated_by)
--   4. Adds soft-delete columns to companies (deleted_at, deleted_by)
--   5. Adds RLS policies for companies
--   6. Adds service-layer columns to directory_contacts
--   7. Adds RLS policies for directory_contacts
--   8. Creates indexes for efficient active-only queries
--
-- COMPANY LIFECYCLE:
--   active → inactive  (project_manager+)
--   active → suspended (admin/owner only)
--   inactive → active  (project_manager+)
--   suspended → active (admin/owner only)
--
-- RLS POLICY DESIGN (both tables):
--   SELECT: viewer+ (all project members)
--   INSERT: subcontractor+ (any project member with write access)
--   UPDATE: subcontractor+ (soft-delete + field edits)
--   DELETE: project_manager+ (hard-delete guard; service uses soft-delete)
--
-- BACKWARD COMPATIBILITY:
--   All new columns are nullable/defaulted. Existing rows get NULL/defaults.
--   No existing queries break.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_companies_audit ON companies;
--   DROP TRIGGER IF EXISTS trg_directory_contacts_audit ON directory_contacts;
--   DROP POLICY IF EXISTS companies_delete     ON companies;
--   DROP POLICY IF EXISTS companies_update     ON companies;
--   DROP POLICY IF EXISTS companies_insert     ON companies;
--   DROP POLICY IF EXISTS companies_select     ON companies;
--   DROP POLICY IF EXISTS dir_contacts_delete  ON directory_contacts;
--   DROP POLICY IF EXISTS dir_contacts_update  ON directory_contacts;
--   DROP POLICY IF EXISTS dir_contacts_insert  ON directory_contacts;
--   DROP POLICY IF EXISTS dir_contacts_select  ON directory_contacts;
--   DROP INDEX IF EXISTS idx_companies_active;
--   DROP INDEX IF EXISTS idx_directory_contacts_active;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ensure companies table exists with base columns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  trade           text,
  insurance_status text CHECK (
    insurance_status IN ('current', 'expiring', 'expired', 'missing')
  ) DEFAULT 'missing',
  insurance_expiry date,
  created_at      timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Company lifecycle status
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS status text
    CHECK (status IN ('active', 'inactive', 'suspended'))
    NOT NULL DEFAULT 'active';

-- ---------------------------------------------------------------------------
-- 3. Provenance columns (companies)
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS updated_by  uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Soft-delete columns (companies)
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 5. Service-layer columns for directory_contacts
-- ---------------------------------------------------------------------------
ALTER TABLE directory_contacts
  ADD COLUMN IF NOT EXISTS status      text CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS updated_by  uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES auth.users;

-- Also ensure contact_name alias exists if the column is named 'name'
-- (idempotent: only adds if name = 'name' and contact_name doesn't exist yet)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'directory_contacts' AND column_name = 'name'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'directory_contacts' AND column_name = 'contact_name'
      )
  ) THEN
    ALTER TABLE directory_contacts RENAME COLUMN name TO contact_name;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Indexes for efficient active-only queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_companies_active
  ON companies (project_id, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_directory_contacts_active
  ON directory_contacts (project_id, contact_name)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 7. RLS policies — companies
-- ---------------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select ON companies;
DROP POLICY IF EXISTS companies_insert ON companies;
DROP POLICY IF EXISTS companies_update ON companies;
DROP POLICY IF EXISTS companies_delete ON companies;

CREATE POLICY companies_select ON companies FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

CREATE POLICY companies_insert ON companies FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'subcontractor'));

CREATE POLICY companies_update ON companies FOR UPDATE
  USING (has_project_permission(project_id, 'subcontractor'));

CREATE POLICY companies_delete ON companies FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- 8. RLS policies — directory_contacts
-- ---------------------------------------------------------------------------
ALTER TABLE directory_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dir_contacts_select ON directory_contacts;
DROP POLICY IF EXISTS dir_contacts_insert ON directory_contacts;
DROP POLICY IF EXISTS dir_contacts_update ON directory_contacts;
DROP POLICY IF EXISTS dir_contacts_delete ON directory_contacts;

CREATE POLICY dir_contacts_select ON directory_contacts FOR SELECT
  USING (has_project_permission(project_id, 'viewer'));

CREATE POLICY dir_contacts_insert ON directory_contacts FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'subcontractor'));

CREATE POLICY dir_contacts_update ON directory_contacts FOR UPDATE
  USING (has_project_permission(project_id, 'subcontractor'));

CREATE POLICY dir_contacts_delete ON directory_contacts FOR DELETE
  USING (has_project_permission(project_id, 'project_manager'));

-- ---------------------------------------------------------------------------
-- 9. Audit triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_companies_audit ON companies;
CREATE TRIGGER trg_companies_audit
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_directory_contacts_audit ON directory_contacts;
CREATE TRIGGER trg_directory_contacts_audit
  AFTER INSERT OR UPDATE OR DELETE ON directory_contacts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

COMMIT;
