-- ═══════════════════════════════════════════════════════════════
-- Migration: financial_periods
-- Version: 20260424000014
-- Purpose: Monthly financial period close ledger. Consumed by
--          useFinancialPeriods / useActivePeriod / useClosePeriod /
--          useReopenPeriod under src/hooks/{queries,mutations}/
--          financial-periods.ts.
--
-- Close is an accounting boundary — downstream pages (change-orders,
-- pay-apps) key banners off `useActivePeriod`. Never silently drop
-- errors; writes must hard-fail if RLS rejects.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_periods (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period_month   date NOT NULL,
  status         text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending_close', 'closed', 'reopened')),
  closed_at      timestamptz,
  closed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at    timestamptz,
  reopened_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Period month is always the first of the month, unique per project.
  CONSTRAINT financial_periods_month_first_of_month
    CHECK (period_month = date_trunc('month', period_month)::date),
  CONSTRAINT financial_periods_project_month_unique
    UNIQUE (project_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_financial_periods_project_month
  ON financial_periods (project_id, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_financial_periods_project_status
  ON financial_periods (project_id, status);

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_financial_periods_updated_at ON financial_periods;
CREATE TRIGGER trg_financial_periods_updated_at
  BEFORE UPDATE ON financial_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE financial_periods ENABLE ROW LEVEL SECURITY;

-- Any project member can read periods.
DROP POLICY IF EXISTS financial_periods_select ON financial_periods;
CREATE POLICY financial_periods_select ON financial_periods FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

-- Only owner/admin can create, close, or reopen a period.
DROP POLICY IF EXISTS financial_periods_insert ON financial_periods;
CREATE POLICY financial_periods_insert ON financial_periods FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS financial_periods_update ON financial_periods;
CREATE POLICY financial_periods_update ON financial_periods FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS financial_periods_delete ON financial_periods;
CREATE POLICY financial_periods_delete ON financial_periods FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
  ));
