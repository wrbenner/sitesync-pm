-- ═══════════════════════════════════════════════════════════════
-- Migration: rls_audit_patches
-- Version: 20260424000019
-- Purpose: Defense-in-depth pass over every table created earlier in
--          the 20260424* batch. The SECURITY_AUDIT_2026_04_24.md audit
--          confirmed that all new data tables already have
--          ENABLE ROW LEVEL SECURITY + SELECT/INSERT/UPDATE/DELETE
--          policies. This migration hardens them further:
--
--          1. Re-affirm ENABLE ROW LEVEL SECURITY  (idempotent ALTER)
--          2. Add FORCE ROW LEVEL SECURITY         — even the table
--             owner and superusers cannot bypass RLS via ordinary
--             DML paths; service_role still bypasses as designed.
--          3. Re-issue each policy with
--             DROP POLICY IF EXISTS + CREATE POLICY to self-heal if
--             any earlier migration was partially applied in a
--             preview database.
--
--          This migration is additive and idempotent — safe to rerun.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. site_check_ins ─────────────────────────────────────────
ALTER TABLE site_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_check_ins FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_check_ins_select ON site_check_ins;
CREATE POLICY site_check_ins_select ON site_check_ins FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS site_check_ins_insert ON site_check_ins;
CREATE POLICY site_check_ins_insert ON site_check_ins FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS site_check_ins_update ON site_check_ins;
CREATE POLICY site_check_ins_update ON site_check_ins FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS site_check_ins_delete ON site_check_ins;
CREATE POLICY site_check_ins_delete ON site_check_ins FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));

-- ── 2. crew_checkins ──────────────────────────────────────────
ALTER TABLE crew_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_checkins FORCE ROW LEVEL SECURITY;

-- ── 3. risk_predictions ───────────────────────────────────────
ALTER TABLE risk_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_predictions FORCE ROW LEVEL SECURITY;

-- ── 4. subcontractor_ratings ──────────────────────────────────
ALTER TABLE subcontractor_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_ratings FORCE ROW LEVEL SECURITY;

-- ── 5. material_prices ────────────────────────────────────────
-- Platform-owned reference data. Reads open to all authenticated
-- users; writes intentionally service-role-only (no write policies
-- exist, and FORCE RLS here ensures even the table owner can't
-- side-channel writes).
ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_prices FORCE ROW LEVEL SECURITY;

-- ── 6. profiles (columns-only migration — no new table) ───────
-- Skipped: 20260424000006 only added columns to an existing table.
-- The profiles table's existing RLS policies already cover the new
-- columns automatically.

-- ── 7. prequalifications ──────────────────────────────────────
ALTER TABLE prequalifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE prequalifications FORCE ROW LEVEL SECURITY;

-- ── 8. communication_logs ─────────────────────────────────────
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs FORCE ROW LEVEL SECURITY;

-- ── 9. timesheets ─────────────────────────────────────────────
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets FORCE ROW LEVEL SECURITY;

-- ── 10. crew_schedules ────────────────────────────────────────
ALTER TABLE crew_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_schedules FORCE ROW LEVEL SECURITY;

-- ── 11. estimating_items ──────────────────────────────────────
ALTER TABLE estimating_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimating_items FORCE ROW LEVEL SECURITY;

-- ── 12. estimate_rollups ──────────────────────────────────────
ALTER TABLE estimate_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_rollups FORCE ROW LEVEL SECURITY;

-- ── 13. bid_submissions ───────────────────────────────────────
ALTER TABLE bid_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_submissions FORCE ROW LEVEL SECURITY;

-- ── 14. financial_periods ─────────────────────────────────────
ALTER TABLE financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_periods FORCE ROW LEVEL SECURITY;

-- ── 15. retainage_entries ─────────────────────────────────────
ALTER TABLE retainage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE retainage_entries FORCE ROW LEVEL SECURITY;

-- ── 16. agent_tasks ───────────────────────────────────────────
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks FORCE ROW LEVEL SECURITY;

-- ── 17. integration_connections ───────────────────────────────
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections FORCE ROW LEVEL SECURITY;

-- ── 18. integration_sync_jobs ─────────────────────────────────
ALTER TABLE integration_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_jobs FORCE ROW LEVEL SECURITY;
