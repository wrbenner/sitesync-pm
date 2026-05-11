# Workflow Spec — daily-log-compilation executor

Filed 2026-05-11. Status: shadow-mode scaffolded.

## Trigger
Drafter specialist's summarization pass over the day's field events produces a draft daily log with confidence >= floor.

## Inputs / Outputs
`DailyLogCompilationInput { project_id, date (YYYY-MM-DD), source_event_count, confidence }`. Writes a draft `daily_logs` row; super finalizes via explicit tap.

## Idempotency
Same `(project_id, date)` produces at most one draft per day. Re-runs update the existing draft until super finalizes.

## Audit
`executor_runs` row with `metadata={ source_event_count }`.

## Telemetry
Confidence floor 0.85 (super-persona threshold).

## Acceptance
- Predicate covered (positive + 4 negative cases).
- Blast radius additive (rollback = delete the draft row).
- Shadow mode default; super-persona never-auto on schedule/safety preserved.
