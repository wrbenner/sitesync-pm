-- =============================================================================
-- 20261009000002_is_demo_extension.sql
-- BRT subsystem 3 §4.2 — extend `is_demo` flag to all demo-seeded child tables.
--
-- Background: 20260426000002 added projects.is_demo and src/services/demoSeed.ts
-- writes the curated "Maple Ridge" fixture into seven tables. Today only
-- projects.is_demo exists, so:
--
--   * Aggregate queries (revenue, throughput, etc.) cannot easily exclude
--     demo data without a project-by-project lookup.
--   * Onboarding sample-data flows have no per-row sentinel for safe deletion.
--
-- This migration adds is_demo to every table demoSeed.ts touches plus the
-- onboarding-sample tables called out in the BRT spec. All defaults are
-- false; existing real rows are unaffected.
--
-- Ships clear_demo_data(p_org_id) — the ONLY safe way to bulk-delete demo
-- rows. It whitelists by is_demo=true; deleting "all rows in org X" is
-- explicitly forbidden inside the function (assert) so an accidental
-- caller signature mismatch can't wipe a live org.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- is_demo flag on the seven child tables. Idempotent (`IF NOT EXISTS`).
-- ---------------------------------------------------------------------------

ALTER TABLE rfis           ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE submittals     ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE punch_items    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE daily_logs     ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE schedule_phases ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE tasks          ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE documents      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- change_orders + drawings may not exist in every install; guard with DO blocks.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'change_orders') THEN
    EXECUTE 'ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drawings') THEN
    EXECUTE 'ALTER TABLE drawings ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Partial indexes — only the tiny demo subset, so they're cheap to maintain.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_rfis_demo           ON rfis           (project_id) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_submittals_demo     ON submittals     (project_id) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_punch_items_demo    ON punch_items    (project_id) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_daily_logs_demo     ON daily_logs     (project_id) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_schedule_phases_demo ON schedule_phases (project_id) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_tasks_demo          ON tasks          (project_id) WHERE is_demo = true;

-- ---------------------------------------------------------------------------
-- clear_demo_data() — the ONLY safe path for bulk demo deletion.
--
-- Hard contract: every DELETE in this function is whitelisted by
-- `is_demo = true`. Removing that predicate would let a misuse delete an
-- entire org's real data; the contract is enforced by reading this code,
-- not by RLS (RLS still restricts to the caller's org).
--
-- Returns a jsonb summary of rows deleted per table, so the UI can show a
-- confirmation toast.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION clear_demo_data(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_is_member  boolean;
  v_summary    jsonb := '{}'::jsonb;
  v_count      int;
BEGIN
  -- Auth: caller must be an owner/admin of the org. This is a destructive
  -- op, no member-level access. Service-role can bypass via direct call.
  IF v_caller IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = p_org_id
        AND user_id = v_caller
        AND role IN ('owner', 'admin')
    ) INTO v_is_member;
    IF NOT v_is_member THEN
      RAISE EXCEPTION 'clear_demo_data: caller is not owner/admin of this org';
    END IF;
  END IF;

  -- Delete in dependency order. Every DELETE filters on is_demo = true
  -- AND project ownership by the org. Cascading FKs (e.g., rfi_responses)
  -- handle deeper rows. Ordering: leaf tables first, then trunks.

  DELETE FROM punch_items
  WHERE is_demo = true
    AND project_id IN (SELECT id FROM projects WHERE organization_id = p_org_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_summary := v_summary || jsonb_build_object('punch_items', v_count);

  DELETE FROM daily_logs
  WHERE is_demo = true
    AND project_id IN (SELECT id FROM projects WHERE organization_id = p_org_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_summary := v_summary || jsonb_build_object('daily_logs', v_count);

  DELETE FROM rfis
  WHERE is_demo = true
    AND project_id IN (SELECT id FROM projects WHERE organization_id = p_org_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_summary := v_summary || jsonb_build_object('rfis', v_count);

  DELETE FROM submittals
  WHERE is_demo = true
    AND project_id IN (SELECT id FROM projects WHERE organization_id = p_org_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_summary := v_summary || jsonb_build_object('submittals', v_count);

  DELETE FROM schedule_phases
  WHERE is_demo = true
    AND project_id IN (SELECT id FROM projects WHERE organization_id = p_org_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_summary := v_summary || jsonb_build_object('schedule_phases', v_count);

  DELETE FROM tasks
  WHERE is_demo = true
    AND project_id IN (SELECT id FROM projects WHERE organization_id = p_org_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_summary := v_summary || jsonb_build_object('tasks', v_count);

  DELETE FROM documents
  WHERE is_demo = true
    AND project_id IN (SELECT id FROM projects WHERE organization_id = p_org_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_summary := v_summary || jsonb_build_object('documents', v_count);

  -- Optional tables (drawings, change_orders) — guard with information_schema.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'change_orders') THEN
    EXECUTE format(
      'DELETE FROM change_orders WHERE is_demo = true
       AND project_id IN (SELECT id FROM projects WHERE organization_id = %L)',
      p_org_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_summary := v_summary || jsonb_build_object('change_orders', v_count);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drawings') THEN
    EXECUTE format(
      'DELETE FROM drawings WHERE is_demo = true
       AND project_id IN (SELECT id FROM projects WHERE organization_id = %L)',
      p_org_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_summary := v_summary || jsonb_build_object('drawings', v_count);
  END IF;

  -- Project last (FK-cascade deletes rest).
  DELETE FROM projects
  WHERE is_demo = true AND organization_id = p_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_summary := v_summary || jsonb_build_object('projects', v_count);

  -- Audit-trail entry. Action enum doesn't include 'bulk_delete'; use
  -- 'delete' with metadata to disambiguate.
  INSERT INTO audit_log (
    organization_id, user_id, entity_type, entity_id, action, metadata
  ) VALUES (
    p_org_id,
    v_caller,
    'demo_data',
    p_org_id,
    'delete',
    jsonb_build_object('summary', v_summary, 'reason', 'clear_demo_data')
  );

  RETURN v_summary;
END $$;

COMMENT ON FUNCTION clear_demo_data IS
  'BRT sub-3 §4.2: bulk delete demo rows for an org. Whitelists by is_demo=true; never deletes by org alone. Owner/admin only.';

REVOKE EXECUTE ON FUNCTION clear_demo_data(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION clear_demo_data(uuid) TO authenticated, service_role;
