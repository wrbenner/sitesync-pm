-- ────────────────────────────────────────────────────────────────────────────
-- executor_runs — shadow + opt-in audit table for the 3 hardened executors
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Executors §)
--      docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md
--
-- Every executor invocation appends one row here. Shadow mode = the executor
-- ran but did NOT commit a write (was_human_cancelled=null). Opt-in mode =
-- the executor committed or was cancelled within the 60-second window
-- (was_human_cancelled boolean).
--
-- The Lap 3 acceptance Gate 4 ("auto-execute opt-in × 7d zero cancels")
-- queries this table:
--   SELECT count(*) FROM executor_runs
--    WHERE was_human_cancelled = TRUE
--      AND decided_at > now() - interval '7 days';

CREATE TABLE IF NOT EXISTS executor_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executor_name TEXT NOT NULL
    CHECK (executor_name IN ('rfi-routing', 'daily-log-compilation', 'punch-assignment')),
  specialist_name TEXT NOT NULL
    CHECK (specialist_name IN ('drafter', 'money', 'schedule', 'code', 'field', 'historian')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT,
  entity_id TEXT,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
  -- Shadow vs opt-in:
  --   shadow_mode = TRUE  → was_human_cancelled left NULL
  --   shadow_mode = FALSE → was_human_cancelled is TRUE/FALSE after the 60s window
  shadow_mode BOOLEAN NOT NULL DEFAULT TRUE,
  was_human_cancelled BOOLEAN,
  cancel_reason TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at TIMESTAMPTZ,
  audit_log_id UUID REFERENCES audit_log(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_executor_runs_org_decided
  ON executor_runs (org_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_executor_runs_executor_decided
  ON executor_runs (executor_name, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_executor_runs_cancelled_decided
  ON executor_runs (was_human_cancelled, decided_at DESC)
  WHERE was_human_cancelled IS NOT NULL;

COMMENT ON TABLE executor_runs IS
  'Per-invocation log for the 3 hardened executors. Phase 2e shadow mode; Phase 3 cancel-window opt-in. Source of truth for Lap 3 Gate 4 (7-day zero-cancel observation).';

COMMENT ON COLUMN executor_runs.shadow_mode IS
  'TRUE during the 7-day shadow watch period. FALSE after auto_execute_opt_in flip on the soft-pilot org.';

COMMENT ON COLUMN executor_runs.was_human_cancelled IS
  'NULL while shadow_mode=TRUE; in opt-in mode: TRUE if a human pressed cancel within the 60s window, FALSE if the executor committed.';

ALTER TABLE executor_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "executor_runs: project members can read own-project rows"
  ON executor_runs FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
    OR org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "executor_runs: service role inserts"
  ON executor_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- ────────────────────────────────────────────────────────────────────────────
-- executor_daily_counts view — daily roll-up for the acceptance gate query
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW executor_daily_counts AS
SELECT
  date_trunc('day', decided_at)::date AS day,
  executor_name,
  shadow_mode,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE was_human_cancelled = TRUE) AS cancelled_runs,
  COUNT(*) FILTER (WHERE was_human_cancelled = FALSE) AS committed_runs,
  AVG(confidence) AS avg_confidence
FROM executor_runs
GROUP BY 1, 2, 3;

COMMENT ON VIEW executor_daily_counts IS
  'Daily executor roll-up. The Lap 3 Gate 4 workflow queries this view for the 7-consecutive-day zero-cancel check.';

GRANT SELECT ON executor_daily_counts TO authenticated;
