# Workflow Spec — rfi-routing executor

Filed 2026-05-11. Status: shadow-mode scaffolded.

## Trigger
Drafter specialist emits a high-confidence ball-in-court resolution; router dispatches when `(intent='draft_email', entity_type='rfi')`.

## Inputs / Outputs
`RfiRoutingInput { rfi_id, assignee_user_id, confidence, rationale? }`. Sets `rfi.assigned_to`, `rfi.assigned_at`. Logs `executor_runs` row.

## Idempotency
Same `(rfi_id, assignee_user_id, decided_at)` within 1 minute short-circuits.

## Audit
`executor_runs` row with `executor_name='rfi-routing'`, `confidence`, `was_human_cancelled` NULL in shadow mode, `metadata={ rationale, prior_assignee }`.

## Telemetry
Lap 3 Gate 4 query: `executor_runs WHERE was_human_cancelled = TRUE AND decided_at > now() - 7d`.

## Acceptance
- Predicate covered (positive + 4 negative + 1 edge).
- Confidence floor 0.92 per AUTO_EXECUTE_CANCEL_WINDOW_SPEC.
- Blast radius: additive (revert = single column update).
- Shadow mode default; opt-in flip Walker-driven post 7-day shadow watch.
