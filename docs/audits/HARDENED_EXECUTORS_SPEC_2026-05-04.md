# Hardened Executors Spec — Lap 3 Days 61-65

**Date:** 2026-05-04
**Status:** Spec ready. Implementation begins Day 61 (~June 9, 2026).
**Companion:** `LAP_3_ACCEPTANCE_GATE_SPEC` (Day 90 gate this work points at), `AUTO_EXECUTE_CANCEL_WINDOW_SPEC` (Days 66-67, the UX layer over these executors), `IRIS_TELEMETRY_SPEC` (telemetry that captures auto-exec events).
**Format reference:** `MONEY_CENTS_AUDIT_2026-05-01.md`. Phased plan + file-by-file changelog + test plan + acceptance criteria.

---

## TL;DR

Iris currently *drafts* via 5 executors (`rfi`, `dailyLog`, `payApp`, `punchItem`, `submittalTransmittal`). Lap 3 hardens **3 of them for opt-in auto-execute**:

1. **RFI response routing** (Day 62) — when RFI ball-in-court is the architect for > 5 days, auto-route to the same person on the next opportunity (an automated nudge, not a bypass)
2. **Daily log compilation** (Day 63) — at local sunset, compile the day's photos + crew check-ins + weather + work performed into a draft daily log; auto-execute on confidence ≥ 0.92
3. **Punch item assignment** (Day 64) — when a punch item is created without an assignee, auto-assign based on trade + drawing reference + recent assignment history

Each executor goes through three lifecycle stages:
- **Drafted** (Lap 2 capability) — the existing flow; user approves
- **Shadow mode** (Lap 3 Days 62-67) — auto-execute fires "in shadow"; results logged but no real action; user still approves the actual draft
- **Opt-in auto-execute** (Lap 3 Day 68+) — user opts in; auto-execute fires; 60-second human cancel window; zero-tolerance for cancels (per Gate 4)

This spec covers: the hardening pattern (transactional rollback + cancel window + audit row + feature flag + shadow mode + metrics), the 3 executors specifically, file changes, test plan.

---

## The Hardening Framework (applies to all 3)

Every hardened executor implements the same shape:

```typescript
// Each executor is a tuple of:
//   1. Eligibility predicate (who/when can auto-execute fire)
//   2. Confidence threshold gate (0.92 minimum)
//   3. Shadow-mode runner (logs would-have-fired without firing)
//   4. Cancel-window UX (60s human override, per AUTO_EXECUTE_CANCEL_WINDOW_SPEC)
//   5. Transactional executor (atomic state change with rollback)
//   6. Audit row writer (chain + telemetry)
//   7. Failure handler (rollback + alert + reset confidence)
//   8. Telemetry recorder (pass/fail/cancel/audit)

interface HardenedExecutor<T> {
  name: string
  
  // Stage 1 — Eligibility
  isEligibleForAutoExecute(
    draft: DraftedAction,
    project: Project,
    org: Organization
  ): Promise<{ eligible: boolean; reason?: string }>
  
  // Stage 2 — Confidence threshold
  meetsConfidenceThreshold(draft: DraftedAction): boolean  // hard 0.92
  
  // Stage 3 — Shadow mode runner
  runShadow(draft: DraftedAction): Promise<ShadowResult>
  
  // Stage 4 — Real execution (transactional)
  execute(draft: DraftedAction, opts: ExecuteOpts): Promise<ExecuteResult>
  
  // Stage 5 — Rollback (idempotent)
  rollback(execId: string): Promise<RollbackResult>
}
```

### The 8 hardening properties (apply to every executor in production)

| # | Property | Mechanism |
|---|---|---|
| 1 | Transactional rollback | All state changes in single Supabase RPC with `BEGIN/COMMIT/ROLLBACK` semantics; failure auto-rolls back |
| 2 | 60-second cancel window | Per `AUTO_EXECUTE_CANCEL_WINDOW_SPEC` — UX layer; cancellation arrives within 60s aborts the executor |
| 3 | Audit chain row | Hash chain row written before any state change; chain row also written after success/failure |
| 4 | Feature flag gate | `is_auto_execute_enabled(org_id, executor_name)` checked at runtime |
| 5 | Confidence threshold | Hard floor 0.92; below → drafts arrive in inbox normally; never auto-execute |
| 6 | Shadow mode | Pre-opt-in: auto-execute logic fires but doesn't write state changes; logged for tuning |
| 7 | Metrics + alerting | Each fire writes to `executor_runs` table; alerts on failure rate spike |
| 8 | Per-org daily cap | Default: 5 auto-executions/org/day. Tunable. Hard cap at 50/day even if tuned higher. |

---

## Day 61 — Hardening framework (one engineer-day)

### Tasks

- Write `HardenedExecutor` interface + base class (`src/services/iris/hardenedExecutor.ts`) (planned)
- Migration for `executor_runs` telemetry table
- Migration for org-level feature flag table
- Update existing 5 executors to optionally implement HardenedExecutor (start: just RFI, daily log, punch item; pay app + submittal transmittal NOT hardened in Lap 3)

### Migration

```sql
-- Migration: 20260609020000_hardened_executors.sql

CREATE TABLE executor_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drafted_action_id UUID NOT NULL REFERENCES drafted_actions(id),
  executor_name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Stage info
  was_shadow BOOLEAN NOT NULL DEFAULT FALSE,
  was_auto_executed BOOLEAN NOT NULL DEFAULT FALSE,
  was_human_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_window_expired_at TIMESTAMPTZ,  -- 60s after start
  
  -- Outcome
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'rolled_back', 'shadow')),
  failure_reason TEXT,
  audit_log_id UUID,  -- which audit_log row this corresponds to
  
  -- Timing
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
  ) STORED,
  
  -- Confidence at runtime
  confidence_at_execution NUMERIC(3, 2)
);

CREATE INDEX idx_executor_runs_org_executor_status
  ON executor_runs(organization_id, executor_name, status, scheduled_at);

CREATE TABLE org_executor_features (
  organization_id UUID NOT NULL REFERENCES organizations(id),
  executor_name TEXT NOT NULL,
  is_auto_execute_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_shadow_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_at TIMESTAMPTZ,
  enabled_by UUID REFERENCES auth.users(id),
  daily_cap INTEGER NOT NULL DEFAULT 5,
  
  PRIMARY KEY (organization_id, executor_name)
);

-- Tracking auto-execute count per day per (org, executor)
CREATE TABLE executor_daily_counts (
  organization_id UUID NOT NULL REFERENCES organizations(id),
  executor_name TEXT NOT NULL,
  count_date DATE NOT NULL,
  successful_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  cancelled_count INTEGER NOT NULL DEFAULT 0,
  
  PRIMARY KEY (organization_id, executor_name, count_date)
);
```

### Code skeleton

```typescript
// src/services/iris/hardenedExecutor.ts

import type { DraftedAction } from '../../types/draftedActions'

export interface HardenedExecutor<T extends Record<string, unknown>> {
  name: string
  
  // Eligibility — runs before auto-execute consideration
  isEligibleForAutoExecute(draft: DraftedAction): Promise<{
    eligible: boolean
    reason?: string  // human-readable reason if not eligible
  }>
  
  // Hard confidence floor
  meetsConfidenceThreshold(draft: DraftedAction): boolean
  
  // Shadow mode — would-have-fired without state change
  runShadow(draft: DraftedAction): Promise<{
    wouldExecute: boolean
    plannedActions: T[]
  }>
  
  // Real auto-execute
  execute(draft: DraftedAction, opts: { 
    cancelToken: AbortSignal 
  }): Promise<{
    succeeded: boolean
    error?: string
    rollbackable: boolean
  }>
  
  // Idempotent rollback
  rollback(executorRunId: string): Promise<{ ok: boolean }>
}

export const CONFIDENCE_FLOOR_AUTO_EXEC = 0.92
export const CANCEL_WINDOW_SECONDS = 60
export const DEFAULT_DAILY_CAP = 5
```

---

## Day 62 — Executor 1: RFI response routing

### What it does

When an RFI is in "open" status with ball-in-court = architect for > 5 days, Iris drafts a follow-up email. Today (Lap 2), the user approves; the email sends. With auto-execute, after 60-second cancel window, the email sends without user input.

### Eligibility predicate

```typescript
// RFIRoutingExecutor.isEligibleForAutoExecute()
async isEligibleForAutoExecute(draft) {
  // Only fire on follow-up drafts (not initial RFIs)
  if (draft.action_type !== 'rfi.draft' || draft.payload.draft_kind !== 'follow_up') {
    return { eligible: false, reason: 'not a follow-up draft' }
  }
  
  // Underlying RFI must still be in "open" status
  const rfi = await getRfi(draft.payload.related_rfi_id)
  if (rfi.status !== 'open') {
    return { eligible: false, reason: 'RFI no longer open' }
  }
  
  // Ball must still be in architect's court (no progress since draft created)
  if (rfi.ball_in_court !== 'architect' || rfi.last_action_user_role !== 'architect_lapsed') {
    return { eligible: false, reason: 'ball-in-court changed' }
  }
  
  // No follow-up sent in last 24 hours (don't spam architects)
  const recentFollowUp = await getRecentRfiFollowUp(rfi.id, 24)
  if (recentFollowUp) {
    return { eligible: false, reason: 'recent follow-up exists' }
  }
  
  return { eligible: true }
}
```

### Execution

The executor:
1. Sends an email to the architect's address (via SendGrid or Postmark — TBD via existing email infra)
2. Logs the email_sent event in `audit_log`
3. Updates RFI's `last_followup_sent_at`
4. Writes `executor_runs` row

If email send fails: roll back the audit log update + the RFI update; mark `executor_runs.status = 'failed'`.

### Cancel-window behavior

After draft is created with confidence ≥ 0.92 (and feature flag on), a 60-second timer starts. UI shows: "Iris will send this in 0:60." User clicks Cancel → executor aborts; draft reverts to normal "needs approval" state. Cancel = increment `executor_runs.cancelled_count` for the day; resets the gate-4 7-day clock.

---

## Day 63 — Executor 2: Daily log compilation

### What it does

At local sunset (per project's geo location + IANA timezone), the system compiles the day's data into a draft daily log:
- Weather (from forecast feed)
- Manpower count (from check-ins)
- Trades on-site (from check-ins)
- Work performed (from photo classifier + GPS clusters + voice memos)
- Issues (from safety photo classifier + RFI activity)

Today, this draft sits in the inbox for the super to approve. With auto-execute, after the cancel window, the log auto-files.

### Eligibility predicate

```typescript
async isEligibleForAutoExecute(draft) {
  if (draft.action_type !== 'daily_log.draft') {
    return { eligible: false, reason: 'wrong action type' }
  }
  
  // Day's data must be reasonably complete
  const completeness = await assessDailyLogDataCompleteness(draft.payload.date, draft.project_id)
  if (completeness < 0.85) {
    return { eligible: false, reason: `data completeness ${completeness} < 0.85` }
  }
  
  // No existing daily log for this date
  const existingLog = await getDailyLog(draft.project_id, draft.payload.date)
  if (existingLog) {
    return { eligible: false, reason: 'daily log already exists' }
  }
  
  // No conflicting drafts for this date
  const otherDrafts = await getOtherDailyLogDraftsForDate(draft.project_id, draft.payload.date, draft.id)
  if (otherDrafts.length > 0) {
    return { eligible: false, reason: 'conflicting daily log drafts exist' }
  }
  
  return { eligible: true }
}
```

### Execution

The executor:
1. Inserts the daily_log row with all fields
2. Marks the draft as 'executed'
3. Writes audit chain row
4. Sends notification to super: "Daily log filed automatically. Tap to review."
5. Schedules retraction window (24 hours): super can manually unfile the log

### Special handling: super can review post-execute

Unlike RFI routing (which sends external email — irreversible), daily log auto-execute writes an internal record. We give supers a 24-hour grace window to "unfile" without it counting against them. After 24 hours, log is committed to audit chain permanently.

---

## Day 64 — Executor 3: Punch item assignment

### What it does

When a punch item is created (manually or via Iris draft) without an assignee, Iris assigns it based on:
- Trade tagged on the item
- Drawing reference (whose work scope is at that location)
- Recent assignment history (who's been assigned similar items at this project)

### Eligibility predicate

```typescript
async isEligibleForAutoExecute(draft) {
  if (draft.action_type !== 'punch_item.draft' && draft.payload.action !== 'assign') {
    return { eligible: false, reason: 'wrong action type' }
  }
  
  const item = await getPunchItem(draft.payload.punch_item_id)
  if (item.assignee_user_id) {
    return { eligible: false, reason: 'item already assigned' }
  }
  
  // Confidence in the assignee suggestion must be high
  if (draft.payload.assignee_confidence < 0.92) {
    return { eligible: false, reason: 'assignee confidence below floor' }
  }
  
  return { eligible: true }
}
```

### Execution

Updates `punch_items.assignee_user_id`. Sends notification. Audit row.

Reversible by user (re-assign anytime); doesn't burn bridges externally.

---

## Day 65 — FRIDAY: integration test + shadow mode begins

### Tasks

- All 3 executors registered in the framework
- Feature flag table populated with shadow-mode flag = TRUE for Brad's pilot org
- Auto-execute flag = FALSE for everyone (won't be opted in until Day 68 manually)
- Shadow runs begin in the pilot environment

### Shadow mode mechanics

For Days 65-67:
- Each draft Iris creates also runs through the executor's `runShadow()` method
- `executor_runs` row written with `was_shadow = TRUE`
- The shadow run determines: would the auto-execute have fired? if so, what would have happened?
- The actual draft still goes through normal user approval
- Walker reviews the shadow log nightly; tunes confidence scoring + eligibility predicates if needed

This is the validation step before flipping the auto-execute switch on Day 68. **No surprises in production.**

---

## Day 68-71 — Opt-in flip (per Day 90 gate)

Day 68: Walker manually enables auto-execute for **1** executor (RFI routing, lowest blast radius — emails are recoverable; punch assignments are reversible; daily logs are most-important-but-also-most-validated). Pilot customer (Brad) opts in via UI toggle.

Day 69: Monitor. Zero cancels = proceed.

Day 70: Auto-execute extended to daily log compilation.

Day 71: Auto-execute extended to punch item assignment.

Day 72 (FRIDAY): pilot has 100% auto-execute coverage on all 3 executors with zero human cancels in 7 days. **Gate 4 hits threshold.**

---

## Performance budgets

| Operation | Budget |
|---|---|
| Eligibility check | < 100ms p95 |
| Shadow run | < 200ms p95 |
| Auto-execute (excluding network calls) | < 500ms p95 |
| Cancel-window response time (UI to abort) | < 50ms |
| Rollback (full) | < 1s p95 |
| Audit chain write | < 100ms (already established) |

CI fails if any budget regresses by > 20%.

---

## Test plan

### Unit (Vitest)

- Each `isEligibleForAutoExecute` predicate: 5 test cases covering happy path + 4 ineligibility reasons
- `meetsConfidenceThreshold` returns true at exactly 0.92, false at 0.919
- `runShadow` does not write any state-change rows
- `execute` rollback: when execute throws, the system state is identical to pre-execute

### Integration (Postgres)

- `executor_runs` row written on every fire (shadow + real)
- `executor_daily_counts` increments correctly
- `org_executor_features` flag check is enforced at executor entry
- Daily cap enforcement: 5 successful auto-executes today; 6th draft is delivered to inbox (not auto-executed)

### E2E (Playwright)

- RFI follow-up auto-execute: trigger eligible draft → wait 65 sec → assert email send recorded → audit row written
- Daily log auto-execute: trigger eligible draft at "sunset" → wait 65 sec → assert daily_log row exists
- Punch item: trigger draft → wait → assert assignee set
- Cancel-window: click Cancel during 60s window → assert executor aborts; draft reverts to pending

### Adversarial (red team)

- Feature flag is OFF: try to trigger executor → assert no execution
- Confidence is 0.91: assert no execution despite flag on
- Daily cap exceeded: 6th draft → assert delivered to inbox not auto-executed
- Eligibility predicate returns false: assert no execution
- Cancel signal arrives before execution completes: assert clean abort + rollback
- Cancel signal arrives after execution completes: assert no rollback (already executed); display "took X seconds, can't be undone"

---

## File-by-file changelog

| Path | Change |
|---|---|
| `supabase/migrations/20260609020000_hardened_executors.sql` | NEW |
| `src/services/iris/hardenedExecutor.ts` | NEW — base interface + class |
| `src/services/iris/executors/rfi.ts` | EDIT — add hardened mode |
| `src/services/iris/executors/dailyLog.ts` | EDIT — add hardened mode |
| `src/services/iris/executors/punchItem.ts` | EDIT — add hardened mode |
| `src/services/iris/executorRunner.ts` | NEW — orchestrates eligibility check + shadow + cancel-window + execute |
| `src/services/iris/featureFlags.ts` | NEW — `is_auto_execute_enabled()` helper |
| `src/services/iris/dailyCounts.ts` | NEW — daily cap enforcement |
| `src/components/iris/AutoExecuteToggle.tsx` | NEW — Per-org-per-executor opt-in UI |
| `src/hooks/useExecutorFeatureFlags.ts` | NEW |
| `e2e/hardened-executors.spec.ts` | NEW — E2E tests above |
| `docs/audits/INDEX.md` | EDIT — add this spec |

---

## Acceptance criteria for this spec to be "shipped"

1. Migration applied
2. All 3 executors implement HardenedExecutor interface
3. Shadow mode running for Brad's pilot org from Day 65
4. AutoExecuteToggle UI live in admin settings
5. All test plans passing
6. Day 68 first opt-in fires successfully
7. By Day 72: 7-day window with zero cancels begins (Gate 4 clock starts)

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| EXEC-1 | RFI auto-routed email sent to wrong architect (eligibility predicate bug) | Low-Medium | High (reputation) | Shadow mode catches this; review shadow logs Days 65-67 |
| EXEC-2 | Daily log auto-filed with wrong data; super misses 24-hr unfile window | Low | Medium | Pre-fire review: Walker reviews daily log shadow logs every morning before opt-in |
| EXEC-3 | Punch assignment to wrong sub | Medium | Low (easily reversible) | Confidence floor + assignee suggestion explainability |
| EXEC-4 | Confidence threshold wrong empirically | Medium | Medium | Calibrate weekly during shadow mode; raise to 0.95 if needed |
| EXEC-5 | User cancels mid-window but the action is "racing" | Low | Medium | Cancel signal idempotent + atomic; race condition tested |
| EXEC-6 | Daily cap miscount | Low | Low | Counter table + idempotent increment |

---

## What this spec deliberately does NOT cover

- Auto-execute for pay apps (financial; defer to post-Lap-3 alongside Embedded Payments build)
- Auto-execute for submittal transmittals (less validated; defer)
- Cross-org auto-execute (only single-tenant in Lap 3; cross-project Q1 2027)
- Voice-driven cancel ("Hey Iris, cancel that") — Lap 4+ feature
- Confidence-threshold experimentation framework — comes with `IRIS_COST_BUDGET_SPEC` later
- Auto-execute analytics dashboard — Walker queries `executor_runs` table directly until Lap 4
