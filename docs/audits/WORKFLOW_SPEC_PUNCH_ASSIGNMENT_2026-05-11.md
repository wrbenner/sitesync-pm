# Workflow Spec — punch-assignment executor

Filed 2026-05-11. Status: shadow-mode scaffolded.

## Trigger
Drafter classifies an open punch-list item with a high-confidence (trade, sub) pair from the project's responsibility map.

## Inputs / Outputs
`PunchAssignmentInput { punch_item_id, assignee_user_id, trade, confidence }`. Sets `punch_items.assignee_user_id`, `punch_items.trade`, `punch_items.assigned_at`. Logs `executor_runs` row.

## Idempotency
Same `(punch_item_id, assignee_user_id)` within 1 minute short-circuits.

## Audit
`executor_runs` row with `metadata={ trade, prior_assignee }`.

## Telemetry
Confidence floor 0.9.

## Acceptance
- Predicate covered (positive + 3 negative + 1 multi-failure case).
- Blast radius additive (rollback = clear the assignee).
- Shadow mode default.
