-- =============================================================================
-- Pay App Reconciliation
-- =============================================================================
-- Persists the schedule-vs-pay-app reconciliation snapshot (one row per pay
-- app + one row per SOV line). Money columns are numeric(15,2) — Postgres
-- numeric is exact decimal, which is the only safe representation of
-- AIA-spec dollar amounts. CHECK constraints prevent negatives where the
-- spec requires non-negative values.
--
-- The reconciliation runs idempotently from a pure function (see
-- src/lib/reconciliation/scheduleVsPayApp.ts). Repeat runs replace prior
-- output by (pay_app_id) — a fresh snapshot per pay-app version.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pay_app_reconciliations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_app_id               uuid NOT NULL UNIQUE
                                REFERENCES payment_applications(id) ON DELETE CASCADE,
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Severity rollup of the worst line.
  status                   text NOT NULL DEFAULT 'ok'
                                CHECK (status IN ('ok','minor','material','critical')),
  -- True iff any line trips a blocking severity.
  blocked                  boolean NOT NULL DEFAULT false,
  -- Sum of pay-app SOV $ at material/critical variance.
  blocked_dollars_at_risk  numeric(15,2) NOT NULL DEFAULT 0
                                CHECK (blocked_dollars_at_risk >= 0),
  -- JSONB snapshot of per-line variance, indexed by cost code. Mirrors the
  -- output of `reconcileScheduleVsPayApp` exactly.
  variance_lines           jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Material-tolerance percentage actually applied (e.g. 10.0 for default).
  applied_tolerance_pct    numeric(5,2) NOT NULL DEFAULT 10.00,
  -- Override metadata (set when a PM submits despite blocked status).
  override_reason          text,
  override_by              uuid REFERENCES auth.users(id),
  override_at              timestamptz,
  -- Provenance: every audit-trail row tracks its source.
  created_via              text NOT NULL DEFAULT 'manual',
  source_drafted_action_id uuid,
  computed_at              timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_app_recon_project
  ON pay_app_reconciliations(project_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pay_app_recon_blocked
  ON pay_app_reconciliations(project_id, blocked) WHERE blocked = true;

-- Per-line projection — each pay-app SOV line gets one row, joined to the
-- schedule activity by cost code. Lets us query/sort variances in SQL
-- without re-parsing the JSONB blob on every UI load.
CREATE TABLE IF NOT EXISTS pay_app_reconciliation_lines (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id        uuid NOT NULL
                                REFERENCES pay_app_reconciliations(id) ON DELETE CASCADE,
  pay_app_id               uuid NOT NULL
                                REFERENCES payment_applications(id) ON DELETE CASCADE,
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cost_code                text NOT NULL,
  description              text NOT NULL,
  schedule_pct             numeric(6,2),  -- nullable when no schedule match
  pay_app_pct              numeric(6,2),  -- nullable when no SOV match
  scheduled_value          numeric(15,2) NOT NULL DEFAULT 0
                                CHECK (scheduled_value >= 0),
  variance_pct             numeric(6,2),
  severity                 text NOT NULL DEFAULT 'ok'
                                CHECK (severity IN ('ok','minor','material','critical')),
  blocked                  boolean NOT NULL DEFAULT false,
  reason                   text NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_lines_reconciliation
  ON pay_app_reconciliation_lines(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_recon_lines_pay_app
  ON pay_app_reconciliation_lines(pay_app_id);
CREATE INDEX IF NOT EXISTS idx_recon_lines_project_severity
  ON pay_app_reconciliation_lines(project_id, severity);

ALTER TABLE pay_app_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_app_reconciliation_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recon_member_select ON pay_app_reconciliations;
CREATE POLICY recon_member_select ON pay_app_reconciliations
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS recon_member_insert ON pay_app_reconciliations;
CREATE POLICY recon_member_insert ON pay_app_reconciliations
  FOR INSERT WITH CHECK (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS recon_member_update ON pay_app_reconciliations;
CREATE POLICY recon_member_update ON pay_app_reconciliations
  FOR UPDATE USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS recon_lines_member_select ON pay_app_reconciliation_lines;
CREATE POLICY recon_lines_member_select ON pay_app_reconciliation_lines
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS recon_lines_member_insert ON pay_app_reconciliation_lines;
CREATE POLICY recon_lines_member_insert ON pay_app_reconciliation_lines
  FOR INSERT WITH CHECK (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- updated_at maintained by a generic trigger if one already exists; otherwise
-- application code refreshes it on UPSERT.
COMMENT ON TABLE  pay_app_reconciliations
  IS 'One row per pay app: schedule-vs-pay-app variance rollup. Recomputed idempotently.';
COMMENT ON TABLE  pay_app_reconciliation_lines
  IS 'Per-cost-code variance projection — joined output of reconcileScheduleVsPayApp.';
