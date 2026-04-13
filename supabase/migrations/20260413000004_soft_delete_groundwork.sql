-- =============================================================================
-- Step 4, Batch 4: Soft-delete columns on core kernel entities
-- =============================================================================
--
-- PURPOSE: Add deleted_at and deleted_by columns to the most important
-- core entities. These are required by DOMAIN_KERNEL_SPEC.md §6.1 for
-- soft-delete support. This migration only ADDS the columns — it does
-- NOT modify RLS policies to filter deleted rows (that is a later step).
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds deleted_at (timestamptz, nullable) to 6 core tables
--   2. Adds deleted_by (uuid, nullable, FK to auth.users) to same tables
--   3. Adds a partial index on deleted_at for efficient "active only" queries
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   - Does NOT add WHERE deleted_at IS NULL to any RLS policies
--   - Does NOT change any application behavior
--   - Does NOT delete or soft-delete any existing rows
--   - Does NOT add triggers to enforce soft-delete
--
-- TABLES AFFECTED:
--   rfis, submittals, tasks, daily_logs, change_orders, punch_items
--
-- WHY THESE 6:
--   These are the core project-scoped workflow entities that the eval
--   harness (Layer 1 test_soft_delete.sql and Layer 3 fixtures) expects
--   to have soft-delete support. Starting with these gives the evals
--   something concrete to test against.
--
-- BACKWARD COMPATIBILITY:
--   All columns are nullable with no default. Existing rows get NULL
--   (meaning "not deleted" — which is correct). No existing queries,
--   RLS policies, or application code references these columns yet.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_rfis_active;
--   DROP INDEX IF EXISTS idx_submittals_active;
--   DROP INDEX IF EXISTS idx_tasks_active;
--   DROP INDEX IF EXISTS idx_daily_logs_active;
--   DROP INDEX IF EXISTS idx_change_orders_active;
--   DROP INDEX IF EXISTS idx_punch_items_active;
--   ALTER TABLE rfis DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE submittals DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE tasks DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE daily_logs DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE change_orders DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE punch_items DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add soft-delete columns
-- ---------------------------------------------------------------------------
ALTER TABLE rfis           ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
                           ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

ALTER TABLE submittals     ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
                           ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

ALTER TABLE tasks          ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
                           ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

ALTER TABLE daily_logs     ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
                           ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

ALTER TABLE change_orders  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
                           ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

ALTER TABLE punch_items    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
                           ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

-- ---------------------------------------------------------------------------
-- 2. Partial indexes for efficient "active only" queries
-- ---------------------------------------------------------------------------
-- These indexes support future WHERE deleted_at IS NULL queries without
-- indexing the (rare) soft-deleted rows. Using IF NOT EXISTS via DO block.
CREATE INDEX IF NOT EXISTS idx_rfis_active
    ON rfis (project_id, created_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_submittals_active
    ON submittals (project_id, created_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_active
    ON tasks (project_id, created_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_logs_active
    ON daily_logs (project_id, log_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_change_orders_active
    ON change_orders (project_id, created_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_punch_items_active
    ON punch_items (project_id, created_at) WHERE deleted_at IS NULL;

COMMIT;
