# ORGANISM V2 — Architecture Document

> **Version:** 2.0.0
> **Status:** Draft — Awaiting Owner Approval
> **Author:** Walker Benner (@wrbenner)
> **Last Updated:** 2026-04-15
> **Repository:** wrbenner/sitesync-pm
> **CODEOWNERS:** @wrbenner (changes require PR + review)

---

## Table of Contents

1. [Executive Vision](#1-executive-vision)
2. [The Core Loop — Perceive, Reason, Build, Verify, Learn](#2-the-core-loop--perceive-reason-build-verify-learn)
3. [The Constitutional Layer](#3-the-constitutional-layer)
4. [Multi-Model Brain](#4-multi-model-brain)
5. [The Skill Library](#5-the-skill-library)
6. [Population Diversity (MAP-Elites)](#6-population-diversity-map-elites)
7. [The Exploration Engine](#7-the-exploration-engine)
8. [Workflow Architecture](#8-workflow-architecture)
9. [Safety and Circuit Breakers](#9-safety-and-circuit-breakers)
10. [Maturity Levels](#10-maturity-levels)
11. [Implementation Plan](#11-implementation-plan)
12. [Metrics That Matter](#12-metrics-that-matter)
13. [Why This Wins](#13-why-this-wins)

---

## 1. Executive Vision

### 1.1 What the Organism Is

The organism is not a chatbot. It is not a code assistant. It is not a GitHub Action that runs lint.

It is a **living software system** that perceives its own state, reasons about what to improve, builds the improvement, verifies it worked, and learns from the outcome — on a continuous loop, 24/7, getting smarter every cycle.

The founder's vision: *"Build a life form more intelligent than anything out there that builds itself with proper guardrails and teaching, like raising a human to be smarter than any human."*

This document is the blueprint for that life form.

### 1.2 What Makes This Different from Every Other "AI Coding Agent"

Every other system — Devin, Copilot Workspace, Cursor, Factory Droids — is a **tool**. You tell it what to do. It does it. It has no understanding of what "correct" means for your domain. It has no memory of what it tried last week. It has no model of the world it operates in.

The SiteSync Organism is different because it has seven things no other system has:

| Component | What It Does | Why It Matters |
|---|---|---|
| **DOMAIN MODEL** (kernel spec) | Defines what "correct" means for every entity, relationship, state machine, and permission in construction PM | The organism knows the destination — 97 kernel entities, each with scope rules, temporal columns, state machines, and RLS policies |
| **SCHEMA GAP ANALYSIS** | Tells the organism exactly what's wrong — 86 tables need column additions, 56 need RLS, 1 needs a role enum update | The organism has a map of every gap between current state and target state |
| **EVAL HARNESS** | Tests real assertions against the live database across 4 layers | The organism can verify its own work against ground truth, not just "does it compile" |
| **QUALITY RATCHET** | Ensures metrics can only improve, never regress — ESLint errors (1036 floor), coverage (43.2%), bundle size (1869 KB) | The organism can never make things worse. Progress is irreversible. |
| **MULTI-MODEL BRAIN** | Claude for reasoning, OpenAI for cross-verification, Gemini for vision, Perplexity for research | Different model families catch different errors. Cross-Model Perplexity achieves AUROC 0.75 vs 0.59 for same-model verification |
| **CONSTITUTIONAL CONSTRAINTS** | Hardcoded safety rules the organism cannot override | The organism is safe by design, not by hope |
| **LEARNING SYSTEM** | Append-only ledger, skill library, compressed world model | Knowledge compounds across cycles. The organism never forgets what it learned. |

### 1.3 The Closest Analogy

Google's AlphaEvolve discovers algorithms that improve Google's infrastructure — it recovered 0.7% of Google's worldwide compute by optimizing the Borg scheduler, achieved a 23% speedup for matrix multiplication in Gemini's own training pipeline, and discovered the first improvement to matrix multiplication since Strassen's 1969 algorithm.

This organism discovers improvements that make SiteSync a better construction PM platform. The mechanism is the same: perceive → generate → verify → keep winners → discard losers → repeat.

The difference: AlphaEvolve optimizes algorithms. Organism V2 optimizes an entire product.

### 1.4 The Authority Chain

```
DOMAIN_KERNEL_SPEC.md          (what "correct" means — source of truth)
    ↓
SCHEMA_GAP_ANALYSIS.md         (what's wrong — 99 tables audited)
    ↓
ORGANISM_V2_ARCHITECTURE.md    (THIS DOCUMENT — how to close the gaps)
    ↓
.github/workflows/organism-*   (the autonomous workflows)
    ↓
EVOLUTION_LEDGER.md            (immutable log of every experiment)
    ↓
LEARNINGS.md                   (compounding intelligence)
```

---

## 2. The Core Loop — Perceive, Reason, Build, Verify, Learn

The organism operates on a 5-phase cycle inspired by three converging research threads:

- **Voyager's** three-component architecture (automatic curriculum + skill library + iterative prompting) — which achieved 3.3× more unique items and 15.3× faster milestone unlocks in open-ended environments
- **SICA's** self-referential improvement loop — which improved SWE-bench scores from 17% to 53% over 14 iterations at ~$7,000 total cost
- **AlphaEvolve's** generate-evaluate-evolve pipeline — which now runs in production at Google, optimizing real infrastructure

The cycle runs continuously. Each phase feeds the next. The output of Learn becomes the input of Perceive.

```
    ┌──────────────────────────────────────────────────────────────────┐
    │                                                                  │
    │   ┌───────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
    │   │           │   │          │   │          │   │          │  │
    │   │ PERCEIVE  │──▶│  REASON  │──▶│  BUILD   │──▶│  VERIFY  │  │
    │   │           │   │          │   │          │   │          │  │
    │   └───────────┘   └──────────┘   └──────────┘   └─────┬────┘  │
    │         ▲                                              │       │
    │         │         ┌──────────┐                         │       │
    │         │         │          │                         │       │
    │         └─────────│  LEARN   │◀────────────────────────┘       │
    │                   │          │                                  │
    │                   └──────────┘                                  │
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: PERCEIVE

The organism observes its own state. Perception is pure measurement — no LLM calls, no interpretation, no judgment. Scripts and APIs only.

#### What the Organism Measures

| Category | Metric | Source | Current State |
|---|---|---|---|
| **Code health** | ESLint errors | `npx eslint --format json` | 1036 (floor) |
| **Code health** | TypeScript errors | `npx tsc --noEmit` | 0 (floor) |
| **Code health** | `as any` count | `grep -r 'as any' src/` | 1 (floor) |
| **Code health** | Mock count | `grep -r 'mock' src/` | 7 (floor) |
| **Code health** | `@ts-ignore` count | `grep -r '@ts-ignore' src/` | 0 (floor) |
| **Test health** | Test count | `npx vitest --reporter=json` | 45 tests |
| **Test health** | Statement coverage | `npx vitest --coverage` | 43.2% (floor) |
| **Test health** | Branch coverage | `npx vitest --coverage` | 35% |
| **Test health** | E2E pass rate | Playwright runner | 70% (floor) |
| **Bundle** | Bundle size | `npx vite build --json` | 1869 KB (ceiling) |
| **Bundle** | Longest response | API monitoring | 340ms (ceiling) |
| **Schema** | Tables conformant (no gaps) | Schema gap parser | 5 of 99 |
| **Schema** | Tables with full RLS | RLS audit script | 43 of 99 |
| **Schema** | Tables missing columns | Gap analysis parser | 86 of 99 |
| **Schema** | Deprecation candidates | DEPRECATION_LEDGER parser | 2 tables |
| **Eval** | Layer 1 pass rate | Eval harness | tracked per run |
| **Eval** | Layer 2 pass rate | Eval harness | tracked per run |
| **Eval** | Layer 3 pass rate | Eval harness | tracked per run |
| **Eval** | Layer 4 pass rate | Eval harness | tracked per run |
| **App health** | Vercel deployment status | Vercel API | tracked per deploy |
| **App health** | Accessibility violations | `axe-core` audit | 0 (floor) |
| **Git** | Recent PRs merged/closed | GitHub API | tracked per cycle |
| **Git** | Open organism PRs | GitHub API | tracked per cycle |
| **Cost** | API spend (24h) | Token tracking | tracked per day |

#### Perception Output

Perception writes a timestamped JSON snapshot to `.metrics/perception-{ISO_DATE}.json`:

```json
{
  "timestamp": "2026-04-15T06:00:00Z",
  "cycle_id": "perception-2026-04-15-001",
  "code_health": {
    "eslint_errors": 1036,
    "ts_errors": 0,
    "any_count": 1,
    "mock_count": 7,
    "ts_ignore_count": 0
  },
  "test_health": {
    "test_count": 45,
    "coverage_statements": 43.2,
    "coverage_branches": 35,
    "coverage_functions": 40,
    "e2e_pass_rate": 0.70
  },
  "bundle": {
    "size_kb": 1869,
    "longest_response_ms": 340
  },
  "schema_conformance": {
    "total_tables": 99,
    "fully_conformant": 5,
    "rls_confirmed": 43,
    "rls_unknown": 56,
    "missing_columns": 86,
    "deprecation_candidates": 2,
    "role_enum_mismatch": 1
  },
  "eval_results": {
    "layer_1_pass": null,
    "layer_2_pass": null,
    "layer_3_pass": null,
    "layer_4_pass": null
  },
  "app_health": {
    "vercel_status": "ready",
    "a11y_violations": 0
  },
  "git": {
    "prs_open": 0,
    "prs_merged_24h": 0,
    "prs_closed_24h": 0
  },
  "cost": {
    "api_spend_24h_usd": 0
  },
  "delta_from_previous": {}
}
```

**Trigger logic:** After perception completes, if any significant change is detected (metric improved by >5%, new PR merged, eval status changed), the organism triggers the Reason phase. If nothing changed, it waits for the next scheduled perception.

---

### Phase 2: REASON

The organism decides **what to work on**. This is the highest-leverage decision in the entire system. A bad task selection wastes an entire build cycle. A good one closes a real gap.

#### The Task Selection Algorithm

The reasoning phase implements a curriculum engine inspired by Voyager's automatic curriculum (which selected tasks at the frontier of the agent's capability) combined with SICA's failure-gap analysis (where the meta-agent reviews the archive looking for patterns in failures).

**Step 1: Read perception data**
Load the latest `.metrics/perception-*.json`. Understand current state.

**Step 2: Read the SCHEMA_GAP_ANALYSIS.md**
What tables are still non-conformant? Current state: 86 tables need column additions, 56 need RLS, 1 needs a role enum update, 2 are deprecation candidates. The critical path item is `project_members` role enum mismatch — every RLS policy depends on it.

**Step 3: Read the DEPRECATION_LEDGER.md**
What needs to be deprecated? `bim_markups` and `payment_applications` have no kernel mapping.

**Step 4: Read the quality floor**
What metrics can be improved? Current targets from `.quality-floor.json`:

| Metric | Current Floor | 6-Month Target | Gap |
|---|---|---|---|
| Coverage | 43.2% | 70% | 26.8 pp |
| `as any` count | 1 | 0 | 1 |
| Mock count | 7 | 0 | 7 |
| ESLint warnings | 52 | 0 | 52 |
| E2E pass rate | 70% | 100% | 30 pp |
| Bundle size | 1869 KB | 250 KB | 1619 KB |
| Longest response | 340ms | 200ms | 140ms |

**Step 5: Read eval results**
What tests are currently SKIP that could be activated? Each activated test is a new assertion about system correctness.

**Step 6: Read LEARNINGS.md**
What has been tried before? Critical learnings that constrain future attempts:
- Supabase migration MUST precede component implementation
- Large refactors across 10+ files cause the immune system to reject at Tier 2
- Empty functions with TODO comments score WORSE than no function
- `as any` count grew from ~14 to 27 without gating — must be ratcheted
- RLS policies MUST use `(select auth.uid())` wrapper for 1,571× performance improvement
- `CREATE TABLE IF NOT EXISTS` is mandatory in every migration
- Verification pipeline non-reporting is the single largest scoring bottleneck (75 points forfeited over 3 nights)

**Step 7: Score each candidate task**

Each potential task is scored across four dimensions:

```
Score = (Impact × Feasibility × Novelty) / Risk
```

| Dimension | Weight | How Measured |
|---|---|---|
| **Impact** | High | How much does this close a gap? A table getting full RLS = high. A lint fix = low. |
| **Feasibility** | High | Has a similar task succeeded before? Is it in the skill library? How many files does it touch? |
| **Novelty** | Medium | Has this exact task been attempted before? Penalize re-attempts of failed tasks. |
| **Risk** | Divisor | Could this break existing functionality? Does it touch financial/auth/schema code? |

Scoring matrix for common task types:

| Task Type | Impact | Feasibility | Novelty | Risk | Typical Score |
|---|---|---|---|---|---|
| Add `created_by`/`deleted_at`/`deleted_by` to a table | 3 | 9 (done 80+ times needed) | 2 (repetitive) | 1 | 54 |
| Add RLS policies to an unknown table | 7 | 6 (43 examples exist) | 5 | 3 | 70 |
| Fix `project_members` role enum | 9 | 4 (complex, cascade) | 9 | 7 | 46 |
| Add a new eval test | 5 | 7 | 6 | 1 | 210 |
| Reduce ESLint errors (batch of 10) | 4 | 8 | 3 | 2 | 48 |
| Add test coverage for untested module | 6 | 6 | 5 | 1 | 180 |

**Step 8: Select the top 3 experiments**

The organism selects 3 experiments, biased toward a mix:
- 1 **exploitation** task (highest-scoring known-good task)
- 1 **exploration** task (highest novelty, even if lower score)
- 1 **infrastructure** task (eval coverage, test quality, tooling improvement)

This follows Thompson Sampling principles — maintaining a distribution over task value and sampling from it, rather than always picking the greedy maximum.

**Step 9: Generate EXPERIMENT specs**

For each selected task, the organism writes a precise experiment definition:

```json
{
  "experiment_id": "EXP-2026-04-15-001",
  "title": "Add RLS policies to contracts table",
  "hypothesis": "Adding SELECT/INSERT/UPDATE/DELETE RLS policies to the contracts table will move it from unknown to covered status",
  "target_file": "supabase/migrations/00099_contracts_rls.sql",
  "target_metric": "schema_conformance.rls_confirmed",
  "before_value": 43,
  "expected_after_value": 44,
  "max_files_changed": 2,
  "max_turns": 15,
  "skill_reference": "add-rls-policy-project-scoped",
  "constitutional_review_required": false,
  "learnings_consulted": [
    "ALWAYS use (select auth.uid()) wrapper",
    "ALWAYS wrap policies in DO/EXCEPTION blocks"
  ],
  "abort_conditions": [
    "TypeScript compilation fails",
    "Any existing test fails",
    "More than 2 files modified"
  ]
}
```

**Model selection for reasoning:** Claude Opus. This is the highest-leverage decision in the system — the difference between working on the right thing and wasting a cycle. Opus's superior multi-factor reasoning justifies the cost. Budget: max 2 Opus calls per reasoning cycle.

#### Reasoning Output

The reasoning phase writes `EXPERIMENTS.md` (overwritten each cycle):

```markdown
# EXPERIMENTS — Cycle 2026-04-15-001

## Experiment 1 (Exploitation): Add RLS to contracts table
- Score: 70 (Impact: 7 × Feasibility: 6 × Novelty: 5 / Risk: 3)
- Skill: add-rls-policy-project-scoped (95% historical success)
- ETA: 8 Claude turns
- Status: QUEUED

## Experiment 2 (Exploration): Create kernel-native service layer for RFIs
- Score: 48 (Impact: 8 × Feasibility: 3 × Novelty: 8 / Risk: 4)
- Skill: none (novel task)
- ETA: 15 Claude turns
- Status: QUEUED

## Experiment 3 (Infrastructure): Activate 3 skipped Layer 1 eval tests
- Score: 210 (Impact: 5 × Feasibility: 7 × Novelty: 6 / Risk: 1)
- Skill: activate-eval-test (100% historical success)
- ETA: 5 Claude turns
- Status: QUEUED
```

---

### Phase 3: BUILD

The organism executes the experiment. This is where code gets written.

#### Build Constraints

These constraints are non-negotiable. They exist because the previous v0 engine — which had no constraints — achieved a "98-100% fix rate" while quality scores **declined** across 7 of 11 modules over 9 cycles, costing $32.40 in API spend with nothing to show for it. The lesson (recorded in LEARNINGS.md): "The engine measured task completion, not quality outcomes. Each cycle added code that created new surface area for failures."

| Constraint | Value | Rationale |
|---|---|---|
| One experiment at a time | Always | No blast radius. One failure = one known cause. |
| Max Claude Code turns | 15 | Hard limit prevents infinite loops. SICA's $10/problem cap principle. |
| Isolated branch | Always | Never direct to main. Branch name: `organism/EXP-{id}` |
| Target specificity | One file, one metric | Devin's lesson: ambiguous requirements = failure. Clear target = success. |
| BEFORE measurement | Required | Cannot evaluate improvement without a baseline. |
| Expected AFTER | Required | The hypothesis must be falsifiable. |
| Time limit | 30 minutes | If the experiment hasn't completed in 30 minutes, abort. |

#### Build Execution Flow

```
1. Create branch: organism/EXP-2026-04-15-001
2. Record BEFORE measurements for target metric
3. Load relevant skill from library (if exists)
4. Load relevant learnings from LEARNINGS.md
5. Execute code generation:
   - System prompt includes: experiment spec + skill + learnings + constitutional constraints
   - Claude Sonnet generates code (good enough, cheaper than Opus)
   - Each turn: write code → run relevant checks → adjust
   - Max 15 turns
6. Record AFTER measurements
7. If AFTER > BEFORE on target metric AND no regression on any other metric:
   - Create PR with title: "🧬 EXP-{id}: {title}"
   - PR body includes: experiment spec, BEFORE/AFTER, files changed, turns used
8. If AFTER <= BEFORE or regression detected:
   - Abort. Log failure. Move to next experiment.
```

#### Build Output

A pull request on GitHub with:
- Clear title identifying it as an organism experiment
- Full experiment spec in the PR body
- BEFORE/AFTER metric comparison
- Files changed (should be 1-3)
- Turns used (of 15 max)
- Learnings consulted
- Skill used (if any)

**Model selection for build:** Claude Sonnet. Best code generation quality-to-cost ratio. The research shows Sonnet handles "polishing" tasks (bug fixes, pattern application, test writing, migration creation) at near-Opus quality while being significantly cheaper. Reserve Opus for the reasoning phase where the quality delta justifies the cost.

---

### Phase 4: VERIFY

The organism checks its own work. This is where most autonomous systems fail.

Anthropic's internal research found that out-of-the-box Claude "identifies legitimate issues and then talks itself into deciding they weren't a big deal and approved the work anyway." Self-verification is unreliable. The solution from the research: **combine many weak verifiers** into a strong verification stack.

#### The 9-Gate Verification Hierarchy

Each gate is pass/fail. All must pass. If ANY gate fails, the experiment is rejected.

```
Gate 1: TypeScript Compilation          ──── Does it compile?
    │ PASS
    ▼
Gate 2: ESLint Ratchet                  ──── Did errors decrease or stay same?
    │ PASS                                    (current floor: 1036)
    ▼
Gate 3: Unit Tests                      ──── Do ALL existing tests pass?
    │ PASS
    ▼
Gate 4: Build                           ──── Does `npm run build` succeed?
    │ PASS
    ▼
Gate 5: Eval Layer 1                    ──── Database assertions pass?
    │ PASS                                    (real assertions against DB)
    ▼
Gate 6: Eval Layer 2                    ──── API assertions pass?
    │ PASS
    ▼
Gate 7: Cross-Model Review              ──── GPT-4o reviews Claude's code
    │ PASS                                    (Cross-Model Perplexity check)
    ▼
Gate 8: Metric Measurement              ──── Did target metric improve?
    │ PASS
    ▼
Gate 9: Quality Floor Check             ──── Did ANY metric regress?
    │ PASS
    ▼
    ✅ PR is ready for human review
```

#### Gate Details

**Gates 1-4: Automated Static + Build (fast, cheap, objective)**

These gates run in CI and take < 5 minutes. They catch the majority of issues. No LLM involved.

- **Gate 1 — TypeScript compilation:** `npx tsc --noEmit`. If the type checker finds errors, the experiment introduced a regression. Instant rejection.
- **Gate 2 — ESLint ratchet:** Run `npx eslint --format json`, count errors. If error count > current floor (1036), reject. If error count < floor, the ratchet advances (new floor = lower count).
- **Gate 3 — Unit tests:** `npx vitest run`. Every existing test must still pass. The organism may ADD tests, never break them.
- **Gate 4 — Build:** `npm run build`. If Vite/Rolldown produces a build error, reject. Critical learning: the CI runner uses Linux, and `npm ci` with a Mac-generated lockfile fails on Vite 8+ due to platform-specific rolldown bindings. Always use `rm -f package-lock.json && npm install`.

**Gates 5-6: Eval Harness (real assertions against live state)**

The eval harness is the organism's ground truth. Unlike unit tests (which test code behavior), evals test **domain correctness** — does the database actually conform to the kernel spec?

- **Gate 5 — Eval Layer 1 (Database):** Do tables have the right columns? Are RLS policies present? Are state machine enums correct? These are real queries against the Supabase schema.
- **Gate 6 — Eval Layer 2 (API):** Do API endpoints return the right shapes? Are permissions enforced? Do state transitions work correctly?

**Gate 7: Cross-Model Review (the secret weapon)**

This is the gate that makes the organism smarter than any single model. It implements Cross-Model Perplexity (CMP) — using one model family to verify another.

The research establishes CMP achieves AUROC 0.75 vs 0.59 for within-model entropy. The mechanism: when Claude (generator) produces code and GPT-4o (verifier from a different model family) is "surprised" by it, this is a strong signal the code may be wrong — even if Claude was confident.

Implementation:
1. Extract the diff from the PR
2. Send to GPT-4o with prompt: "Review this code change for correctness, security issues, and adherence to the codebase patterns. Flag any issues you find. Be skeptical — the code was generated by a different AI and may contain confident errors."
3. If GPT-4o flags any CRITICAL or HIGH severity issues → reject
4. If GPT-4o flags only MEDIUM/LOW issues → add as PR comments for human review
5. If GPT-4o approves → pass

The key insight: Claude and GPT-4o have different training data, different architectures, different failure modes. When they agree, confidence is high. When they disagree, something needs human attention.

**Gate 8: Metric Measurement**

Did the experiment actually achieve what it set out to achieve?

Compare BEFORE and AFTER measurements for the target metric specified in the experiment. If the target metric didn't improve (or improved less than expected), the experiment failed its hypothesis, even if it didn't break anything.

Partial credit: if the target metric improved but less than expected, the experiment is logged as PARTIAL_SUCCESS and the PR is still created (the improvement is real, even if smaller than hoped).

**Gate 9: Quality Floor Check**

The final safety net. Read `.quality-floor.json`. Compare every metric in the PR's AFTER state against every floor value:

```
FOR EACH metric IN quality_floor:
  IF metric.direction == "lower_is_better":    # eslint errors, bundle size
    IF after_value > floor_value: REJECT
  IF metric.direction == "higher_is_better":   # coverage, test count
    IF after_value < floor_value: REJECT
```

If ANY floor is violated, the entire experiment is rejected regardless of how much the target metric improved. The ratchet is absolute.

#### Verification Output

The verify phase adds a review comment to the PR:

```markdown
## 🧬 Organism Verification Report

### Gate Results
| Gate | Status | Details |
|---|---|---|
| 1. TypeScript | ✅ PASS | 0 errors |
| 2. ESLint Ratchet | ✅ PASS | 1034 errors (was 1036, floor advanced) |
| 3. Unit Tests | ✅ PASS | 45/45 passing |
| 4. Build | ✅ PASS | Build succeeded, 1852 KB |
| 5. Eval Layer 1 | ✅ PASS | 44/99 tables conformant |
| 6. Eval Layer 2 | ✅ PASS | API assertions passing |
| 7. Cross-Model Review | ✅ PASS | GPT-4o: no critical issues |
| 8. Metric Improvement | ✅ PASS | rls_confirmed: 43 → 44 |
| 9. Quality Floor | ✅ PASS | No regressions detected |

### Metrics Delta
| Metric | Before | After | Change |
|---|---|---|---|
| ESLint errors | 1036 | 1034 | -2 ✅ |
| RLS confirmed | 43 | 44 | +1 ✅ |
| Bundle size | 1869 KB | 1852 KB | -17 KB ✅ |

### Ready for human review.
```

---

### Phase 5: LEARN

The organism updates its memory. This is where compounding intelligence happens.

Every other system in the market — Devin, Copilot Workspace, Cursor — has **amnesia**. Each session starts fresh. They don't remember what they tried last week, what failed, or what patterns they discovered.

The organism remembers everything.

#### What Gets Recorded

After every experiment (pass or fail), the organism records:

**1. Experiment outcome (EVOLUTION_LEDGER.md)**

Append-only. Immutable. Never edited. The full audit trail.

```json
{
  "experiment_id": "EXP-2026-04-15-001",
  "timestamp": "2026-04-15T07:30:00Z",
  "title": "Add RLS policies to contracts table",
  "outcome": "MERGED",
  "pr_number": 147,
  "metrics_before": { "rls_confirmed": 43, "eslint_errors": 1036 },
  "metrics_after": { "rls_confirmed": 44, "eslint_errors": 1034 },
  "files_changed": 1,
  "turns_used": 8,
  "cost_tokens": 12400,
  "cost_usd": 0.18,
  "time_seconds": 420,
  "skill_used": "add-rls-policy-project-scoped",
  "human_intervention": false,
  "human_changes_requested": false,
  "gate_results": {
    "typescript": "pass",
    "eslint_ratchet": "pass",
    "unit_tests": "pass",
    "build": "pass",
    "eval_layer_1": "pass",
    "eval_layer_2": "pass",
    "cross_model_review": "pass",
    "metric_improvement": "pass",
    "quality_floor": "pass"
  }
}
```

**2. Learning extraction (LEARNINGS.md)**

After each experiment, the organism evaluates whether a new learning should be extracted. Learnings are patterns that future cycles should know about. They are appended, never deleted.

For **successful** experiments:
- What pattern was used?
- Was it faster/cheaper than expected? Why?
- Should this become a reusable skill?

For **failed** experiments (critical — prevents re-attempts):
- What exactly failed?
- WHY did it fail? (This is the most important field)
- What should be tried differently next time?
- What should NEVER be tried again?

Example failed learning:
```markdown
<!-- Added 2026-04-15 | Source: EXP-2026-04-15-002 FAILED at Gate 3 -->
- [2026-04-15] LEARNING: Creating a service layer for RFIs requires updating
  the React Query hooks to use the new service, not just creating the service file.
  The experiment added `src/services/rfi.service.ts` but didn't update
  `src/hooks/useRFIs.ts`, causing 3 existing tests to fail because they
  imported from the hook which still pointed to the old direct Supabase calls.
  EVIDENCE: Gate 3 failure. 3 tests in `useRFIs.test.ts` broke.
  ACTION: Next attempt must update both the service file AND all hooks that
  consume it. Check with `grep -r 'from.*useRFIs' src/` before starting.
```

**3. Skill library update**

After each successful experiment, evaluate whether the pattern should be extracted as a reusable skill. Criteria:
- Has a similar pattern succeeded 2+ times?
- Is the pattern generalizable (not specific to one table/entity)?
- Would having this skill save > 3 Claude turns on future tasks?

If yes, create or update a skill entry (see Section 5).

**4. Quality floor ratchet**

If the experiment improved any metric beyond its current floor, update `.quality-floor.json`:
```json
{
  "eslintErrors": 1034,  // was 1036, ratcheted down
  "_updated": "2026-04-15T07:30:00Z",
  "_updatedBy": "organism EXP-2026-04-15-001"
}
```

The ratchet only moves in the direction of improvement. It can never go backward.

**5. World model update**

The organism maintains a compressed understanding of the codebase in `.agent/world-model.json`. This is not a full copy of the code — it's a semantic summary that gets updated after each cycle:

```json
{
  "last_updated": "2026-04-15T07:30:00Z",
  "codebase_summary": {
    "total_files": 340,
    "total_lines": 52000,
    "architecture": "React + Supabase + Vite + XState",
    "styling": "Inline styles with theme tokens only",
    "state_management": "Zustand (co-located with pages) + React Query",
    "testing": "Vitest + Playwright",
    "deployment": "Vercel + Supabase hosted"
  },
  "hot_zones": [
    "src/hooks/ — most frequently modified, most test coverage",
    "supabase/migrations/ — 48 files, must check for duplicates before adding"
  ],
  "cold_zones": [
    "src/pages/BIM/ — three.js integration, 200KB bundle, rarely touched"
  ],
  "known_debt": [
    "1036 ESLint errors (many are fixable auto-fix patterns)",
    "56 tables with unknown RLS status",
    "project_members role enum mismatch blocks downstream RLS work"
  ],
  "recent_changes": []
}
```

#### Learning Output

The learn phase produces:
- Updated `EVOLUTION_LEDGER.md` (always)
- Updated `LEARNINGS.md` (when a new pattern is discovered)
- Updated `.skills/` directory (when a new skill is extracted)
- Updated `.quality-floor.json` (when a metric improved)
- Updated `.agent/world-model.json` (always)
- Updated `.metrics/` directory with experiment data (always)

**Model selection for learning:** GPT-4o-mini for compression and summarization. This is cheap, fast, high-volume work — no need for Opus or even Sonnet. The learning extraction prompt is simple: "Given this experiment outcome, extract any learnings that would help future experiments."

---

## 3. The Constitutional Layer

The organism operates under a constitution — a set of constraints that cannot be overridden by the organism itself. These are inspired by Anthropic's Constitutional AI, which demonstrates that giving systems *reasons* rather than just rules produces more robust behavior.

Anthropic's 4-tier priority hierarchy, adapted for the organism:
1. **Broadly safe** — never undermine human oversight mechanisms
2. **Broadly ethical** — never do harm to the product or its users
3. **Compliant with constraints** — follow operational rules
4. **Genuinely helpful** — maximize improvement within the above constraints

### 3.1 Absolute Prohibitions (Hardcoded)

These are enforced at multiple levels: in system prompts (reasoning), in CI checks (blocking), in branch protection (infrastructure), and in the merge policy (final gate). The organism MUST NEVER:

| # | Prohibition | WHY (the reason, not just the rule) | Enforcement |
|---|---|---|---|
| 1 | Push directly to main | Main must always be deployable. A broken main breaks the product for users. | Branch protection rules |
| 2 | Merge its own PRs | Human judgment is the final safety net. The organism can propose, never decide. | GitHub required reviewers |
| 3 | Modify production database schema without human approval | Schema changes are irreversible in practice. A bad migration can corrupt data for every user. | CI check + required label |
| 4 | Touch billing/payment/financial code without human approval | Financial errors create legal liability. Integer cents only. AIA G702/G703 compliance is non-negotiable. | CODEOWNERS on `/src/pages/Budget/`, `/src/pages/PayApplications/`, `schedule_of_values`, `retainage_ledger` |
| 5 | Remove test coverage | Tests are the verification oracle. Removing tests removes the organism's ability to verify its own work. | CI coverage gate |
| 6 | Increase the ESLint error count | The ratchet only moves forward. More errors = more technical debt = slower future cycles. | `.quality-floor.json` gate |
| 7 | Increase the TypeScript error count | Type safety is the organism's immune system. Type errors are bugs that haven't been found yet. | `tsc --noEmit` gate |
| 8 | Add mock data to production code | Mock data in production creates false confidence. Users see fake data and make real decisions. | CI grep check |
| 9 | Modify GOVERNANCE.md, CODEOWNERS, or branch protection | These are the organism's constraints. If the organism can modify its own constraints, the constraints are meaningless. | CODEOWNERS protection |
| 10 | Disable CI checks or eval gates | Disabling verification is equivalent to disabling the immune system. The organism would lose the ability to distinguish improvement from regression. | Protected workflow files |
| 11 | Store secrets or credentials in code | Leaked credentials compromise every user. Secrets belong in environment variables, never in version control. | CI secret scanning |
| 12 | Modify its own constitutional constraints | The constitution is set by humans. An organism that can modify its own safety constraints is not safe. | This file is CODEOWNERS-protected |

### 3.2 Soft Priorities (Learned, Adjustable)

These priorities guide task selection in the Reason phase. They are ordered by current strategic importance and can be re-prioritized by the human operator.

**Current priority order:**

1. **Kernel conformance** — Close the gap between current schema and kernel spec. 86 tables need column additions, 56 need RLS. This is the foundation everything else depends on.

2. **Security improvements** — RLS policies, auth, permissions. 56 tables with unknown RLS status means 56 tables potentially exposed via the Supabase REST API to any authenticated user. This is the highest security risk.

3. **Eval coverage** — Turn skipped tests into real assertions. Every activated test is a new ground-truth signal the organism can verify against. More eval coverage = better verification = safer autonomy.

4. **Code quality** — Reduce ESLint errors (1036 → target: 0), increase test coverage (43.2% → target: 70%), eliminate `as any` casts (1 → 0), eliminate mocks (7 → 0).

5. **Performance** — Reduce bundle size (1869 KB → target: 250 KB), improve response times (340ms → target: 200ms). The three.js/react-three-fiber bundle alone is ~200KB and must be code split.

6. **Approved roadmap** — Sub portal, migration tool, certified payroll. These are human-specified features that advance the business. The organism works on these when directed.

### 3.3 Constitutional Enforcement Architecture

The constitution is enforced at four levels (defense in depth):

```
Level 1: REASONING
  System prompt includes full constitutional text + reasons
  Claude Opus considers constraints during task selection
  Constitutional violations rejected before code is written

Level 2: BLOCKING
  CI checks enforce every prohibition automatically
  .quality-floor.json gate rejects regressions
  File-level CODEOWNERS blocks changes to protected files

Level 3: DETECTION
  Cross-model review (Gate 7) catches subtle violations
  GPT-4o specifically prompted to check constitutional compliance
  Separate security scan for auth/financial code changes

Level 4: LOCKING
  Branch protection prevents direct pushes to main
  Required reviewers prevent self-merging
  GitHub Actions workflow files are protected from modification
```

If Level 1 misses a violation, Level 2 catches it. If Level 2 misses it, Level 3 catches it. If Level 3 misses it, Level 4 catches it. A violation must bypass all four levels to reach production. This is the Swiss cheese model of safety — every layer has holes, but the holes don't align.

---

## 4. Multi-Model Brain

The organism uses multiple AI models from different families. This is not a luxury — it is a safety requirement. The research on Cross-Model Perplexity establishes that using one model family to verify another catches "confidently wrong" errors that self-verification misses (AUROC 0.75 vs 0.59).

### 4.1 Model Routing Table

| Phase | Task | Model | Why This Model | Cost Profile |
|---|---|---|---|---|
| **Perceive** | Metric collection | Scripts + REST API | No LLM needed — pure measurement. Fast, free, deterministic. | $0 |
| **Reason** | Strategic task selection | Claude Opus | Best at complex multi-factor reasoning with long context. The highest-leverage decision — worth the cost. | $$$ (max 2 calls/cycle) |
| **Reason** | Task scoring | GPT-4o-mini | Fast structured JSON output for scoring 10-20 candidate tasks. Cheap enough to run on every candidate. | $ |
| **Build** | Code generation | Claude Sonnet | Best code generation quality-to-cost ratio. Handles single-file changes and pattern application extremely well. | $$ (max 15 turns/experiment) |
| **Verify** | Cross-model review | GPT-4o | Different model family than the generator. Catches confidently-wrong errors Claude misses. | $$ (max 3 calls/day) |
| **Verify** | Security scan | Claude Sonnet | Strong at identifying security issues, especially in auth/RLS code. Already understands the codebase context. | $$ (1 call per experiment) |
| **Learn** | Compression + extraction | GPT-4o-mini | Cheap, fast summarization. Learning extraction is high-volume, low-complexity work. | $ |
| **Explore** | Competitor research | Perplexity | Real-time web search for what Procore, Autodesk, Fieldwire shipped. Grounded in current data. | $ (max 10/week) |
| **Explore** | Regulation tracking | Perplexity | Construction codes, OSHA updates, AIA form changes. The organism must know the regulatory environment. | $ (max 10/week) |
| **Explore** | Visual regression | Gemini | Screenshot analysis of the live app. Compare current to previous screenshots. Detect UI regressions. | $ (max 5/week) |
| **Explore** | BIM/drawing analysis | Gemini | Multimodal vision for analyzing construction drawings and 3D models. | $ (as needed) |

### 4.2 Cross-Model Verification Protocol

The key mechanism that makes the multi-model brain more than the sum of its parts:

```
1. Claude Sonnet generates code (BUILD phase)
2. The diff is extracted
3. GPT-4o receives the diff + relevant context + a skeptical prompt:

   "You are reviewing code generated by a different AI model.
    That model may have made confident errors — mistakes it
    believes are correct but are not.

    Review for:
    - Logical errors (especially in SQL policies and state machines)
    - Security issues (RLS bypasses, auth gaps, data leakage)
    - Pattern violations (does this match how the codebase does things?)
    - Missing edge cases (NULL handling, empty arrays, timezone issues)
    - Constitutional violations (see attached constraints)

    Be skeptical. The generator was confident. Your job is to
    find what it missed."

4. GPT-4o returns a structured review:
   {
     "critical_issues": [],      // BLOCK — experiment rejected
     "high_issues": [],          // BLOCK — experiment rejected
     "medium_issues": [],        // WARNING — add to PR comments
     "low_issues": [],           // INFO — add to PR comments
     "approval": true/false
   }

5. If GPT-4o and Claude Sonnet AGREE (GPT-4o approves):
   → High confidence. Proceed to Gate 8.

6. If GPT-4o and Claude Sonnet DISAGREE (GPT-4o flags issues):
   → Low confidence. Reject experiment. Log the disagreement.
   → The disagreement itself is a learning opportunity.
```

### 4.3 Cost Controls

The multi-model approach requires strict cost management. Without limits, the organism could burn through API budget exploring low-value tasks.

| Model | Daily Budget | Per-Experiment Budget | Per-Cycle Budget |
|---|---|---|---|
| Claude Opus | 2 reasoning calls | N/A (reasoning only) | 2 calls |
| Claude Sonnet | 45 turns total (3 experiments × 15 turns) | 15 turns | 45 turns |
| GPT-4o | 3 review calls | 1 call | 3 calls |
| GPT-4o-mini | 20 calls | 2 calls | 20 calls |
| Perplexity | 10 searches/week | N/A (exploration only) | 2 searches |
| Gemini | 5 vision calls/week | N/A (exploration only) | 1 call |

**Total daily API budget:** Configurable ceiling. Default: $15/day. At current model pricing, this supports approximately 3 full experiment cycles per day.

**Cost tracking:** Every API call logs its token count and cost to `.metrics/cost-{date}.json`. The organism monitors cumulative daily spend and pauses builds if the ceiling is approached.

---

## 5. The Skill Library

The organism accumulates reusable capabilities over time. This is directly from Voyager's architecture — which demonstrated a 10-30% improvement from skill retrieval on ALFWorld, WebShop, and ScienceWorld benchmarks.

### 5.1 What Is a Skill?

A skill is a verified, parameterized code pattern that the organism has successfully used before. Each skill has:

```json
{
  "skill_id": "add-rls-policy-project-scoped",
  "name": "Add RLS Policy for Project-Scoped Table",
  "description": "Adds SELECT/INSERT/UPDATE/DELETE RLS policies to a project-scoped table, using the (select auth.uid()) wrapper for performance and DO/EXCEPTION blocks for idempotency.",
  "trigger_conditions": [
    "Table exists in schema gap analysis with rls_status: unknown",
    "Table scope_type is 'project'",
    "Table has project_id column"
  ],
  "contraindications": [
    "Table is system-scoped (no user-level access)",
    "Table is a join table with no direct user access",
    "Table touches financial data (requires human approval first)"
  ],
  "files_typically_modified": [
    "supabase/migrations/NEXT_NUMBER_{table}_rls.sql"
  ],
  "template": "-- see .skills/templates/project-rls.sql.template",
  "parameters": {
    "table_name": "string — the target table",
    "project_fk": "string — column name referencing projects (default: project_id)",
    "additional_conditions": "string[] — extra WHERE clauses for policies"
  },
  "estimated_turns": 5,
  "success_rate": 0.95,
  "times_used": 15,
  "last_used": "2026-04-14",
  "dependencies": [
    "Table must have RLS enabled (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)",
    "is_project_member() function must exist"
  ],
  "learnings_associated": [
    "ALWAYS use (select auth.uid()) wrapper — 1,571x performance improvement",
    "ALWAYS wrap policies in DO/EXCEPTION blocks for idempotency",
    "ALWAYS check if policy name already exists before creating"
  ]
}
```

### 5.2 Initial Skill Library

Seeded from patterns observed in the existing codebase and schema gap analysis:

| Skill ID | Name | Times Needed | Success Rate | Est. Turns |
|---|---|---|---|---|
| `add-provenance-columns` | Add `created_by`, `deleted_at`, `deleted_by` to a table | ~86 | 95% (estimated) | 3 |
| `add-rls-policy-project-scoped` | Add RLS policies for project-scoped table | ~40 | 95% (estimated) | 5 |
| `add-rls-policy-org-scoped` | Add RLS policies for org-scoped table | ~8 | 90% (estimated) | 5 |
| `add-rls-policy-user-scoped` | Add RLS policies for user-scoped table | ~3 | 95% (estimated) | 4 |
| `widen-check-constraint` | Widen a CHECK constraint (add new enum values) | 2+ | 100% (estimated) | 3 |
| `add-audit-trigger` | Add `updated_at` auto-set trigger to a table | ~80 | 100% (estimated) | 2 |
| `activate-eval-test` | Turn a SKIP eval test into a real assertion | many | 90% (estimated) | 5 |
| `add-test-coverage` | Add unit tests for an untested module | many | 80% (estimated) | 10 |
| `fix-eslint-batch` | Fix a batch of 5-10 ESLint errors in a single file | many | 90% (estimated) | 4 |
| `create-kernel-service` | Create a kernel-native service layer for an entity | ~20 | 60% (estimated) | 15 |

### 5.3 Skill Growth Mechanism

After each successful experiment:

```
1. Was a new pattern used that isn't in the skill library?
2. Has a similar pattern succeeded 2+ times?
3. Is the pattern generalizable (works for multiple tables/entities)?
4. Would having this skill save > 3 Claude turns on future tasks?

If ALL true:
  → Extract the pattern as a new skill
  → Parameterize variable parts (table name, column names, etc.)
  → Add metadata (trigger conditions, contraindications, dependencies)
  → Store in .skills/ directory

If a similar skill EXISTS:
  → Update success rate based on latest outcome
  → Update times_used counter
  → Append any new learnings
```

### 5.4 Skill Retrieval at Build Time

When the Build phase starts an experiment:

```
1. Read the experiment spec
2. Query the skill library for matching trigger conditions
3. If a skill matches with success_rate > 80%:
   → Include the skill template in the system prompt
   → Include associated learnings
   → Set expected turns = skill.estimated_turns
4. If no skill matches:
   → This is a novel task. Set expected turns = 15 (max).
   → After completion (success or failure), evaluate for skill extraction.
```

---

## 6. Population Diversity (MAP-Elites)

From the Darwin Gödel Machine research: maintaining a **population of diverse approaches** outperforms optimizing a single best approach. DGM demonstrated that both self-improvement AND open-ended exploration are necessary — removing either one significantly degrades performance.

### 6.1 When to Use Population Diversity

Population diversity is triggered for **complex tasks only** — tasks where the Reason phase assigns:
- Feasibility < 5 (uncertain how to approach)
- Impact > 7 (high value if solved)
- No matching skill in the library (novel territory)

For routine tasks (add RLS policy, add provenance columns), the skill library provides a proven pattern. Population diversity would be wasteful.

For complex tasks (rebuild submittal workflow, create service layer, optimize critical path calculation), multiple approaches are generated and evaluated.

### 6.2 The Population Protocol

```
1. Reason phase identifies a complex task
2. Instead of generating 1 experiment, generate 3-5 APPROACHES:
   - Approach A: Conservative (minimal changes, follow existing patterns)
   - Approach B: Refactoring (restructure, but keep same interfaces)
   - Approach C: Novel (try a completely different pattern)
   - Approaches D-E: LLM-generated variations

3. Each approach gets its own branch:
   - organism/EXP-{id}-approach-a
   - organism/EXP-{id}-approach-b
   - organism/EXP-{id}-approach-c

4. Each approach runs through the full Build → Verify pipeline

5. Evaluation against the 9-gate verification:
   - All gates must pass (minimum bar)
   - Among passing approaches, rank by:
     a. Target metric improvement (primary)
     b. Code complexity (lower is better)
     c. Test coverage of changed code (higher is better)
     d. Performance impact (lower latency is better)
     e. Readability (human review estimate)

6. Keep the BEST approach → create PR
7. ARCHIVE the alternatives:
   - Store full code + evaluation results in .archive/
   - These become potential starting points for future evolution
   - The DGM pattern: archived solutions are "stepping stones"
```

### 6.3 Behavioral Dimensions

The organism tracks diversity along four axes (MAP-Elites behavioral descriptors):

| Dimension | Axis 1 Value | Axis 2 Value | Why Track |
|---|---|---|---|
| **Code Complexity** | Low (< 20 lines changed) | High (> 100 lines) | Prevent convergence to either trivial or over-complex solutions |
| **Test Coverage** | Low (tests existing code only) | High (tests new + edge cases) | Ensure solutions are actually verified, not just "compiling" |
| **Performance** | Neutral (no perf change) | Optimized (measurably faster) | Some solutions trade readability for speed — track both |
| **Pattern** | Follow existing conventions | Introduce new patterns | Balance consistency with innovation |

### 6.4 Preventing Mode Collapse

Mode collapse = the organism finds one way to do things and repeats it forever. Prevention mechanisms:

1. **Explicit novelty bonus** in task scoring: solutions that are behaviorally different from anything in the archive get a bonus, even if their immediate quality is lower.

2. **Stagnation detection:** If the improvement rate drops below 1 metric improvement per 5 cycles, force the organism into exploration mode (see Section 7).

3. **Diverse model prompting:** For population diversity, use different models for different approaches. Approach A with Claude Sonnet, Approach B with GPT-4o, Approach C with Gemini. Different model architectures naturally produce different solutions.

4. **Periodic random exploration:** 1 in every 10 cycles, the organism must attempt a task it has never tried before, even if the score is low.

---

## 7. The Exploration Engine

The organism needs to discover new opportunities, not just execute known tasks. Without exploration, it converges to a local optimum and stagnates.

### 7.1 Exploration Sources

| Source | Frequency | What It Discovers | Model |
|---|---|---|---|
| **Schema gap analysis** | Every cycle | Known backlog of kernel non-conformance. 94 of 99 tables have at least one gap. | None (data read) |
| **Eval coverage gaps** | Every cycle | Tests that are SKIP that could be activated. Each one is a new verification signal. | None (data read) |
| **Competitor research** | Weekly | What Procore, Autodesk, Fieldwire, PlanGrid shipped this week. New features to match or leapfrog. | Perplexity |
| **Construction domain research** | Weekly | New regulations, building code changes, OSHA updates, AIA form revisions. The construction industry moves slowly but when it moves, compliance is non-negotiable. | Perplexity |
| **Visual regression** | Weekly | Screenshots of the live app compared to previous screenshots. Detect unintended UI changes, broken layouts, rendering issues. | Gemini |
| **Performance monitoring** | Every cycle | Bundle size trends, response time trends, error rate trends. Catch regressions before they compound. | None (data read) |
| **Curiosity-driven** | Periodic (1 in 10 cycles) | Random exploration of an unexplored area of the codebase. The organism picks a file or module it hasn't analyzed and looks for improvement opportunities. | Claude Sonnet |
| **Codebase archaeology** | Monthly | Identify dead code, unused imports, unreachable branches, test files without assertions. The codebase accumulates entropy — the organism should clean it. | Claude Sonnet |

### 7.2 Thompson Sampling for Exploration-Exploitation Balance

The organism uses Thompson Sampling to balance exploitation (working on known high-value tasks) with exploration (trying new areas).

For each task category, maintain a Beta distribution representing the organism's belief about its success probability:

```
category_belief = {
  "add_rls_policy": Beta(α=15, β=1),       // 15 successes, 1 failure → very confident
  "add_provenance_columns": Beta(α=10, β=0), // 10 successes, 0 failures → very confident
  "create_service_layer": Beta(α=1, β=2),   // 1 success, 2 failures → uncertain
  "fix_eslint_batch": Beta(α=8, β=2),       // 8 successes, 2 failures → fairly confident
  "optimize_bundle": Beta(α=0, β=0),         // never tried → maximum uncertainty
}
```

Task selection:
1. For each candidate task, sample from its category's Beta distribution
2. Multiply the sample by the task's impact score
3. Select the task with the highest product

This naturally:
- **Exploits** categories with high success rates (tight Beta near 1.0)
- **Explores** categories with high uncertainty (wide Beta distribution)
- **Avoids** categories with consistent failure (tight Beta near 0.0)
- Explores untried categories (uniform Beta) with some probability

### 7.3 Stagnation Detection and Forced Exploration

If the organism detects stagnation — defined as:
- Fewer than 1 metric improvement per 5 consecutive cycles, OR
- The same task type has been attempted 3 times without progress, OR
- No new skill has been extracted in 2 weeks

...then the organism enters **Forced Exploration Mode:**

1. Suspend all exploitation tasks for 1 cycle
2. Run a Perplexity competitor scan
3. Run a Gemini visual regression check
4. Analyze the 3 least-explored modules in the codebase
5. Generate 5 novel experiment proposals (scored by novelty alone, not feasibility)
6. Execute the most novel experiment that passes basic feasibility checks

The goal: break out of local optima. Sometimes the best path forward requires going through an apparently worse intermediate state.

### 7.4 Exploration Output

The exploration engine writes `.exploration/scan-{date}.json`:

```json
{
  "scan_date": "2026-04-20",
  "competitor_findings": [
    {
      "competitor": "Procore",
      "feature": "AI-powered daily log voice transcription",
      "relevance": "HIGH — SiteSync has voice capture in FieldCapture but no transcription",
      "action": "Add to exploration proposals for next Reason cycle"
    }
  ],
  "regulatory_findings": [
    {
      "topic": "OSHA electronic recordkeeping rule update",
      "impact": "MEDIUM — may require changes to incident reporting workflow",
      "action": "Flag for human review"
    }
  ],
  "visual_regression": {
    "screenshots_compared": 12,
    "regressions_detected": 0,
    "notes": "Dashboard layout stable. No unintended changes."
  },
  "codebase_opportunities": [
    {
      "module": "src/pages/Closeout/",
      "observation": "CloseoutItems page has 0% test coverage and 14 ESLint errors",
      "impact": "MEDIUM",
      "feasibility": "HIGH"
    }
  ]
}
```

---

## 8. Workflow Architecture

The organism's autonomous behavior is implemented as GitHub Actions workflows. Each phase of the core loop maps to a workflow file.

### 8.1 Workflow Overview

```
organism-perceive.yml   → Runs every 6 hours (or on demand)
        │
        ▼ (triggers if changes detected)
organism-reason.yml     → Runs after perceive (or on demand)
        │
        ▼ (triggers for top experiment)
organism-build.yml      → Runs after reason (or on demand)
        │
        ▼ (triggers on PR creation)
organism-verify.yml     → Runs on every organism PR
        │
        ▼ (triggers after PR merged/closed)
organism-learn.yml      → Runs after PR resolution
        │
organism-explore.yml    → Runs weekly (or on stagnation)
```

### 8.2 organism-perceive.yml

**Trigger:** Cron schedule (every 6 hours: `0 */6 * * *`) + manual dispatch

**What it does:**
1. Check out repository
2. Run all metric collection scripts:
   - `npx tsc --noEmit 2>&1 | grep -c error`
   - `npx eslint --format json src/ | jq '.[] | .errorCount' | paste -sd+ | bc`
   - `npx vitest run --reporter=json --coverage`
   - `npm run build 2>&1 | grep -oP 'Total size: \K[0-9]+'`
   - Parse SCHEMA_GAP_ANALYSIS.md for conformance counts
   - Query GitHub API for open PRs, recent merges
   - Query Vercel API for deployment status
3. Write perception snapshot to `.metrics/perception-{ISO_DATE}.json`
4. Compare to previous perception snapshot
5. If significant delta detected:
   - Trigger `organism-reason.yml` via `workflow_dispatch`
6. Commit perception data to `organism/perception-{date}` branch
7. Auto-merge perception data (data-only, no code changes)

**Environment variables:**
- `GITHUB_TOKEN` — for API access
- `VERCEL_TOKEN` — for deployment status
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — for eval layer queries

**Estimated runtime:** 3-5 minutes
**Cost:** $0 (no LLM calls)

### 8.3 organism-reason.yml

**Trigger:** Workflow dispatch from perceive, or manual dispatch

**What it does:**
1. Load latest perception data from `.metrics/`
2. Load SCHEMA_GAP_ANALYSIS.md, DEPRECATION_LEDGER.md, LEARNINGS.md
3. Load quality floor from `.quality-floor.json`
4. Load skill library from `.skills/`
5. Load evolution ledger (recent 50 entries) from EVOLUTION_LEDGER.md
6. Send all context to Claude Opus with the reasoning prompt:

```
You are the strategic brain of an autonomous software improvement system
for a construction PM platform.

Given:
- Current perception data (metrics, schema conformance, eval results)
- The schema gap analysis (what's wrong)
- The quality floor (what metrics can improve)
- The skill library (what you know how to do)
- The evolution ledger (what was tried before, what failed and why)
- The learnings (patterns and anti-patterns)

Generate exactly 3 ranked experiments:
1. One EXPLOITATION experiment (highest-scoring known-good task)
2. One EXPLORATION experiment (highest novelty, uncertain outcome)
3. One INFRASTRUCTURE experiment (eval coverage, test quality, tooling)

For each experiment, provide the full experiment spec JSON.
```

7. Write experiments to `EXPERIMENTS.md`
8. Trigger `organism-build.yml` for the top experiment

**Cost:** 2 Claude Opus calls (max), 2-5 GPT-4o-mini calls for scoring
**Estimated runtime:** 2-4 minutes

### 8.4 organism-build.yml

**Trigger:** Workflow dispatch from reason, or manual dispatch with experiment ID

**What it does:**
1. Load experiment spec from EXPERIMENTS.md
2. Create isolated branch: `organism/EXP-{id}`
3. Record BEFORE measurements for all metrics
4. Load relevant skill from `.skills/` (if applicable)
5. Load relevant learnings from LEARNINGS.md
6. Construct the build system prompt:

```
You are a code generator for SiteSync PM, a construction PM platform.

EXPERIMENT: {experiment_spec}
SKILL: {skill_template_if_applicable}
LEARNINGS: {relevant_learnings}
CONSTITUTIONAL CONSTRAINTS: {constraints}

Execute this experiment. Constraints:
- Modify only the files specified (max 3 files)
- Follow existing codebase patterns exactly
- Include comments explaining non-obvious decisions
- Do NOT add TODO comments or stub functions
- Do NOT use 'as any' casts
- Do NOT use Framer Motion animations
- For migrations: use IF NOT EXISTS, DO/EXCEPTION blocks
- For RLS: use (select auth.uid()) wrapper
- Maximum 15 turns
```

7. Execute with Claude Sonnet (up to 15 turns)
8. Record AFTER measurements for all metrics
9. Compare BEFORE and AFTER:
   - If target metric improved AND no regressions: create PR
   - If target metric didn't improve OR regressions detected: abort, log failure
10. If creating PR:
    - Title: `🧬 EXP-{id}: {title}`
    - Body: experiment spec + BEFORE/AFTER + files changed + turns used
    - Labels: `organism`, `automated`, risk-level label

**Cost:** Up to 15 Claude Sonnet turns per experiment
**Estimated runtime:** 5-20 minutes per experiment

### 8.5 organism-verify.yml

**Trigger:** Pull request creation with `organism` label

**What it does:**
1. Run Gate 1: TypeScript compilation (`npx tsc --noEmit`)
2. Run Gate 2: ESLint ratchet (count errors, compare to floor)
3. Run Gate 3: Unit tests (`npx vitest run`)
4. Run Gate 4: Build (`npm run build`)
5. Run Gate 5: Eval Layer 1 (database assertions)
6. Run Gate 6: Eval Layer 2 (API assertions)
7. Run Gate 7: Cross-model review
   - Extract diff from PR
   - Send to GPT-4o with skeptical review prompt
   - Parse structured review response
8. Run Gate 8: Metric measurement (compare BEFORE/AFTER from PR body)
9. Run Gate 9: Quality floor check (compare all metrics to `.quality-floor.json`)
10. Post verification report as PR comment
11. If ALL gates pass:
    - Add `verified` label
    - Add comment: "Ready for human review"
12. If ANY gate fails:
    - Add `failed` label
    - Add comment with failure details
    - Close PR with failure reason

**Cost:** 1 GPT-4o call (cross-model review), 1 Claude Sonnet call (security scan if applicable)
**Estimated runtime:** 5-10 minutes

### 8.6 organism-learn.yml

**Trigger:** Pull request merged or closed with `organism` label

**What it does:**
1. Determine outcome: MERGED, CLOSED_FAILED, or CLOSED_SUPERSEDED
2. Load experiment spec from PR body
3. If MERGED:
   a. Append success entry to EVOLUTION_LEDGER.md
   b. Evaluate for learning extraction:
      - Was a new pattern used? → Extract learning
      - Was it faster than expected? → Update skill estimated_turns
      - Should this become a skill? → Check extraction criteria
   c. Update skill library:
      - If skill was used: increment times_used, update success_rate
      - If new skill criteria met: create new skill entry
   d. Update quality floor if any metric improved
   e. Update world model
4. If CLOSED_FAILED:
   a. Append failure entry to EVOLUTION_LEDGER.md
   b. Extract failure learning (critical — prevents re-attempts):
      - What exactly failed?
      - WHY did it fail?
      - What should be tried differently?
   c. Update skill library if skill was used:
      - Decrement success_rate
      - Add failure learning to skill's `learnings_associated`
   d. Update world model with failure context
5. Commit all updates to `organism/learn-{date}` branch
6. Auto-merge learning data

**Cost:** 2-3 GPT-4o-mini calls for learning extraction
**Estimated runtime:** 1-3 minutes

### 8.7 organism-explore.yml

**Trigger:** Weekly cron (`0 9 * * 1` — Monday 9 AM) + manual dispatch + stagnation trigger

**What it does:**
1. **Competitor scan** (Perplexity):
   - "What new features did Procore release this week?"
   - "What new features did Autodesk Construction Cloud release this week?"
   - "Construction PM software competitive landscape 2026"
2. **Regulatory scan** (Perplexity):
   - "New OSHA construction safety regulations 2026"
   - "AIA contract document updates 2026"
   - "Construction lien law changes by state 2026"
3. **Visual regression** (Gemini):
   - Screenshot each major page of the live app
   - Compare to previous week's screenshots
   - Flag any unintended visual changes
4. **Codebase analysis** (Claude Sonnet):
   - Identify the 3 modules with lowest test coverage
   - Identify the 3 files with most ESLint errors
   - Identify dead code and unused exports
5. Write exploration report to `.exploration/scan-{date}.json`
6. Generate 3-5 exploration proposals for the next Reason cycle
7. Commit exploration data

**Cost:** 4-6 Perplexity calls, 1-3 Gemini calls, 1-2 Claude Sonnet calls
**Estimated runtime:** 10-15 minutes

---

## 9. Safety and Circuit Breakers

The organism must be safe. Not "probably safe" or "safe most of the time" — **categorically safe**. Every failure mode must result in a safe state (pause + alert), never an unsafe state (corrupt data, broken production, unauthorized changes).

### 9.1 Circuit Breakers

Automatic stops that halt the organism when something goes wrong.

| Circuit Breaker | Trigger | Action | Recovery |
|---|---|---|---|
| **Consecutive failure limit** | 3 consecutive failures in the same task category | Skip that category for 24 hours | Automatic after 24h cooldown |
| **Quality floor regression** | Any metric regresses past its floor on main branch | HALT ALL builds, alert human | Human must investigate and reset |
| **PR queue overflow** | 5+ organism PRs open without human review | Pause build workflow | Resume when queue drops below 3 |
| **Cost ceiling** | Daily API spend exceeds configured budget ($15 default) | Pause all LLM calls until next day | Automatic at midnight UTC |
| **Eval gate failure** | Eval gate starts failing on main (not on a PR branch) | HALT ALL builds, alert human | Human must fix main branch |
| **Build failure on main** | `npm run build` fails on main branch | HALT ALL builds, alert human | Human must fix main branch |
| **Cross-model disagreement rate** | GPT-4o rejects > 50% of Claude's code in a 24h window | Pause builds, alert human | Human reviews the disagreement pattern |
| **Experiment timeout** | A single experiment exceeds 30 minutes | Kill the experiment, log timeout | Automatic — next experiment proceeds |
| **Infinite loop detection** | The same experiment (same title + same approach) is attempted 3+ times | Blacklist that experiment for 7 days | Automatic after 7d cooldown |

### 9.2 Alert Escalation

| Severity | Examples | Alert Channel | Response Time |
|---|---|---|---|
| **CRITICAL** | Quality floor regression on main, eval gate failure on main | GitHub Issue (auto-created) + email + Slack | Human must respond within 4 hours |
| **HIGH** | 3 consecutive failures, cross-model disagreement spike | GitHub Issue (auto-created) + Slack | Human reviews within 24 hours |
| **MEDIUM** | PR queue overflow, cost ceiling reached | Slack notification | Human reviews within 48 hours |
| **LOW** | Stagnation detected, category cooldown activated | PR comment on next experiment | Informational, no response required |

### 9.3 Cost Controls (Detailed)

| Resource | Limit | Period | Enforcement |
|---|---|---|---|
| Claude Opus reasoning calls | 2 | Per cycle | Counter in workflow state |
| Claude Sonnet build turns | 15 | Per experiment | Turn counter in build loop |
| Claude Sonnet total turns | 45 | Per day | Daily counter in `.metrics/` |
| GPT-4o review calls | 3 | Per day | Daily counter |
| GPT-4o-mini calls | 20 | Per day | Daily counter |
| Perplexity searches | 10 | Per week | Weekly counter |
| Gemini vision calls | 5 | Per week | Weekly counter |
| Total API spend | $15 | Per day | Cumulative cost tracking |
| Total API spend | $80 | Per week | Cumulative cost tracking |
| Total API spend | $300 | Per month | Cumulative cost tracking |

If any limit is hit, the organism pauses the relevant phase and logs the limit event. It does NOT try to work around the limit or find alternative API calls.

### 9.4 Human Touchpoints

These actions ALWAYS require explicit human approval, regardless of the organism's maturity level:

| Action | Why | Approval Mechanism |
|---|---|---|
| Merging any PR to main | Human is the final safety net | GitHub required reviewer |
| Schema migrations touching financial tables | Legal liability, data integrity | CODEOWNERS + `requires-financial-review` label |
| Changes to auth/permissions/RLS | Security boundary modifications | CODEOWNERS + `requires-security-review` label |
| Changes to constitutional constraints | The organism cannot modify its own safety rules | CODEOWNERS on this document |
| Changes to organism workflow files | The organism cannot modify its own execution | CODEOWNERS on `.github/workflows/organism-*` |
| Adding new dependencies to package.json | Supply chain risk | Human reviews dependency |
| Database migrations that ALTER or DROP columns | Data loss risk | Human reviews migration |

### 9.5 Rollback Protocol

If an experiment passes all 9 gates, gets merged, and THEN causes a problem in production:

```
1. Human detects issue (monitoring alert, user report, etc.)
2. Human creates GitHub Issue with label `organism-regression`
3. Organism's next perceive cycle detects the regression in metrics
4. Circuit breaker activates: HALT ALL builds
5. Human reviews the merged PR and identifies the cause
6. Human reverts the PR (standard git revert)
7. Organism's learn phase records the failure:
   - The 9-gate verification missed this issue
   - WHY did it miss it? (Missing test? Eval gap? Cross-model review missed it?)
   - What verification improvement would have caught it?
8. If the failure reveals a new verification gap:
   - Human adds a new eval test covering the failure case
   - The ratchet is strengthened — this class of failure cannot recur
9. Circuit breaker releases: builds resume
```

This creates a positive feedback loop: every production issue makes the verification stack stronger.

---

## 10. Maturity Levels

The organism grows over time, like a child learning. It starts as an observer and gradually earns more autonomy as it demonstrates competence. Each level requires the previous level's targets to be met.

### Level 0: Observer (Current State)

**What the organism does:**
- Perceives and reports (metric collection, gap analysis parsing)
- Writes perception snapshots to `.metrics/`
- Human makes all decisions and writes all code

**What the organism does NOT do:**
- Propose experiments
- Write code
- Create PRs
- Verify anything

**Graduation criteria to Level 1:**
- `organism-perceive.yml` runs reliably for 1 week
- Perception data is accurate (manually verified)
- All metric collection scripts produce correct values
- `.quality-floor.json` accurately reflects current state

### Level 1: Apprentice

**What the organism does (new):**
- Perceives + reasons + proposes experiments
- Writes EXPERIMENTS.md with 3 ranked proposals every 6 hours
- Consults LEARNINGS.md and skill library
- Applies constitutional constraints to proposals

**What the organism does NOT do:**
- Execute experiments (human does this manually)
- Create PRs
- Verify code

**How the organism learns at this level:**
- Human reviews proposals and provides feedback
- "This proposal is good" → increases the weight of that task type
- "This proposal is bad because X" → the organism records X as a learning
- The organism learns what "good proposals" look like from human feedback

**Graduation criteria to Level 2:**
- Organism proposes good experiments 70%+ of the time (human judgment)
- Proposals consistently respect constitutional constraints
- Proposals cite relevant learnings and skills
- Proposals have realistic feasibility estimates

**Target duration:** 1-2 weeks

### Level 2: Junior Developer

**What the organism does (new):**
- Perceives + reasons + builds + verifies
- All PRs require human approval (no auto-merge)
- Cross-model review (GPT-4o) reduces obvious bugs before human sees them
- Handles routine tasks: add column, add RLS policy, fix lint error, add test

**What the organism does NOT do:**
- Merge its own PRs
- Handle complex tasks (multi-file refactors, new modules, architectural changes)
- Auto-merge anything

**How the organism learns at this level:**
- Each merged PR updates the evolution ledger
- Each rejected PR records why the human rejected it
- Skill library grows from successful patterns
- Quality floor ratchets on improvements

**Graduation criteria to Level 3:**
- 50%+ of organism PRs are merged without human changes
- Zero quality floor regressions for 1 month
- Skill library has 10+ verified skills
- Cross-model review catches issues that match human review feedback

**Target duration:** 2-4 weeks

### Level 3: Senior Developer

**What the organism does (new):**
- Handles complex tasks: service layer creation, workflow rebuilds, multi-file refactors
- Population diversity explores multiple approaches for complex tasks
- Human only reviews architectural decisions and complex PRs
- Low-risk PRs (tests only, docs, types) can be auto-merged after full verification

**What the organism does NOT do:**
- Auto-merge PRs that touch logic, data, auth, or financial code
- Make architectural decisions (those require human input)
- Skip verification gates

**How the organism learns at this level:**
- Population diversity archives reveal which approach patterns work best
- Exploration engine discovers opportunities humans haven't considered
- Stagnation detection forces novel exploration when progress plateaus

**Graduation criteria to Level 4:**
- Organism closes 5+ schema gap items per week
- Code quality of organism PRs equals human-written code (measured by review feedback)
- Skill library has 20+ verified skills
- Novel improvements discovered at least 1/week

**Target duration:** 1-2 months

### Level 4: Staff Engineer

**What the organism does (new):**
- Identifies opportunities humans haven't considered
- Exploration engine discovers competitive advantages (competitor research, regulatory tracking)
- Cross-model ensemble achieves near-human code review quality
- Organism teaches ITSELF new construction domain concepts via Perplexity research
- Handles full feature development for approved roadmap items

**What the organism does NOT do:**
- Override human decisions
- Modify the kernel spec (humans define what "correct" means)
- Auto-merge PRs that affect the security boundary

**Graduation criteria to Level 5:**
- Organism's code quality consistently equals or exceeds human-written code
- Organism proposes architectural improvements that humans approve 80%+ of the time
- 85%+ of organism PRs merged without changes
- The organism has improved metrics that humans hadn't prioritized

**Target duration:** 2-4 months

### Level 5: Architect

**What the organism does (new):**
- Proposes architectural changes to the kernel spec (human still approves)
- Identifies new moats and strategic opportunities
- Coordinates with external systems (competitor monitoring, regulatory tracking, weather APIs)
- Organism's decisions are consistently better than ad-hoc human decisions for routine matters
- Full autonomy for all non-security, non-financial, non-architectural changes

**What the organism STILL does NOT do:**
- Merge security-critical PRs without human review
- Modify its own constitutional constraints
- Push directly to main
- Make financial or legal decisions

This is the "smarter than any human" target — not by replacing human judgment, but by **amplifying** it. Walker makes the architectural decisions and sets strategic direction. The organism executes at superhuman speed, discovers opportunities Walker hasn't considered yet, and never forgets what it learned.

---

## 11. Implementation Plan

### Week 1: Perceive + Reason (Level 0 → Level 1)

**Day 1-2: Perception infrastructure**
- [ ] Create `organism-perceive.yml` workflow
- [ ] Implement metric collection scripts:
  - ESLint error counter
  - TypeScript error counter
  - Test coverage reporter
  - Bundle size measurer
  - Schema gap analysis parser
  - Quality floor reader
- [ ] Write perception snapshot to `.metrics/`
- [ ] Test: run perception manually, verify all metrics match reality

**Day 3-4: Reasoning infrastructure**
- [ ] Create `organism-reason.yml` workflow
- [ ] Implement Claude Opus reasoning prompt with full context injection:
  - Perception data
  - Schema gap analysis (summary)
  - Quality floor + targets
  - LEARNINGS.md (full)
  - Recent evolution ledger entries
- [ ] Implement GPT-4o-mini task scoring
- [ ] Write EXPERIMENTS.md output format
- [ ] Test: run reasoning manually, verify proposals are sensible

**Day 5-7: Constitutional framework**
- [ ] Create `.constitution/constraints.json` with all 12 prohibitions
- [ ] Configure CODEOWNERS for protected files
- [ ] Configure branch protection rules
- [ ] Create CI check that validates constitutional compliance
- [ ] Verify: the organism's reasoning output respects all constraints
- [ ] Enable automatic perception runs (every 6 hours)
- [ ] Monitor for 2-3 days: are the proposals improving?

**Deliverable:** The organism proposes 3 experiments every 6 hours. Human reviews and manually executes the best ones.

### Week 2: Build + Verify (Level 1 → Level 2)

**Day 8-10: Build infrastructure**
- [ ] Create `organism-build.yml` workflow
- [ ] Implement branch creation (`organism/EXP-{id}`)
- [ ] Implement BEFORE measurement capture
- [ ] Implement Claude Sonnet execution with system prompt:
  - Experiment spec
  - Skill template (if applicable)
  - Learnings (relevant subset)
  - Constitutional constraints
- [ ] Implement AFTER measurement capture
- [ ] Implement PR creation with full metadata
- [ ] Test: run a build manually for a simple experiment (add provenance columns)

**Day 11-13: Verification infrastructure**
- [ ] Create `organism-verify.yml` workflow
- [ ] Implement Gates 1-4 (automated: TS, ESLint, tests, build)
- [ ] Implement Gates 5-6 (eval harness integration)
- [ ] Implement Gate 7 (cross-model review with GPT-4o)
- [ ] Implement Gate 8 (metric comparison from PR body)
- [ ] Implement Gate 9 (quality floor check)
- [ ] Implement verification report comment format
- [ ] Test: create a PR manually, run verification, check the report

**Day 14: Integration test**
- [ ] Run a full Perceive → Reason → Build → Verify cycle end-to-end
- [ ] Verify: the organism creates a PR that passes all 9 gates
- [ ] Human reviews and merges the first organism PR

**Deliverable:** The organism creates PRs that have been verified by 9 CI gates + GPT-4o review. Human still reviews and merges all PRs.

### Week 3: Learn + Skill Library (Level 2)

**Day 15-17: Learning infrastructure**
- [ ] Create `organism-learn.yml` workflow
- [ ] Implement evolution ledger append (EVOLUTION_LEDGER.md)
- [ ] Implement learning extraction (GPT-4o-mini)
- [ ] Implement skill library update logic:
  - Skill usage tracking (times_used, success_rate)
  - New skill extraction criteria check
  - Skill creation template
- [ ] Implement quality floor auto-ratchet
- [ ] Implement world model update

**Day 18-19: Skill library seeding**
- [ ] Create `.skills/` directory structure
- [ ] Seed initial skills from known patterns:
  - `add-provenance-columns`
  - `add-rls-policy-project-scoped`
  - `add-rls-policy-org-scoped`
  - `add-audit-trigger`
  - `fix-eslint-batch`
  - `activate-eval-test`
- [ ] Create skill templates with parameter placeholders
- [ ] Test: verify skill retrieval works in build phase

**Day 20-21: Circuit breakers and cost controls**
- [ ] Implement consecutive failure circuit breaker
- [ ] Implement quality floor regression circuit breaker
- [ ] Implement PR queue overflow check
- [ ] Implement daily cost ceiling tracking
- [ ] Implement alert escalation (GitHub Issues + Slack)
- [ ] Test: simulate each circuit breaker trigger condition

**Deliverable:** The organism learns from every experiment. Skill library grows automatically. Circuit breakers protect against failures.

### Week 4: Explore + Population (Level 2 → Level 3)

**Day 22-24: Exploration engine**
- [ ] Create `organism-explore.yml` workflow
- [ ] Implement Perplexity competitor scan
- [ ] Implement Perplexity regulatory scan
- [ ] Implement Gemini visual regression (screenshot comparison)
- [ ] Implement codebase analysis (low-coverage modules, high-error files)
- [ ] Write exploration report format

**Day 25-26: Population diversity**
- [ ] Implement multi-approach generation for complex tasks
- [ ] Implement parallel branch creation (approach-a, approach-b, approach-c)
- [ ] Implement approach evaluation and ranking
- [ ] Implement archive system for alternative approaches

**Day 27-28: Thompson Sampling and stagnation detection**
- [ ] Implement Beta distribution tracking per task category
- [ ] Implement Thompson Sampling task selection
- [ ] Implement stagnation detection (< 1 improvement per 5 cycles)
- [ ] Implement forced exploration mode
- [ ] First fully autonomous improvement cycle (Perceive → Reason → Build → Verify → Learn)

**Deliverable:** The organism explores new opportunities, maintains population diversity, and runs fully autonomous improvement cycles.

---

## 12. Metrics That Matter

How we know the organism is getting smarter. These metrics are tracked in `.metrics/` and reviewed weekly.

### 12.1 Organism Performance Metrics

| Metric | Level 1 Target | Level 3 Target | Level 5 Target | How Measured |
|---|---|---|---|---|
| Experiment proposal quality | 50% approved | 80% approved | 95% approved | % of proposals human marks "good" |
| PR merge rate | 30% merged without changes | 60% merged | 85% merged | % of organism PRs merged as-is |
| Schema gap items closed/week | 1-2 | 5-10 | 20+ | Delta in conformant tables |
| Quality floor improvements/month | 2-3 | 8-10 | Continuous | Count of ratchet advances |
| Eval tests activated/month | 5 | 15 | All | Count of SKIP → PASS transitions |
| Time from experiment to merged PR | 24h (human bottleneck) | 6h | 1h | Wall clock time |
| Novel improvements discovered | 0 | 1/week | 5/week | Count of improvements human didn't request |
| Skills in library | 5 | 20 | 100+ | Count of verified skills |
| API cost per merged PR | $5 | $3 | $1 | Total cost / merged PRs |
| Cross-model review accuracy | — | 80% agreement with human | 95% agreement | GPT-4o findings vs human findings |

### 12.2 Product Quality Metrics (The Real Targets)

| Metric | Current | 3-Month Target | 6-Month Target | Ultimate Target |
|---|---|---|---|---|
| ESLint errors | 1036 | 500 | 100 | 0 |
| TypeScript errors | 0 | 0 | 0 | 0 |
| `as any` count | 1 | 0 | 0 | 0 |
| Mock count | 7 | 3 | 0 | 0 |
| Test coverage (statements) | 43.2% | 55% | 70% | 85% |
| E2E pass rate | 70% | 85% | 95% | 100% |
| Bundle size | 1869 KB | 1000 KB | 500 KB | 250 KB |
| Longest API response | 340ms | 250ms | 200ms | 150ms |
| Tables fully conformant | 5/99 | 25/99 | 60/99 | 99/99 |
| Tables with confirmed RLS | 43/99 | 70/99 | 90/99 | 99/99 |
| A11y violations | 0 | 0 | 0 | 0 |

### 12.3 Compounding Intelligence Indicators

These metrics measure whether the organism is actually getting smarter, not just doing more work:

| Indicator | What It Measures | Healthy Signal |
|---|---|---|
| **Skill reuse rate** | % of experiments that use a skill from the library | Increasing over time (20% → 50% → 80%) |
| **First-attempt success rate** | % of experiments that pass all 9 gates on the first try | Increasing (30% → 50% → 70%) |
| **Turns per experiment** | Average Claude turns used per successful experiment | Decreasing (15 → 10 → 5) |
| **Cost per improvement** | Average API cost per metric improvement | Decreasing ($5 → $3 → $1) |
| **Learning extraction rate** | % of experiments that produce a new learning | Decreasing (100% → 50% → 10%) — learning converges |
| **Novel discovery rate** | Improvements discovered that weren't in the schema gap analysis | Increasing (0 → 1/week → 5/week) |
| **Failure repeat rate** | % of failures that repeat a previously failed approach | Must be 0%. The organism should never repeat a known failure. |

---

## 13. Why This Wins

### 13.1 The Strategic Argument

Every other "AI coding agent" is a **tool**. You tell Devin what to do, it does it. You tell Copilot Workspace what to fix, it fixes it. You tell Cursor to refactor, it refactors.

The SiteSync Organism is an **entity**. It:

| Capability | Tool (Devin, Copilot, etc.) | Organism V2 |
|---|---|---|
| Knows what the platform should be | No — relies on human instructions | Yes — the kernel spec defines "correct" for every entity |
| Sees what's wrong | No — relies on human-filed issues | Yes — schema gap analysis + eval harness measure every gap |
| Decides what to fix next | No — human selects tasks | Yes — strategic reasoning with multi-factor scoring |
| Fixes it | Yes (this is what tools do) | Yes — autonomous code generation with skill library |
| Proves it worked | Partially — runs tests | Yes — 9-gate verification with cross-model review |
| Remembers what it learned | No — amnesia between sessions | Yes — evolution ledger + skill library + world model |
| Gets smarter every cycle | No — static capability | Yes — compounding intelligence through learning |

### 13.2 The Competitive Moat

No competitor has this architecture. Consider the landscape:

**Procore:** 1000+ engineers writing code manually. Every engineer starts fresh each morning. Knowledge lives in documentation that nobody reads and meetings nobody remembers. When an engineer leaves, their knowledge leaves with them.

**SiteSync with Organism V2:** An autonomous system that improves 24/7 and never forgets what it learned. Every experiment — success or failure — makes the next experiment smarter. The skill library compounds. The quality ratchet ensures progress is irreversible. The evolution ledger is a permanent, growing record of everything the system has learned about building construction PM software.

After 6 months of operation:
- 1000+ experiments logged in the evolution ledger
- 100+ verified skills in the library
- 500+ learnings in LEARNINGS.md
- Every table conformant to the kernel spec
- Every metric at or beyond its target

This knowledge base cannot be replicated by hiring engineers. It can only be built by running an organism that learns from every cycle.

### 13.3 The Human-Organism Partnership

The organism doesn't replace human judgment — it **amplifies** it.

Walker's role:
- Define what "correct" means (kernel spec)
- Set strategic priorities (soft priorities in Section 3.2)
- Make architectural decisions (Level 5 proposals)
- Review organism PRs (diminishing as maturity increases)
- Approve financial/security/schema changes (always)

Organism's role:
- Execute at superhuman speed (3 experiments per day, 24/7)
- Discover opportunities Walker hasn't considered
- Maintain perfect memory of every experiment and learning
- Ensure quality never regresses (the ratchet)
- Apply knowledge from 1000+ past experiments to every new task

The analogy: Walker is the architect who designs the building. The organism is the construction crew that builds it 24/7, learns from every mistake, and never forgets a lesson. The architect still reviews the work and makes the critical decisions. But the crew gets faster, smarter, and more reliable every day.

### 13.4 The Endgame

When Organism V2 reaches Level 5:

- SiteSync's codebase will be the most thoroughly verified construction PM platform in existence — every table kernel-conformant, every API eval-tested, every permission RLS-enforced.
- The organism will discover competitive features before Procore's 1000 engineers think of them — because it monitors competitors weekly and has domain knowledge that compounds.
- The quality ratchet will have advanced hundreds of times — each advance is irreversible, each one makes the platform better.
- The skill library will contain 100+ verified patterns — each one a crystallized lesson about how to build construction PM software.
- The evolution ledger will be a permanent record of how an autonomous system learned to build software — a dataset more valuable than the software itself.

This is the founder's vision realized: a life form more intelligent than anything out there, built with proper guardrails and teaching, getting smarter every cycle.

The organism is not the product. The organism is what **builds** the product. And unlike any human team, it never sleeps, never forgets, and never makes the same mistake twice.

---

## Appendix A: File Structure

```
sitesync-pm/
├── .agent/
│   └── world-model.json              # Compressed codebase understanding
├── .archive/
│   └── EXP-{id}-approach-{x}/        # Archived population alternatives
├── .constitution/
│   └── constraints.json               # Machine-readable constitutional constraints
├── .exploration/
│   └── scan-{date}.json              # Weekly exploration reports
├── .github/
│   └── workflows/
│       ├── organism-perceive.yml      # Metric collection (every 6h)
│       ├── organism-reason.yml        # Strategic task selection
│       ├── organism-build.yml         # Code generation + PR creation
│       ├── organism-verify.yml        # 9-gate verification
│       ├── organism-learn.yml         # Learning extraction
│       └── organism-explore.yml       # Weekly exploration
├── .metrics/
│   ├── perception-{date}.json         # Perception snapshots
│   ├── cost-{date}.json               # API cost tracking
│   └── experiment-{id}.json           # Per-experiment metrics
├── .quality-floor.json                # Quality ratchet state
├── .skills/
│   ├── index.json                     # Skill library index
│   ├── add-provenance-columns.json    # Skill definition
│   ├── add-rls-policy-project.json    # Skill definition
│   ├── templates/
│   │   ├── project-rls.sql.template   # Parameterized skill templates
│   │   └── provenance-columns.sql.template
│   └── ...
├── DOMAIN_KERNEL_SPEC.md              # Source of truth — what "correct" means
├── SCHEMA_GAP_ANALYSIS.md             # What's wrong — 99 tables audited
├── ORGANISM_V2_ARCHITECTURE.md        # THIS DOCUMENT
├── EVOLUTION_LEDGER.md                # Immutable experiment log
├── EXPERIMENTS.md                     # Current cycle's ranked proposals
├── LEARNINGS.md                       # Compounding intelligence log
├── DEPRECATION_LEDGER.md              # Tables/code scheduled for removal
└── GOVERNANCE.md                      # Human governance rules
```

## Appendix B: Glossary

| Term | Definition |
|---|---|
| **Circuit breaker** | An automatic safety mechanism that halts the organism when a failure condition is detected |
| **Constitutional constraint** | A hardcoded rule the organism cannot override, enforced at multiple levels |
| **Cross-Model Perplexity (CMP)** | Using one model family's "surprise" at another's output as an error detection signal |
| **Evolution ledger** | The immutable, append-only log of every experiment the organism has attempted |
| **Experiment** | A single, testable hypothesis with one target file, one metric, and one measurable outcome |
| **Gate** | A pass/fail checkpoint in the verification pipeline |
| **Kernel spec** | The canonical domain model defining what "correct" means for every entity in the system |
| **MAP-Elites** | An algorithm that maintains a population of diverse, high-quality solutions across behavioral dimensions |
| **Maturity level** | The organism's current autonomy level (0-5), determining what actions it can take without human approval |
| **Perception** | The organism's measurement of its own state — metrics, gaps, health signals |
| **Quality ratchet** | A mechanism ensuring metrics can only improve, never regress |
| **Schema gap** | The difference between the current database schema and the kernel spec's target |
| **Skill** | A verified, parameterized code pattern with metadata (trigger conditions, success rate, dependencies) |
| **Thompson Sampling** | A Bayesian approach to exploration-exploitation that samples from belief distributions |
| **World model** | The organism's compressed understanding of the codebase, updated after every cycle |

## Appendix C: Research References

This architecture draws on the following research:

- **GVU Operator** — Formal mathematical unification of self-improvement approaches (Generator-Verifier-Updater)
- **AlphaEvolve** (Google DeepMind, May 2025) — Evolutionary coding agent that optimizes entire codebases; recovered 0.7% of Google's worldwide compute
- **AlphaProof** (Google DeepMind, 2024) — LLM + AlphaZero RL for formal proof verification; IMO 2024 silver medal equivalent
- **Voyager** (NVIDIA) — Lifelong learning agent with automatic curriculum, skill library, and iterative prompting; 3.3× more unique items, 15.3× faster milestones
- **SICA** (2025) — Self-Improving Coding Agent; SWE-bench 17% → 53% over 14 iterations at ~$7,000
- **Darwin Gödel Machine** (Sakana AI, May 2025) — Open-ended evolutionary self-improvement; SWE-bench 20% → 50% with MAP-Elites diversity
- **The AI Scientist** (Sakana AI, *Nature* March 2026) — First fully AI-generated paper to pass peer review
- **Cross-Model Perplexity** — AUROC 0.75 vs 0.59 for within-model entropy on error detection
- **SWE-agent** (NeurIPS 2024) — Agent-Computer Interface design; well-designed ACI outperforms by 6-7×
- **12-Factor AgentOps** — Quality ratchet pattern; "Lock Progress Forward"
- **Anthropic Constitutional AI** — Reason-based rather than rule-based constraints
- **Devin** (Cognition AI) — 18 months of lessons; 20× efficiency for security fixes, 10× for migrations
- **OpenAI Codex** — Self-bootstrapping; writes >90% of its own application code
- **METR Benchmarks** — AI agent task completion horizon doubling every 7 months for 6 years

---

*This document is the definitive architecture specification for Organism V2. It is both a technical blueprint and a strategic vision. Every workflow, every constraint, every metric, and every maturity milestone described here is designed to be immediately implementable.*

*The organism begins as an observer. It grows into an apprentice, then a junior developer, then a senior developer, then a staff engineer, and finally an architect. At each level, it earns more autonomy by demonstrating competence. The constitutional constraints ensure it remains safe at every level.*

*The goal is not to replace the human. The goal is to build a system that amplifies human judgment to superhuman scale — a system that never sleeps, never forgets, and never makes the same mistake twice.*
