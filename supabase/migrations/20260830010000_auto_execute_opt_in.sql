-- ────────────────────────────────────────────────────────────────────────────
-- auto_execute_opt_in — per-org flag that flips executors from shadow to live
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md
--       docs/audits/LAP_3_ACCEPTANCE_GATE_SPEC_2026-05-04.md
--
-- Once `auto_execute_opt_in = TRUE` on an org, hardened executors that:
--   1. Match the persona's auto_action_threshold AND
--   2. Pass their predicate AND
--   3. Confidence >= executor.confidence_floor
-- transition from shadow mode to the 60-second cancel-window live path.
-- Otherwise the executor stays in shadow mode (logged but never committed).
--
-- Default: FALSE. Walker flips on the soft-pilot org on Day 68 per the plan;
-- one human cancel within 7 days flips it back to FALSE (zero-tolerance
-- 7-day reset).
--
-- Rollback path: drop the column. The executor falls back to shadow mode
-- when the column is missing (executors treat undefined as FALSE).

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS auto_execute_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_execute_opted_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_execute_opted_in_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN organizations.auto_execute_opt_in IS
  'Per-org gate. TRUE = hardened executors run live (with 60s cancel window). FALSE = shadow mode. Walker-flippable; auto-revert to FALSE on cancel-in-window per Lap 3 Gate 4 zero-tolerance rule.';

-- ────────────────────────────────────────────────────────────────────────────
-- A small helper view: rolling 7-day cancel rate per org
-- ────────────────────────────────────────────────────────────────────────────
-- Lap 3 Gate 4 queries this to enforce the 7-day zero-cancel rule.

CREATE OR REPLACE VIEW org_executor_cancel_rate_7d AS
SELECT
  o.id AS org_id,
  o.name AS org_name,
  o.auto_execute_opt_in,
  o.auto_execute_opted_in_at,
  COUNT(er.id) FILTER (
    WHERE er.shadow_mode = FALSE AND er.decided_at > NOW() - INTERVAL '7 days'
  ) AS total_runs_7d,
  COUNT(er.id) FILTER (
    WHERE er.was_human_cancelled = TRUE AND er.decided_at > NOW() - INTERVAL '7 days'
  ) AS cancelled_runs_7d
FROM organizations o
LEFT JOIN executor_runs er ON er.org_id = o.id
GROUP BY o.id, o.name, o.auto_execute_opt_in, o.auto_execute_opted_in_at;

GRANT SELECT ON org_executor_cancel_rate_7d TO authenticated;

COMMENT ON VIEW org_executor_cancel_rate_7d IS
  'Rolling 7-day per-org cancel rate. Lap 3 Gate 4 reads this to enforce the zero-cancel observation window.';
