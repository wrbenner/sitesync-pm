# Auto-execute opt-in scaffold + lap-3-acceptance.yml

Date: 2026-05-11. Branch: auto-execute-opt-in. Stacked on Phase 2e + cancel-window-ux.

## TL;DR

Closes the engineering side of Lap 3. Adds the org-level `auto_execute_opt_in` flag (default FALSE), the eligibility decision function that combines org flag + persona threshold + executor floor, the 7-day rolling cancel-rate view, and the `lap-3-acceptance.yml` CI workflow that runs daily and asserts Gate 4 (auto-execute zero cancels) fail-closed.

7 new tests pass; typecheck zero.

## Changes

- supabase/migrations/20260830010000_auto_execute_opt_in.sql:
  - Adds `organizations.auto_execute_opt_in BOOLEAN DEFAULT FALSE` + `auto_execute_opted_in_at` + `auto_execute_opted_in_by`.
  - Creates `org_executor_cancel_rate_7d` view (org-level rolling 7-day cancel count).

- src/services/iris/autoExecute.ts:
  - `decideAutoExecute({ org_auto_execute_opt_in, persona, executor, confidence })` returns either `{ mode: 'live', cancel_window_ms: 60000 }` or `{ mode: 'shadow', reasons }`.
  - Combines: org flag, persona auto_action_threshold (per ADR-019), executor confidence_floor.
  - Owner_rep persona (1.0 threshold) always returns shadow.

- src/services/iris/__tests__/autoExecute.test.ts (7 tests):
  - Live path on healthy inputs.
  - Shadow when org opt-in FALSE.
  - Shadow for owner_rep never-auto.
  - Shadow when confidence below persona threshold.
  - Shadow when confidence below executor floor.
  - Foreman 0.9 threshold gates correctly.
  - Multi-reason aggregation.

- .github/workflows/lap-3-acceptance.yml:
  - Daily 18:30 UTC + workflow_dispatch.
  - 4 jobs: gate-4-zero-cancel (DB query, fail-closed when STAGING_DB_URL set), gate-3-demo-runs (counts docs/sales/demo-runs/*.md), gate-1-2-contracts (informational), gate-5-weekend-off (looks for the qualitative receipt).

## How the 5 gates resolve

| Gate | Mechanism | Programmatic |
|------|-----------|--------------|
| 1 — signed paid contract | Stripe + MSA tracked outside CI (Walker-driven) | No (informational logging only) |
| 2 — 2 more in legal review | Walker-driven outside CI | No |
| 3 — demo flawless 4x | docs/sales/demo-runs/*.md counter | Soft (warning) |
| 4 — auto-execute zero cancels 7d | DB query against org_executor_cancel_rate_7d | YES (fail-closed) |
| 5 — real weekend off | docs/audits/WEEKEND_OFF_RECEIPT.md attestation | No (qualitative) |

Gate 4 is the only one this workflow actually blocks on. The others log status for visibility.

## Calendar-bound observation

The opt-in flip itself is Walker-driven on Day 68 per the plan:
1. Walker sets `auto_execute_opt_in = TRUE` on the Brad/Nexus soft-pilot org for one executor type (recommend rfi-routing first - lowest blast radius).
2. Daily lap-3-acceptance.yml runs the Gate 4 query.
3. Zero cancels over 7 consecutive days = Gate 4 closes.
4. ONE cancel within 7 days = flag flips back to FALSE; counter resets per the zero-tolerance rule.

## What this does NOT do

- Auto-flip on cancel (the trigger that flips opt_in back to FALSE on cancel is a follow-up DB trigger; Phase 2e left this as Walker-controlled).
- Real demo-run receipt template (docs/sales/demo-runs/ directory does not yet exist; lands when Walker runs the first demo).
- Real Stripe/MSA tracking outside CI.
