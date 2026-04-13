-- =============================================================================
-- Step 4, Batch 3: Provenance columns on core kernel entities
-- =============================================================================
--
-- PURPOSE: Add missing created_by and updated_by columns to the most
-- important kernel entities. These columns are required by
-- DOMAIN_KERNEL_SPEC.md §6.1 for audit provenance.
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds created_by (uuid, nullable, FK to auth.users) where missing
--   2. Adds updated_by (uuid, nullable, FK to auth.users) on all 8 tables
--   3. All columns are nullable with no default — existing rows get NULL
--
-- TABLES AFFECTED:
--   tasks           — add created_by, updated_by
--   change_orders   — add created_by, updated_by
--   punch_items     — add created_by, updated_by
--   incidents       — add created_by, updated_by
--   rfis            — add updated_by (already has created_by)
--   submittals      — add updated_by (already has created_by)
--   daily_logs      — add updated_by (already has created_by)
--   contracts       — add updated_by (already has created_by)
--
-- BACKWARD COMPATIBILITY:
--   All columns are nullable with no NOT NULL constraint. Existing rows
--   get NULL for new columns. No existing queries break because:
--   - SELECT * returns additional null columns (safe)
--   - INSERT without these columns defaults to NULL (safe)
--   - UPDATE on other columns is unaffected
--   - No RLS policies reference these columns yet
--
-- ROLLBACK:
--   ALTER TABLE tasks DROP COLUMN IF EXISTS created_by;
--   ALTER TABLE tasks DROP COLUMN IF EXISTS updated_by;
--   ALTER TABLE change_orders DROP COLUMN IF EXISTS created_by;
--   ALTER TABLE change_orders DROP COLUMN IF EXISTS updated_by;
--   ALTER TABLE punch_items DROP COLUMN IF EXISTS created_by;
--   ALTER TABLE punch_items DROP COLUMN IF EXISTS updated_by;
--   ALTER TABLE incidents DROP COLUMN IF EXISTS created_by;
--   ALTER TABLE incidents DROP COLUMN IF EXISTS updated_by;
--   ALTER TABLE rfis DROP COLUMN IF EXISTS updated_by;
--   ALTER TABLE submittals DROP COLUMN IF EXISTS updated_by;
--   ALTER TABLE daily_logs DROP COLUMN IF EXISTS updated_by;
--   ALTER TABLE contracts DROP COLUMN IF EXISTS updated_by;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tables missing created_by — add it
-- ---------------------------------------------------------------------------
ALTER TABLE tasks         ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users;
ALTER TABLE punch_items   ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users;
ALTER TABLE incidents     ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 2. All 8 core tables — add updated_by
-- ---------------------------------------------------------------------------
ALTER TABLE rfis            ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;
ALTER TABLE submittals      ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;
ALTER TABLE tasks           ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;
ALTER TABLE daily_logs      ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;
ALTER TABLE change_orders   ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;
ALTER TABLE contracts       ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;
ALTER TABLE punch_items     ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;
ALTER TABLE incidents       ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;

COMMIT;
