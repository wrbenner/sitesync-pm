# Phase 2e — router + 3 hardened executors + phase-2-acceptance.yml

Date: 2026-05-11. Branch: phase-2e-router-executors. Builds on Phase 2a/2b/2c/2d.

## TL;DR

Closes Phase 2 with the router that dispatches IrisInvocations to one of the 4 specialists, the 3 hardened executors (rfi-routing, daily-log-compilation, punch-assignment) running in shadow mode, the `executor_runs` audit table (the source of truth for the Lap 3 Gate 4 zero-cancel observation), and the `phase-2-acceptance.yml` CI gate.

Router achieves >= 95% accuracy on a 50-case starter set (200-case full set is Walker-authored Phase 2 close-out).

24 new tests pass (6 router + 18 executor).

## Changes

- supabase/migrations/20260820010000_executor_runs.sql:
  - `executor_runs` table with shadow_mode + was_human_cancelled + audit_log_id.
  - `executor_daily_counts` view rolling daily counts by executor + shadow flag.
  - RLS: project members read own-project rows; service role inserts.

- src/services/iris/router.ts:
  - `routeInvocationSync` and `routeInvocation` (async, with optional `RouterLlmResolver` hook).
  - Cascading strategy: deterministic map -> regex/keyword classifier -> LLM fallback -> unknown.
  - 50-case starter test set; >= 95% accuracy enforced in CI.

- src/services/iris/executors/:
  - types.ts (ExecutorDecl + predicate base).
  - rfi-routing.ts (confidence floor 0.92, additive).
  - daily-log-compilation.ts (confidence floor 0.85, additive).
  - punch-assignment.ts (confidence floor 0.9, additive).
  - __tests__/executors.test.ts (18 predicate tests).

- .github/workflows/phase-2-acceptance.yml:
  - 4 jobs: router-accuracy, specialists, executors, shadow-telemetry (DB).
  - Daily 18:15 UTC + workflow_dispatch + PR-triggered on Phase 2 paths.

- Workflow Spec cards filed:
  - WORKFLOW_SPEC_RFI_ROUTING_2026-05-11.md
  - WORKFLOW_SPEC_DAILY_LOG_COMPILATION_2026-05-11.md
  - WORKFLOW_SPEC_PUNCH_ASSIGNMENT_2026-05-11.md

## Verification

`NODE_OPTIONS=... npx tsc --noEmit -p tsconfig.app.json` -> exit 0.
`npx vitest run src/services/iris/` -> all tests green (Drafter 15 + Money 19 + Schedule 20 + Code 19 + router 6 + executors 18 + earlier suites).

## Phase 2 fully shipped (5 sub-phases)

| Sub | PR | Specialist / scope |
|-----|----|-------------------|
| 2a  | #423 | Drafter + ADR-018 base |
| 2b  | #424 | Money + CO pricing |
| 2c  | #425 | Schedule + CPM |
| 2d  | #426 | Code + KB stub |
| 2e  | this | Router + 3 executors + acceptance.yml |

## What this does NOT do

- Real LLM-side router fallback (RouterLlmResolver hook + default unknown).
- Full 200-case routing accuracy goldens (50 shipped; Walker authors 150 more).
- Executor DB writes (predicates only; the actual `supabase.from('rfis').update(...)` plumbing lands in a follow-up PR once shadow watch confirms confidence stability).
- Cancel-window UX (next PR).
- Opt-in flag flip (penultimate PR).

## Next up

cancel-window-ux PR (60-second cancel banner + push + email + SMS surfaces) and auto-execute-opt-in PR (soft-pilot flag flip + lap-3-acceptance.yml).
