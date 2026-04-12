-- =============================================================================
-- SiteSync PM — Eval Harness Layer 1: Test Data Teardown
-- =============================================================================
-- Removes all test data created by setup.sql. Run AFTER all Layer 1 tests.
-- Deletion order respects foreign key constraints (children first).
-- =============================================================================

BEGIN;

DO $$
DECLARE
  -- Same UUIDs as setup.sql
  v_org_a_id         uuid := 'a0000000-0000-0000-0000-000000000001';
  v_org_b_id         uuid := 'b0000000-0000-0000-0000-000000000002';
  v_project_alpha_id uuid := 'a1000000-0000-0000-0000-000000000001';
  v_project_beta_id  uuid := 'b1000000-0000-0000-0000-000000000002';
  v_alice_id         uuid := 'aa000000-0000-0000-0000-000000000001';
  v_bob_id           uuid := 'bb000000-0000-0000-0000-000000000002';
  v_sam_id           uuid := 'cc000000-0000-0000-0000-000000000003';
  v_charlie_id       uuid := 'dd000000-0000-0000-0000-000000000004';
  v_vic_id           uuid := 'ee000000-0000-0000-0000-000000000005';
  v_eve_id           uuid := 'ff000000-0000-0000-0000-000000000006';

BEGIN

  -- ---------------------------------------------------------------------------
  -- Delete in reverse dependency order
  -- ---------------------------------------------------------------------------

  -- Child entities first (RFIs, etc.)
  DELETE FROM rfis WHERE project_id IN (v_project_alpha_id, v_project_beta_id);

  -- Any additional test entities created by individual tests
  -- (Submittals, change_orders, daily_logs, punch_items, etc.)
  -- Using project_id scoping to catch anything tests may have created.
  DELETE FROM submittals    WHERE project_id IN (v_project_alpha_id, v_project_beta_id);
  DELETE FROM change_orders WHERE project_id IN (v_project_alpha_id, v_project_beta_id);
  DELETE FROM daily_logs    WHERE project_id IN (v_project_alpha_id, v_project_beta_id);
  DELETE FROM punch_items   WHERE project_id IN (v_project_alpha_id, v_project_beta_id);
  DELETE FROM budget_items  WHERE project_id IN (v_project_alpha_id, v_project_beta_id);

  -- Audit log entries for test projects (if audit_log exists)
  -- Note: audit_log may have DELETE restrictions — use service role
  BEGIN
    DELETE FROM audit_log WHERE project_id IN (v_project_alpha_id, v_project_beta_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not clean audit_log (may be immutable): %', SQLERRM;
  END;

  -- Project members
  DELETE FROM project_members WHERE project_id IN (v_project_alpha_id, v_project_beta_id);

  -- Projects
  DELETE FROM projects WHERE id IN (v_project_alpha_id, v_project_beta_id);

  -- Organization members
  DELETE FROM organization_members WHERE organization_id IN (v_org_a_id, v_org_b_id);

  -- Organizations
  DELETE FROM organizations WHERE id IN (v_org_a_id, v_org_b_id);

  -- Auth users (test users only)
  DELETE FROM auth.users WHERE id IN (
    v_alice_id, v_bob_id, v_sam_id, v_charlie_id, v_vic_id, v_eve_id
  );

  RAISE NOTICE 'Layer 1 teardown complete: all test data removed';

END $$;

COMMIT;
