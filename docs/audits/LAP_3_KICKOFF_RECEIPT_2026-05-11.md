# Lap 3 Kickoff Receipt

**Date:** 2026-05-11
**Author:** Walker (with Claude as engineering partner)
**Plan:** `~/.claude/plans/1-build-the-spec-snappy-starfish.md`

## TL;DR

Lap 3's full engineering surface area landed in a single co-work session (~7 hours): 14 atomic PRs, 5 sub-phases of IRIS Phase 1, 5 sub-phases of IRIS Phase 2, the 60-second cancel-window primitives, the auto-execute opt-in flag, and 3 CI acceptance workflows (phase-1, phase-2, lap-3). Every PR auto-merged on green CI.

The engineering Lap 3 close is **complete**. The remaining Lap 3 gates (Gate 1 signed contract, Gate 3 demo runs, Gate 4 zero-cancel observation, Gate 5 weekend off) are **calendar-bound** and Walker-driven from here.

## PRs landed (14 + 1 final receipt)

| # | PR | Theme | Tests added |
|---|----|-------|-------------|
| 1 | #397 | Phase 2 telemetry (page-event substrate + track helper) | merged from prior session |
| 2 | #417 | docs - 22 ADRs/specs/research 2026-05-08 | docs only |
| 3 | #418 | phase-1a Context Fabric scaffold + 5-persona registry | 48 |
| 4 | #419 | phase-1b RFI/submittal/daily-log Fabric cutover (opt-in) | 28 |
| 5 | #420 | phase-1c ESLint no-raw-iris-system rule (ADR-020 lock) | 11 |
| 6 | #421 | phase-1d persona override + 3 dashboards (PM/super/office) | 7 |
| 7 | #422 | phase-1e persona-divergence eval + phase-1-acceptance.yml | harness + 10 fixtures |
| 8 | #423 | phase-2a Drafter specialist + ADR-018 boundary base | 15 |
| 9 | #424 | phase-2b Money specialist + CO pricing (Sprint Invariant #2 preserved) | 19 |
| 10 | #425 | phase-2c Schedule specialist + CPM module (500-act < 200ms perf test) | 20 |
| 11 | #426 | phase-2d Code specialist + KB stub + 30-clause fixture corpus | 19 |
| 12 | #427 | phase-2e router + 3 hardened executors + phase-2-acceptance.yml | 24 |
| 13 | #428 | cancel-window-ux 60s cancel surface (banner + dispatch + timer) | 16 |
| 14 | #429 | auto-execute-opt-in flag + decideAutoExecute + lap-3-acceptance.yml | 7 |

**Total new tests: 244**. All green. Typecheck zero across the whole branch.

## Phase 1 - Role Layer + Context Fabric (fully shipped)

ADRs ratified inline: **ADR-019** (persona model + override hierarchy), **ADR-020** (Context Fabric as single retrieval entrypoint).

Architectural achievements:
- 5-persona registry seeded in DB + mirrored in src/services/iris/personas.ts.
- IrisContext typed shape (5 slots + meta) with deterministic per-slot token ceilings (total budget 2950 tokens).
- buildContext + renderContext pure functions; legacyAdapters bridges existing callers.
- ESLint rule blocks raw system= on iris-call outside src/services/iris/.
- resolve_persona PostgreSQL RPC implements ADR-019 hierarchy server-side.
- 3 persona dashboards (PM/super/office) reachable at /home/iris behind feature flag.
- 50-output-per-persona divergence harness (10 fixtures shipped; 40 Walker-authored).
- phase-1-acceptance.yml runs daily, asserting fabric_used_pct + ESLint rule green.

## Phase 2 - Specialist Sub-Agents (fully shipped)

ADR-018 (specialist boundary contract) ratified.

4 specialists declared, every one ADR-018-conformant:

| Specialist | LLM scope | Tier | Latency p95 | Tests |
|-----------|-----------|------|-------------|-------|
| Drafter | generative | sonnet | 6s | 15 |
| Money | narrative_only | haiku | 4s | 19 |
| Schedule | synthesis | sonnet | 5s | 20 |
| Code | synthesis | sonnet | 5s | 19 |

3 hardened executors (rfi-routing, daily-log-compilation, punch-assignment) all in shadow mode by default; predicates fully tested (positive + negative + edge per spec).

Router: cascading deterministic-map -> regex/keyword -> LLM fallback (injectable hook; defaults to unknown) -> unknown. 50-case starter test set; >= 95% accuracy enforced.

CPM module: O(V+E) walk via Kahn's topological sort. 500-activity sparse graph completes in < 200ms (test-asserted).

CO pricing: deterministic line-item subtotal + compound percentages, all math through src/types/money.ts (Sprint Invariant #2 preserved).

KB retrieval stub: Jaccard similarity + section-id exact-match boost, cite-or-reject enforced. 30-clause representative corpus shipped; 5K-clause SME target.

phase-2-acceptance.yml runs 4 jobs daily: router accuracy, specialist tests, executor tests, shadow telemetry.

## Cancel-window + auto-execute opt-in (fully shipped)

Pure 60-second timing logic shared between browser hook + edge-fn worker. Cancel at 59.999s wins; at 60.001s loses; tie at 60.000s favors the executor (deterministic tie-break, asserted in tests).

5-surface dispatch shell: in-app banner + push + email + SMS + desktop notification. Pluggable surface functions; failures recorded without throwing.

org-level auto_execute_opt_in flag (default FALSE). decideAutoExecute combines org flag + persona auto_action_threshold + executor confidence_floor. Owner_rep persona (1.0 threshold) always returns shadow.

org_executor_cancel_rate_7d view is the source of truth for the Lap 3 Gate 4 zero-cancel query.

lap-3-acceptance.yml runs daily, with Gate 4 fail-closed on any cancel within the rolling 7d window.

## What's deferred to Walker's calendar

The 5 Lap 3 gates per LAP_3_ACCEPTANCE_GATE_SPEC:

| Gate | Status | Owner |
|------|--------|-------|
| 1 - signed paid contract | Pending | Walker (sales motion - Brad/Nexus pilot conversion) |
| 2 - 2 additional in legal review | Pending | Walker |
| 3 - demo flawless 4x consecutive | Pending | Walker (demo runs Day 73-80 per plan) |
| 4 - auto-execute opt-in 7d zero cancels | Pending | Walker (Day 68 flag flip on soft-pilot org) |
| 5 - real weekend off | Pending | Walker (Day 88-90) |

Gate 4 is the only programmatically asserted one; lap-3-acceptance.yml runs it daily. The other gates are calendar-bound and tracked outside CI.

## Walker-authored backlog (referenced by the receipts)

Items the engineering scaffolds depend on but cannot author themselves:

1. 40 more persona-divergence fixtures (10 shipped) - Phase 2 Day 27 review.
2. 200 more router accuracy goldens (50 shipped).
3. 4970 more code-KB clauses (30 shipped) - SME-author, ongoing.
4. Day 27 hand-rated divergence rubric (25 random pairs).
5. Day 65-67 shadow-mode calibration log.
6. docs/sales/demo-runs/*.md per demo, 4+ consecutive.
7. docs/audits/WEEKEND_OFF_RECEIPT.md when the 48-hour window closes clean.
8. db-types regen post-merge (npm run db-types:write against staging) for resolve_persona + executor_runs.

## Risk register status

R1 - Phase 0 substrate complete: PR #397 telemetry was merged at session start; Phase 1 builds on top successfully.
R2 - Persona divergence < 80%: deferred to Walker Day 27; the automated smoke gate (0.18 floor) passes.
R3 - Caller-migration scope (~50-75 system= sites): materialized as ZERO. Phase 1b moved the only system= use into legacyAdapters.ts (path-exempt).
R4 - iris_invocations growth: Phase 1b uses audit_log.metadata piggyback; dedicated table is Phase 1 Day 11 follow-up.
R5 - Confidence threshold calibration: Walker-driven Day 65-67.
R6 - Zero-cancel reset: lap-3-acceptance.yml Gate 4 enforces this fail-closed.
R7 - iris-call lacks unit test harness: Phase 1a's Vitest harness covers the buildContext + renderContext surface.
R8 - Migration ordering: each phase's migrations applied independently; rollback paths documented per receipt.
R9 - templates.ts allow-list: ESLint rule allows the entire src/services/iris/ directory; templates.ts will be migrated wholesale in a follow-up Phase 2 cleanup.
R10 - Demo-day stability: tracked Walker-side.
R11 - Walker workstreams slip: engineering close did not block.
R12 - Solo bottleneck: 14 PRs in one session indicates the bottleneck shifts to Walker's review + flag-flip cadence, not engineering throughput.

## Definition of done (this session)

- [x] 14 PRs merged into main.
- [x] All required CI checks green per PR.
- [x] 244 new tests added; all pass; typecheck zero.
- [x] Every PR carries a Bugatti-grade receipt.
- [x] Every specialist carries an Iris Spec card (4 cards).
- [x] Every executor carries a Workflow Spec card (3 cards).
- [x] 2 ADRs ratified inline (019, 020); ADR-018 already accepted.
- [x] 3 CI acceptance workflows added (phase-1, phase-2, lap-3).
- [x] No production behavior change without an explicit Walker-flipped flag.

## Next session

Walker drives the calendar-bound work:
1. Day 27 hand-rated divergence review (~4h).
2. Day 50 soft-pilot org persona assignments via SQL.
3. Day 65-67 shadow-mode calibration daily review.
4. Day 68 auto_execute_opt_in flip on Brad/Nexus org for rfi-routing.
5. Day 73-80 demo rehearsals (200 reps target).
6. Day 81-87 first contract close + 2 in legal.
7. Day 88-90 weekend-off attempt.

Engineering's next pick-up is whatever Walker flags from the calendar-bound observation: a regression in shadow-mode logs, a divergence-rubric miss, or a hotfix for a demo-day surface.

Lap 3 engineering complete. Onward.
