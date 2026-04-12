-- =============================================================================
-- Layer 1 Test: Scope Enforcement
-- =============================================================================
-- Validates DOMAIN_KERNEL_SPEC.md §2.1 Scope Types:
--   "Every entity in SiteSync PM belongs to exactly one of five scope types."
--   Project-scoped entities MUST have a valid project_id FK.
--
-- This test verifies:
--   - Inserting a project-scoped entity without project_id fails
--   - Inserting a project-scoped entity with a non-existent project_id fails
--   - Inserting with a valid project_id succeeds (control test)
--
-- Preconditions (from setup.sql):
--   - Project Alpha exists with known ID
--   - Alice is project_manager on Alpha
-- =============================================================================

BEGIN;

-- Use service role for direct constraint testing (not RLS — that's tested elsewhere)

-- ---------------------------------------------------------------------------
-- Test 3.1: RFI without project_id → FK / NOT NULL violation
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    INSERT INTO rfis (id, project_id, title, status, created_by, created_at, updated_at)
    VALUES (
      'ff000000-aaaa-0000-0000-000000000001',
      NULL, -- No project_id
      'RFI without project',
      'draft',
      'aa000000-0000-0000-0000-000000000001',
      now(),
      now()
    );
    v_succeeded := true;
  EXCEPTION WHEN not_null_violation THEN
    v_succeeded := false;
  WHEN OTHERS THEN
    -- Any constraint violation is acceptable
    IF SQLSTATE LIKE '23%' THEN -- Integrity constraint violation class
      v_succeeded := false;
    ELSE
      RAISE EXCEPTION 'FAIL [3.1] Unexpected error (sqlstate %): %', SQLSTATE, SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'FAIL [3.1] RFI created without project_id — NOT NULL or FK constraint missing';
  END IF;

  RAISE NOTICE 'PASS [3.1] RFI without project_id rejected (NOT NULL constraint enforced)';
END $$;

-- ---------------------------------------------------------------------------
-- Test 3.2: RFI with non-existent project_id → FK violation
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    INSERT INTO rfis (id, project_id, title, status, created_by, created_at, updated_at)
    VALUES (
      'ff000000-aaaa-0000-0000-000000000002',
      'deadbeef-dead-dead-dead-deaddeaddead', -- Non-existent project
      'RFI for ghost project',
      'draft',
      'aa000000-0000-0000-0000-000000000001',
      now(),
      now()
    );
    v_succeeded := true;
  EXCEPTION WHEN foreign_key_violation THEN
    v_succeeded := false;
  WHEN OTHERS THEN
    IF SQLSTATE LIKE '23%' THEN
      v_succeeded := false;
    ELSE
      RAISE EXCEPTION 'FAIL [3.2] Unexpected error (sqlstate %): %', SQLSTATE, SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'FAIL [3.2] RFI created with non-existent project_id — FK constraint missing';
  END IF;

  RAISE NOTICE 'PASS [3.2] RFI with non-existent project_id rejected (FK constraint enforced)';
END $$;

-- ---------------------------------------------------------------------------
-- Test 3.3: Submittal without project_id → constraint violation
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    INSERT INTO submittals (id, project_id, title, status, created_by, created_at, updated_at)
    VALUES (
      'ff000000-aaaa-0000-0000-000000000003',
      NULL,
      'Submittal without project',
      'draft',
      'aa000000-0000-0000-0000-000000000001',
      now(),
      now()
    );
    v_succeeded := true;
  EXCEPTION WHEN not_null_violation THEN
    v_succeeded := false;
  WHEN OTHERS THEN
    IF SQLSTATE LIKE '23%' THEN
      v_succeeded := false;
    ELSE
      RAISE EXCEPTION 'FAIL [3.3] Unexpected error (sqlstate %): %', SQLSTATE, SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'FAIL [3.3] Submittal created without project_id — constraint missing';
  END IF;

  RAISE NOTICE 'PASS [3.3] Submittal without project_id rejected';
END $$;

-- ---------------------------------------------------------------------------
-- Test 3.4: Daily log without project_id → constraint violation
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    INSERT INTO daily_logs (id, project_id, log_date, status, created_by, created_at, updated_at)
    VALUES (
      'ff000000-aaaa-0000-0000-000000000004',
      NULL,
      CURRENT_DATE,
      'draft',
      'cc000000-0000-0000-0000-000000000003', -- Sam
      now(),
      now()
    );
    v_succeeded := true;
  EXCEPTION WHEN not_null_violation THEN
    v_succeeded := false;
  WHEN OTHERS THEN
    IF SQLSTATE LIKE '23%' THEN
      v_succeeded := false;
    ELSE
      RAISE EXCEPTION 'FAIL [3.4] Unexpected error (sqlstate %): %', SQLSTATE, SQLERRM;
    END IF;
  END;

  IF v_succeeded THEN
    RAISE EXCEPTION 'FAIL [3.4] Daily log created without project_id — constraint missing';
  END IF;

  RAISE NOTICE 'PASS [3.4] Daily log without project_id rejected';
END $$;

-- ---------------------------------------------------------------------------
-- Test 3.5 (control): RFI with valid project_id succeeds
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_succeeded boolean := false;
BEGIN
  BEGIN
    INSERT INTO rfis (id, project_id, title, status, created_by, created_at, updated_at)
    VALUES (
      'ff000000-aaaa-0000-0000-000000000005',
      'a1000000-0000-0000-0000-000000000001', -- Valid: Project Alpha
      'Valid RFI (control test)',
      'draft',
      'aa000000-0000-0000-0000-000000000001',
      now(),
      now()
    );
    v_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL [3.5] Valid RFI insert failed: %', SQLERRM;
  END;

  IF NOT v_succeeded THEN
    RAISE EXCEPTION 'FAIL [3.5] Valid RFI insert did not succeed';
  END IF;

  RAISE NOTICE 'PASS [3.5] RFI with valid project_id accepted (control)';

  -- Clean up
  DELETE FROM rfis WHERE id = 'ff000000-aaaa-0000-0000-000000000005';
END $$;

ROLLBACK;
