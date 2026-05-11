# PHASE 2 — Specialist Sub-Agents + Hardened Executors

**Date:** 2026-05-08
**Status:** Pre-flight (Lap 3 build, T-240 → T-210)
**Author:** Claude (subagent), reviewed by Walker
**Phase:** 2 of IRIS_NATIVENESS_PLAN_2026-05-08.md
**Lap:** 3 (Lap 3 build window)
**Window:** T-240 → T-210 (Sep 1 2026 → Oct 1 2026)
**Closes pillars:** P5 (specialist sub-agents), P7 (generate AND commit)
**Reference ADRs:** ADR-007 (auto-withdraw), ADR-009 (state machines descoped, 3 exceptions here), ADR-018 (specialist boundary contract — to be ratified before this phase ships)

---

## TL;DR

Phase 1 gave Iris a Role Layer and a Context Fabric — Iris now *knows what it's looking at*. Phase 2 makes Iris *do something about it*. We split the monolithic "iris generates a draft" surface into a router + four specialist sub-agents, each with a hard deterministic check and a narrow LLM scope. We then promote three high-confidence draft surfaces (RFI auto-route, daily-log finalize, lien-waiver chase) into hardened executors that actually commit through PermissionGate. Every executor invocation lands in a new `iris_actions` audit log, the foundation for Phase 9 replay/evals. Exit gate: router accuracy ≥95% on goldens, 3 executors live with ≥85% auto-approval rate on pilot data, P95 latency ≤2.0s non-LLM / ≤8.0s LLM-backed.

---

## 1. Decision Summary

We are graduating Iris from **drafter** to **actor**. This is the first phase where Iris's output enters the system of record without a human keystroke between generation and commit. Three structural decisions:

1. **Router-as-dispatcher, not as planner.** The IrisRouter does not "decide what Iris should do" — Phase 1's intent-classifier already did that. Router takes `(workflow, context-fabric-snapshot)` and dispatches to specialists. Routing is deterministic table lookup with confidence scoring, not an LLM call. Routing latency budget: 50ms P95.

2. **Four specialists, each a real service.** Drafter, MoneyAgent, ScheduleAgent, CodeAgent. Each implements the `SpecialistAgent<TInput, TOutput>` boundary contract (ADR-018). Deterministic check is mandatory and runs *before* the LLM call where possible (cheap fail-fast) or *after* (verification gate). LLM scope is narrow and named. Write-scope is enumerated. Rejection mode is one of `auto_withdraw | hold_for_review | hard_fail`.

3. **Three executors graduate from drafter to actor.** RfiAutoRoute, DailyLogFinalize, LienWaiverChase. Each is a bespoke state machine (we descoped general state-machine wiring in ADR-009; these three get explicit, hand-wired XState v5 machines because they cross the commit boundary). Every commit goes through PermissionGate. Every invocation writes to `iris_actions`. Auto-withdraw policy (ADR-007) extends from drafts to executor outputs: a stale or contradicted commit gets withdrawn, never silently updated.

What we are explicitly NOT doing in Phase 2:
- No new LLM models. Drafter and ScheduleAgent narrative use Sonnet-class; MoneyAgent and CodeAgent verification can use Haiku-class for tight latency. Phase 4 revisits model selection.
- No multi-step planner. Specialists are leaves in the call graph, not nodes. If a workflow needs >1 specialist, the router fans out in parallel, then a deterministic merger combines results.
- No autonomous escalation. If a specialist's deterministic check fails, the executor halts and surfaces a `hold_for_review`. Iris does not "try harder."
- No new permission roles. Reuses Lap 1's PermissionGate matrix.

---

## 2. The IrisRouter — Design, Dispatch Rules, Telemetry

### 2.1 Surface

```ts
// src/services/iris/router.ts

import type { ContextFabricSnapshot } from './context-fabric';
import type { WorkflowKind } from './workflows';
import type { SpecialistResult } from './agents/contract';

export interface RouterInput {
  workflowId: string;            // ulid
  workflow: WorkflowKind;        // 'rfi_draft' | 'daily_log_finalize' | 'co_review' | ...
  context: ContextFabricSnapshot;
  invokedBy: { userId: string; role: ProjectRole };
  sessionId: string;             // FK to iris_sessions
}

export interface RouterOutput {
  workflowId: string;
  specialists: SpecialistResult[];
  routingTrace: RoutingTrace;
  totalLatencyMs: number;
  status: 'ok' | 'partial' | 'rejected';
}

export async function routeWorkflow(input: RouterInput): Promise<RouterOutput> { /* ... */ }
```

### 2.2 Dispatch table

The dispatch table is a static `Record<WorkflowKind, SpecialistDispatch>`. No LLM in this path. Each entry declares:

- `requiredSpecialists`: must succeed for workflow to commit
- `optionalSpecialists`: contribute to output but don't gate commit
- `parallelizable`: boolean (defaults `true`; only false when one specialist's output is a hard input to another)
- `mergeFn`: deterministic merger; usually the executor's `assemble()` step

Example entries:

| Workflow | Required | Optional | Parallel? | Latency budget |
|---|---|---|---|---|
| `rfi_draft` | Drafter, CodeAgent | — | yes | 8.0s |
| `co_review` | MoneyAgent | Drafter, CodeAgent | yes | 8.0s |
| `daily_log_finalize` | — (deterministic) | Drafter | n/a | 2.0s |
| `lookahead_synthesis` | ScheduleAgent | Drafter | yes | 8.0s |
| `lien_waiver_chase` | Drafter | — | n/a | 8.0s |
| `submittal_review` | CodeAgent | Drafter | yes | 8.0s |
| `pay_app_review` | MoneyAgent | CodeAgent | yes | 8.0s |
| `owner_status_email` | Drafter, ScheduleAgent | MoneyAgent | yes | 8.0s |

### 2.3 Telemetry

Every router invocation writes to `iris_sessions.tool_calls` (jsonb array, append-only) with shape:

```ts
type ToolCallTrace = {
  ts: string;                    // iso
  specialist: SpecialistName;
  input_hash: string;            // sha256 of normalized input
  determ_check: 'pass' | 'fail' | 'skipped';
  llm_call?: { model: string; in_tokens: number; out_tokens: number; ms: number };
  output_summary: string;        // ≤200 chars, what it produced
  rejection_reason?: string;
};
```

Aggregated nightly into `iris_router_metrics_mv` (materialized view, refreshed by pg_cron at 02:15 UTC) for golden-suite regression tracking.

### 2.4 Routing accuracy gate

A `routing_goldens.json` file (committed, ≥120 cases by exit gate) drives a Vitest suite. Each case is `{ workflow, context, expected_specialists }`. CI fails on <95% match.

---

## 3. Specialist Boundary Contract (ADR-018)

Every specialist implements:

```ts
// src/services/iris/agents/contract.ts

export type RejectionMode = 'auto_withdraw' | 'hold_for_review' | 'hard_fail';

export interface SpecialistAgent<TInput, TOutput> {
  readonly name: SpecialistName;
  readonly version: string;            // semver — bumped invalidates goldens
  readonly latencyBudgetMs: number;    // P95 target; CI gate
  readonly rejectionMode: RejectionMode;
  readonly writeScope: ReadonlyArray<TableName>;  // tables this agent may write; usually []

  /**
   * Cheap deterministic gate. Runs first when possible. If returns ok=false,
   * specialist short-circuits and returns a typed rejection without LLM call.
   */
  deterministicCheck(input: TInput): Promise<DetermCheckResult>;

  /**
   * Narrow LLM scope. Only called if deterministic check passes (or if check
   * is post-LLM verification, called only if LLM completes).
   */
  invoke(input: TInput, ctx: InvocationContext): Promise<SpecialistResult<TOutput>>;
}

export type DetermCheckResult =
  | { ok: true }
  | { ok: false; reason: string; rejection: RejectionMode; details?: unknown };

export interface SpecialistResult<TOutput> {
  specialist: SpecialistName;
  status: 'ok' | 'rejected' | 'partial';
  output?: TOutput;
  rejection?: { mode: RejectionMode; reason: string; details?: unknown };
  latencyMs: number;
  llmUsage?: { model: string; in: number; out: number };
}
```

### 3.1 Why deterministic check is mandatory

Three reasons:

1. **Cost.** A failed math reconciliation is a 5ms Postgres call. Sending the LLM the same data and asking it to "double-check" is a 3s Sonnet call that is also strictly worse at arithmetic.
2. **Auditability.** Deterministic results are reproducible. We can replay them in Phase 9 evals byte-for-byte.
3. **Trust gradient.** A pilot PM can read "MoneyAgent verified the CO totals match the line items (det check pass)" — they can't read an LLM rationale and know it's right.

### 3.2 Write-scope enforcement

`writeScope` is enforced at the data-access layer: a specialist's `invoke()` runs inside a Postgres role (`iris_specialist_drafter`, etc.) whose grants are exactly the listed tables. Out-of-scope writes throw at the DB, not in app code. This is the same pattern used by Phase 1's Role Layer.

---

## 4. The Four Specialists

### 4.1 IrisDrafter — `services/iris/agents/drafter.ts`

**Purpose:** Generates RFI, submittal, owner-email, and lien-waiver-request drafts.

**Deterministic check:**
- Voice linter (`src/services/iris/voice-linter.ts`, shipped Days 43-49) — fails if score <0.85 or any banned-phrase trigger.
- Length budget — fails if `tokens(out) > workflowKind.maxTokens` (RFI 800, owner-email 500, etc.).
- Required-fields check — every draft type has a JSON-schema; missing required fields = rejection.

**LLM scope:** Generates the body text only. Subject lines, recipients, references, and metadata are deterministic upstream.

**Write scope:** `[]` (Drafter never commits; it returns a draft for an executor or a UI to commit).

**Latency budget:** 6.0s P95 (Sonnet-class).

**Rejection mode:** `auto_withdraw`. A failed draft is logged and dropped; the surface either retries with a tighter prompt (max 1 retry) or surfaces "Iris couldn't draft this — open the manual form."

**Sample:**

```ts
export const IrisDrafter: SpecialistAgent<DrafterInput, DrafterOutput> = {
  name: 'drafter',
  version: '2.0.0',
  latencyBudgetMs: 6000,
  rejectionMode: 'auto_withdraw',
  writeScope: [],

  async deterministicCheck(input) {
    const schema = DRAFT_SCHEMAS[input.draftKind];
    const fieldCheck = validateRequiredFields(input.context, schema);
    if (!fieldCheck.ok) {
      return { ok: false, reason: 'missing_required_fields', rejection: 'auto_withdraw', details: fieldCheck.missing };
    }
    return { ok: true };
  },

  async invoke(input, ctx) {
    const prompt = renderDraftPrompt(input);
    const llm = await ctx.llm.complete({ model: 'claude-sonnet-4-7', system: SYSTEM_DRAFTER, user: prompt });
    const draft = parseDraft(llm.content, input.draftKind);

    // Post-LLM verification: voice linter
    const voice = await voiceLinter.score(draft.body, input.context.userVoiceProfile);
    if (voice.score < 0.85 || voice.bannedPhrases.length > 0) {
      return { specialist: 'drafter', status: 'rejected', rejection: { mode: 'auto_withdraw', reason: 'voice_lint_fail', details: voice }, latencyMs: ctx.elapsedMs() };
    }

    return { specialist: 'drafter', status: 'ok', output: draft, latencyMs: ctx.elapsedMs(), llmUsage: llm.usage };
  },
};
```

---

### 4.2 IrisMoneyAgent — `services/iris/agents/money.ts`

**Purpose:** Reads CO line items, pay-app schedules of values, and the project ledger. Verifies math reconciliation. **NEVER generates dollar values.**

This is the strongest constraint in Phase 2 and it is non-negotiable: per Sprint Invariant #2, all money math goes through `src/types/money.ts` (`addCents`, `multiplyCents`, `applyRateCents`, `subtractCents`). The MoneyAgent's deterministic check IS the math reconciliation. The LLM only narrates *why* a discrepancy exists; it does not propose corrected numbers.

**Deterministic check:**

```ts
async deterministicCheck(input: MoneyAgentInput) {
  const { coLineItems, payApp, ledger } = input;
  const computed = coLineItems.reduce(
    (acc, li) => addCents(acc, multiplyCents(li.qtyCents, li.unitRateCents)),
    0n
  );
  const stated = payApp.totalCents;
  const drift = subtractCents(computed, stated);
  if (drift !== 0n) {
    return {
      ok: false,
      reason: 'math_drift',
      rejection: 'hold_for_review',
      details: { computed, stated, drift, lineItemCount: coLineItems.length }
    };
  }
  // Ledger reconciliation
  const ledgerSum = ledger.entries.reduce((a, e) => addCents(a, e.amountCents), 0n);
  if (subtractCents(ledgerSum, stated) !== 0n) {
    return { ok: false, reason: 'ledger_drift', rejection: 'hold_for_review', details: { ledgerSum, stated } };
  }
  return { ok: true };
}
```

**LLM scope:** Given `(co, payApp, ledger, drift_details)`, generate a 1-2 sentence narrative explaining the discrepancy in plain English ("Line 14's unit rate was updated on 09/12 but the SOV wasn't republished — $312.40 drift on the concrete subline"). The narrative is for the human reviewer; it does not enter the commit pathway.

**Write scope:** `[]` (read-only; verification only).

**Latency budget:** 1.5s P95 for det-check-only paths (no LLM); 6.0s when narrative LLM is invoked.

**Rejection mode:** `hold_for_review`. Math drift is never auto-withdrawn — it parks in a reviewer queue. We do not want the system to silently drop a CO mismatch.

**Sample tool call:**

```jsonc
{
  "specialist": "money",
  "input": {
    "workflow": "co_review",
    "coId": "01JFKK3...",
    "coLineItems": [{ "id": "...", "qtyCents": "100", "unitRateCents": "5000000" }, ...],
    "payApp": { "id": "01JFKK4...", "totalCents": "500312400" },
    "ledger": { "entries": [...] }
  },
  "determ_check": "fail",
  "rejection": { "mode": "hold_for_review", "reason": "math_drift", "details": { "drift": "31240" } },
  "llm_call": { "model": "claude-haiku-4-5", "in": 642, "out": 41, "ms": 380 },
  "output_summary": "CO #14 SOV drifts +$312.40 from line items; line 14 rate updated 09/12 not republished."
}
```

---

### 4.3 IrisScheduleAgent — `services/iris/agents/schedule.ts`

**Purpose:** Lookahead synthesis, slip-risk narrative, weather impact summarization. Math is real; narrative is LLM.

**Deterministic check:**
- Float math via existing `src/services/schedule/float.ts` (CPM forward + backward pass).
- Critical-path traversal — fails if no path or cycle detected.
- Schedule-snapshot freshness — fails if last update >7d old (the LLM should not narrate stale data).

**LLM scope:** Narrative only. The numbers (slip days, float consumed, predecessors) come from CPM. The LLM phrases them.

**Write scope:** `[]` (read-only; lookaheads are committed by `LookaheadCommit` executor in Phase 4, not by this agent).

**Latency budget:** 7.0s P95 (CPM is 200ms even on large schedules; LLM dominates).

**Rejection mode:** `auto_withdraw` for stale data; `hold_for_review` for cycle detection (data-quality bug).

**Sample interaction:**

```ts
const cpm = computeCriticalPath(schedule);             // determ
if (!cpm.ok) return { ok: false, reason: 'cycle_or_no_path', rejection: 'hold_for_review' };

const slip = analyzeSlipRisk(cpm, today);              // determ
const narrative = await llm.complete({                 // narrative LLM
  model: 'claude-sonnet-4-7',
  system: SYSTEM_SCHEDULE,
  user: renderSlipPrompt(slip)
});
```

---

### 4.4 IrisCodeAgent — `services/iris/agents/code.ts`

**Purpose:** Validates spec-section, drawing, and code-reference citations. Auto-rejects fabricated citations. Extends existing `verifyCitationSnippet` from IRIS_CITATIONS_SPEC_2026-05-04.md (Days 38-41).

**Deterministic check:**
- Each citation must resolve via `verifyCitationSnippet` (existing). The check is extended in Phase 2 to handle 8 citation kinds (spec section, drawing tag, RFI, submittal, ASTM, IBC, manufacturer doc, prior project precedent).
- Snippet hash-match required: cited text must appear verbatim (whitespace-collapsed) in the source document.
- Source document must be from this project's document set (cross-project citations are rejected).

**LLM scope:** *Optional.* If the upstream draft already includes citations, CodeAgent only verifies — no LLM. If a draft is missing citations and the workflow requires them, CodeAgent invokes a Haiku-class LLM to *propose* citations from the project doc index, which are then re-verified deterministically.

**Write scope:** `[]` (verification only).

**Latency budget:** 1.0s P95 for verify-only; 3.0s for propose+verify.

**Rejection mode:** `hard_fail`. A fabricated citation is not "withdrawn" — it crashes the workflow loud. Phase 9 evals will track citation-fabrication rate as a P0 metric.

**Sample:**

```ts
async invoke(input, ctx) {
  const results = await Promise.all(
    input.citations.map(c => verifyCitationSnippet(c, input.projectDocIndex))
  );
  const fabricated = results.filter(r => r.status === 'no_match');
  if (fabricated.length > 0) {
    return {
      specialist: 'code',
      status: 'rejected',
      rejection: { mode: 'hard_fail', reason: 'fabricated_citation', details: fabricated },
      latencyMs: ctx.elapsedMs(),
    };
  }
  return { specialist: 'code', status: 'ok', output: { verified: results }, latencyMs: ctx.elapsedMs() };
}
```

---

## 5. The Three Hardened Executors

Each executor is a bespoke XState v5 machine. ADR-009 descoped general state-machine wiring; these three are explicit exceptions because they cross the commit boundary and need replay/audit invariants that hand-wired conditionals cannot guarantee.

### 5.1 RfiAutoRoute — `src/services/iris/executors/rfi-auto-route.ts`

Routes a freshly-drafted RFI to the right assignee + cost code + schedule activity, then commits.

**State machine:**

```
                    ┌──────────────┐
                    │   idle       │
                    └──────┬───────┘
                           │ NEW_RFI_DRAFT
                           v
                    ┌──────────────┐
            ┌───────│  routing     │──────────┐
            │       └──────┬───────┘          │
            │              │ all 3 resolved   │ any unresolved
            │              v                  v
            │       ┌──────────────┐   ┌──────────────┐
            │       │  drafting    │   │ hold_review  │
            │       └──────┬───────┘   └──────┬───────┘
            │              │ drafter ok       │ user resolves
            │              v                  v
            │       ┌──────────────┐   ┌──────────────┐
            │       │ verifying    │──>│  routing     │
            │       └──────┬───────┘   └──────────────┘
            │              │ code_agent ok
            │              v
            │       ┌──────────────┐
            │       │ awaiting_gate│
            │       └──────┬───────┘
            │              │ permission_ok
            │              v
            │       ┌──────────────┐
            │       │  committed   │── NEW_RFI ──> rfis table
            │       └──────────────┘
            │              │ contradicted (Phase 1 fabric event)
            │              v
            │       ┌──────────────┐
            └──────>│  withdrawn   │ (auto-withdraw, ADR-007)
                    └──────────────┘
```

**Commit pathway:** On `awaiting_gate → committed`, executor calls `permissionGate.assert({ action: 'rfi.create', userId, projectId })`. If PM role → auto. If foreman → routing pre-fills, but human submits. Commit writes to `rfis`, `iris_actions`, and emits `rfi.created.iris` event.

**Auto-withdraw rules (ADR-007):**
- If schedule activity referenced no longer exists (deleted/renumbered) before commit → withdraw.
- If assignee user deactivated before commit → withdraw.
- If a competing RFI for the same drawing-tag is committed first → withdraw.

**Telemetry:** Each transition logged to `iris_actions`. State-machine snapshot persisted in `iris_actions.context_snapshot`.

---

### 5.2 DailyLogFinalize — `src/services/iris/executors/daily-log-finalize.ts`

Promotes a draft daily log to a finalized record (photos + crews + weather + work-completed). Super (superintendent) is the approval gate.

**State machine:**

```
   ┌──────────┐ DRAFT_READY ┌──────────────┐ assemble ┌──────────────┐
   │  idle    │────────────>│  assembling  │─────────>│ super_review │
   └──────────┘             └──────────────┘          └──────┬───────┘
                                   │                         │ approved
                                   │ missing fields          v
                                   v                  ┌──────────────┐
                            ┌──────────────┐          │  committed   │
                            │ hold_review  │          └──────────────┘
                            └──────────────┘                 │ next-day reopen?
                                                             v
                                                      ┌──────────────┐
                                                      │   reopened   │ (rare; manual)
                                                      └──────────────┘
```

**Assembly contents (deterministic, no LLM):**
- Photos uploaded that day (count + thumbnails)
- Crews on site (from kiosk check-ins)
- Weather (from project location at 08:00 + 14:00 local)
- Work-completed summary (LLM via Drafter — narrative paragraph, ≤120 words)
- Quantities-installed (from production-tracking module, deterministic)

**Commit pathway:** Super opens the daily-log review surface, sees the assembled artifact + Drafter narrative, edits if needed, hits "finalize." PermissionGate (`daily_log.finalize`) asserts. Commit writes to `daily_logs`, marks `status = 'final'`.

**Auto-withdraw:** If no super reviews within 36h, the assembled draft is *not* finalized — it is withdrawn and the surface re-prompts the next morning.

---

### 5.3 LienWaiverChase — `src/services/iris/executors/lien-waiver-chase.ts`

Generates per-sub waiver request, sends, tracks, retries. Office approves first run; auto thereafter.

**State machine:**

```
   ┌──────────┐  PAY_PERIOD  ┌──────────────┐  drafted   ┌──────────────┐
   │  idle    │─────────────>│  drafting    │───────────>│ awaiting_gate│
   └──────────┘              └──────────────┘            └──────┬───────┘
                                                                │ office_ok (1st run)
                                                                │ or auto (2nd+)
                                                                v
                                                         ┌──────────────┐
                                                         │   sent       │
                                                         └──────┬───────┘
                                            ┌────────────┬──────┴───────┬────────────┐
                                            │ received   │ no_response  │ disputed    │
                                            │ <72h       │ ≥72h         │             │
                                            v            v              v             v
                                     ┌──────────────┐ ┌─────────┐ ┌──────────────┐
                                     │  closed      │ │ retried │ │ hold_review  │
                                     └──────────────┘ └────┬────┘ └──────────────┘
                                                           │ ≥3 retries
                                                           v
                                                    ┌──────────────┐
                                                    │ escalated    │
                                                    └──────────────┘
```

**Commit pathway:** Drafter generates email body. Office user approves the first email per sub (PermissionGate `lien_waiver.send`). Subsequent emails to same sub auto-send (`auto_after_first` PermissionGate flag). Each `sent` writes to `iris_actions` and `lien_waiver_requests`.

**Auto-withdraw:**
- If the project closes before waiver received → withdraw + escalate to office.
- If sub is deactivated → withdraw immediately.
- If pay-period changes (corrected pay-app) → withdraw and redraft.

---

## 6. `iris_actions` Audit Log — Migration

```sql
-- migrations/2026-09-01_iris_actions.sql
-- Phase 2 — every executor invocation lands here. Foundation for Phase 9 replay.

CREATE TYPE iris_action_kind AS ENUM (
  'rfi_auto_route',
  'daily_log_finalize',
  'lien_waiver_chase'
);

CREATE TYPE iris_action_state AS ENUM (
  'pending',
  'committed',
  'withdrawn',
  'held_for_review',
  'failed'
);

CREATE TABLE iris_actions (
  id              text PRIMARY KEY,                    -- ulid
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id      text NOT NULL REFERENCES iris_sessions(id),
  action_kind     iris_action_kind NOT NULL,
  workflow_id     text NOT NULL,                       -- groups multi-step workflows
  invoked_by      uuid NOT NULL REFERENCES users(id),
  invoked_role    project_role NOT NULL,
  intent          text NOT NULL,                       -- ≤500 chars, what user asked for
  context_snapshot jsonb NOT NULL,                     -- Context Fabric snapshot at t0 (Phase 1)
  tool_calls      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ToolCallTrace[]
  output          jsonb,                               -- specialist outputs merged
  final_state     iris_action_state NOT NULL DEFAULT 'pending',
  reviewer_id     uuid REFERENCES users(id),           -- nullable until reviewed
  reviewer_action text,                                -- 'approved' | 'edited' | 'rejected'
  committed_row_id text,                               -- FK target row (rfis.id, daily_logs.id, etc.)
  committed_table  text,                               -- name of table of committed_row_id
  withdraw_reason text,                                -- ADR-007 reason code
  latency_total_ms int NOT NULL,
  llm_tokens_in   int NOT NULL DEFAULT 0,
  llm_tokens_out  int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_iris_actions_project_kind_state ON iris_actions(project_id, action_kind, final_state);
CREATE INDEX idx_iris_actions_session ON iris_actions(session_id);
CREATE INDEX idx_iris_actions_invoked_by ON iris_actions(invoked_by, created_at DESC);
CREATE INDEX idx_iris_actions_committed_row ON iris_actions(committed_table, committed_row_id) WHERE committed_row_id IS NOT NULL;

-- RLS
ALTER TABLE iris_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY iris_actions_project_member ON iris_actions
  FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY iris_actions_insert_self ON iris_actions
  FOR INSERT
  WITH CHECK (invoked_by = auth.uid());

CREATE POLICY iris_actions_update_self_or_reviewer ON iris_actions
  FOR UPDATE
  USING (invoked_by = auth.uid() OR reviewer_id = auth.uid());

-- Retention: ADR-008 → 12mo default, 24mo for is_soft_pilot
CREATE POLICY iris_actions_retention_purge ON iris_actions
  FOR DELETE
  USING (
    created_at < CASE
      WHEN (SELECT is_soft_pilot FROM projects WHERE id = iris_actions.project_id)
      THEN now() - interval '24 months'
      ELSE now() - interval '12 months'
    END
  );

-- Materialized view for nightly metrics (refreshed by pg_cron 02:30 UTC)
CREATE MATERIALIZED VIEW iris_actions_daily_mv AS
SELECT
  date_trunc('day', created_at) AS day,
  action_kind,
  final_state,
  count(*) AS n,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_total_ms) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_total_ms) AS p95_ms,
  sum(llm_tokens_in)  AS tokens_in,
  sum(llm_tokens_out) AS tokens_out
FROM iris_actions
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX ON iris_actions_daily_mv (day, action_kind, final_state);
```

### 6.1 Replay contract

`iris_actions.context_snapshot + tool_calls + intent` is a complete replay payload. Phase 9 evals will:

1. Load a historical action.
2. Re-run the router against the snapshot.
3. Diff specialists' outputs against the recorded ones.
4. Flag drift (model regression).

This is why `context_snapshot` is mandatory and why `tool_calls` is append-only.

---

## 7. PermissionGate-AI Integration

Every executor's commit step routes through PermissionGate. The integration is one-line:

```ts
await permissionGate.assert({
  action: 'rfi.create',           // permission key
  userId: ctx.invokedBy.userId,
  projectId: ctx.projectId,
  via: 'iris_executor',           // NEW: marks AI-mediated commit
  irisActionId: irisAction.id,    // NEW: FK back to iris_actions
});
```

Two new fields (`via`, `irisActionId`) are added to PermissionGate's invocation log. These let the audit-coverage gate (`scripts/audit-permission-gate.mjs`, extended for AI commits per RFI_BUGATTI_POLISH_RECEIPT_2026-05-07.md) verify that **every** `iris_actions` row with `final_state='committed'` has a matching PermissionGate log entry with `via='iris_executor'`.

CI fails if any commit slips past. The check runs nightly against the prior 24h of actions.

```js
// scripts/audit-iris-permission-coverage.mjs (sketch)
const committed = await db.query(`SELECT id FROM iris_actions WHERE final_state='committed' AND created_at > now() - interval '24 hours'`);
const gated = await db.query(`SELECT iris_action_id FROM permission_gate_log WHERE via='iris_executor' AND ts > now() - interval '24 hours'`);
const gap = committed.filter(c => !gated.find(g => g.iris_action_id === c.id));
if (gap.length > 0) { process.exit(1); }
```

---

## 8. Test Plan

### 8.1 Golden suite

`tests/iris/goldens/router.json` — ≥120 cases. Each case:

```jsonc
{
  "id": "router-001",
  "workflow": "co_review",
  "context_fabric_fixture": "fixtures/cf/co-with-drift.json",
  "expected_specialists": ["money", "drafter", "code"],
  "expected_required_pass": ["money"],
  "expected_states": { "money": "rejected" }
}
```

Vitest runs nightly. Fail on <95% match (exit gate).

### 8.2 Adversarial suite

- **Fabricated citations:** Inject an LLM-generated citation that does not exist. CodeAgent must hard-fail.
- **Math drift:** Inject a $0.01 drift on a $5M CO. MoneyAgent must catch.
- **Stale schedule:** Inject a 14d-old schedule snapshot. ScheduleAgent must auto-withdraw.
- **Voice violation:** Inject a draft with banned phrases. Drafter must auto-withdraw.
- **Permission violation:** Invoke a commit as an unauthorized role. PermissionGate must reject; `iris_actions.final_state` must be `failed`, not `committed`.
- **Race:** Two executors target the same RFI draft. The losing one must auto-withdraw.

### 8.3 Latency budget tests

Vitest perf suite asserts P95 latencies on a synthetic 1000-call workload:

| Path | Budget | Gate |
|---|---|---|
| Router dispatch (no specialists) | 50ms | hard |
| MoneyAgent (det-only) | 1.5s | hard |
| CodeAgent (verify-only) | 1.0s | hard |
| Drafter | 6.0s | hard |
| ScheduleAgent (with narrative) | 7.0s | hard |
| Full `co_review` workflow | 8.0s | hard |
| Full `daily_log_finalize` | 2.0s | hard |

CI fails if any budget exceeded over 1000-call sample.

### 8.4 Replay tests

Load 100 historical `iris_actions` from staging. Re-run. Diff. Drift > 5% on any field fails CI.

---

## 9. Migration Order

1. **T-240 week 1** (Sep 1-7 2026): Land `iris_actions` migration + RLS + retention policies. Land PermissionGate `via`/`irisActionId` columns. No executors yet.
2. **T-240 week 2** (Sep 8-14): Ship `services/iris/agents/contract.ts` + IrisDrafter + IrisCodeAgent (smallest scope). Wire to existing draft surfaces; replace direct LLM calls with specialist calls.
3. **T-240 week 3** (Sep 15-21): Ship IrisMoneyAgent + IrisScheduleAgent. Ship IrisRouter with dispatch table. Ship golden suite (start with 60 cases; grow to 120 by exit).
4. **T-240 week 4** (Sep 22-28): Ship RfiAutoRoute executor (lowest commit risk; routing only, RFI body already drafted). Behind `iris.executors.rfi_auto_route` flag.
5. **T-225 week 1** (Sep 29 - Oct 5): Ship DailyLogFinalize. Behind flag. Soft-pilot opt-in.
6. **T-220 week 1** (Oct 6-12): Ship LienWaiverChase. Behind flag. Office-only first run.
7. **T-215 week 1** (Oct 13-19): Audit-coverage gate live. Replay tests live. Latency CI live.
8. **T-210** (Oct 20-26): Exit gate evaluation. Flip flags on for soft pilot.

Total: 8 weeks. The 4 weeks before Lap 3 starts are spec/design only — no code yet.

---

## 10. Risks + Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Specialist latency stacks (router fans out 3, slowest dominates) | High | Hard P95 gates per specialist + per-workflow. Parallelize with `Promise.allSettled`. Use Haiku for non-reasoning subtasks. |
| Executor commits incorrectly | Critical | Auto-withdraw policy (ADR-007). PermissionGate gate on every commit. Audit-coverage CI gate. |
| MoneyAgent generates dollar values despite the contract | Critical | Write-scope = `[]`. LLM prompt includes "you may not propose corrected numbers." Lint rule on agent file rejects `addCents`/`multiplyCents` import. |
| CodeAgent under-rejects fabricated citations | High | `hard_fail` rejection mode. Phase 9 evals track fabrication rate as P0. Snippet-hash match required. |
| Replay drift goes undetected | Medium | Nightly replay suite on 100 historical actions. Drift > 5% fails CI. |
| Goldens go stale | Medium | Golden version bump on specialist version bump. Vitest suite refuses to run with mismatched versions. |
| PermissionGate bypass (executor calls DB directly) | Critical | Postgres role per specialist with grants enforcing read-only / no-write. Direct write throws at DB. |
| Router dispatch table grows unbounded | Low | Workflow kinds enumerated in TS union. Adding a kind requires a goldens entry — CI gate. |

---

## 11. Edge Cases

1. **Two executors target the same draft.** First-writer-wins on `iris_actions(workflow_id) UNIQUE`. Second auto-withdraws.
2. **PermissionGate denies after specialists run.** All specialist work is sunk cost; output is logged but not committed. `final_state = 'failed'` with reason `permission_denied`.
3. **LLM returns malformed JSON.** Drafter's deterministic post-check (schema validate) fails. Auto-withdraw, retry once with stricter prompt, then surface manual form.
4. **Context Fabric snapshot is stale by commit time.** ScheduleAgent's freshness check catches schedule drift. Other executors recheck Context Fabric `revision_id` at commit; if mismatch, auto-withdraw.
5. **Soft-pilot project, telemetry retention 24mo, but project deleted.** ON DELETE CASCADE removes `iris_actions`. Replay corpus protected by separate `iris_actions_replay_corpus` snapshot table (out of scope; Phase 9).
6. **MoneyAgent finds drift on a CO already approved by owner.** Still flags — does not auto-correct. Surfaces to office for back-charge or RFI.
7. **Drafter generates a draft that voice-lints to 0.84 (just under threshold).** Auto-withdraw. We do not soften the threshold; we improve the prompt.
8. **CodeAgent verifies a citation that resolves to a doc the user lacks permission to see.** Citation is hidden from output; specialist returns `partial`. Not a fabrication, but not surfaceable.
9. **Lien-waiver sub email bounces.** Executor transitions `sent → no_response`, retry counter increments. After 3, → `escalated`.
10. **Daily log finalized but later contradicted by a corrected weather record.** ADR-007 says never auto-update. Surfaces a "weather correction" RFI; daily log row remains as-finalized.

---

## 12. Exit Gate — CI Workflow Stub

```yaml
# .github/workflows/phase-2-exit-gate.yml
name: phase-2-exit-gate
on:
  pull_request:
    paths:
      - 'src/services/iris/**'
      - 'docs/audits/PHASE_2_*'
  schedule:
    - cron: '0 7 * * *'   # nightly
jobs:
  router-goldens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:iris:goldens
      - run: npm run test:iris:goldens -- --reporter=json | node scripts/check-goldens-pass-rate.mjs --min 0.95
  executor-acceptance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: node scripts/iris-executor-acceptance.mjs --window 7d --min 0.85
      # Reads iris_actions.daily_mv. Fails if any of the 3 executors has <85% auto-approval over rolling 7d.
  latency-budget:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:iris:latency
  audit-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node scripts/audit-iris-permission-coverage.mjs --window 24h
  replay-drift:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: node scripts/iris-replay-drift.mjs --sample 100 --max-drift 0.05
```

**Exit gate criteria (all must hold):**
- Router goldens ≥95% pass over 120-case suite.
- 3 executors ≥85% auto-approval rate over rolling 7 days of pilot data.
- Latency budgets met at P95 across all specialist + workflow paths.
- Audit-coverage gate green (every committed `iris_action` has matching PermissionGate log).
- Replay drift <5% on 100-action sample.

---

## 13. Dependencies + Sequencing

**Hard blockers:**
- Phase 1 complete (Role Layer + Context Fabric). Specialists consume Context Fabric snapshot. Without it, MoneyAgent has no ledger access; CodeAgent has no project doc index.
- ADR-018 (Specialist Sub-Agent Boundary Contract) ratified. The TS interface in §3 IS ADR-018 in skeleton form; Walker signs it before code lands.
- `iris_voice_diffs` shipped (Days 43-49 of Lap 2, already in flight). Drafter consumes it via voice linter.

**Soft dependencies:**
- IRIS_CITATIONS_SPEC (Days 38-41 Lap 2) — `verifyCitationSnippet` is the seed for CodeAgent's deterministic check. Phase 2 extends it to 8 kinds.
- ADR-007 (auto-withdraw) — the policy this phase extends from drafts to commits.
- ADR-009 (state machines descoped, except 3) — this phase declares the 3 exceptions.
- ADR-008 (telemetry retention) — `iris_actions` follows the 12mo / 24mo (soft pilot) policy.
- Sprint Invariant #2 (money math via `src/types/money.ts`) — MoneyAgent IS the enforcement at the AI boundary.

**Parallel work that does not block but should align:**
- Phase 3 (Long-horizon memory) starts spec at T-210 (this phase's exit). Memory writes will be triggered by `iris_actions.final_state='committed'` events.
- Phase 9 (Replay/evals) consumes `iris_actions`. Schema must freeze by T-220.

**Sequencing summary:**

```
T-300 (Lap 2 close)  ─── Phase 1 complete ─────────┐
                                                    │
T-270  ─── ADR-018 ratified ────────────────────────┤
                                                    │
T-240 ─── Phase 2 build start ──────────────────────┤
                          │                         │
                          ├─ migrations + contract  │
                          ├─ Drafter + CodeAgent    │
                          ├─ MoneyAgent + Schedule  │
                          ├─ Router + goldens       │
                          ├─ RfiAutoRoute           │
                          ├─ DailyLogFinalize       │
                          ├─ LienWaiverChase        │
                          └─ CI gates               │
                                                    │
T-210 ─── Phase 2 exit gate ──────── Phase 3 start ─┘
```

---

## 14. Footer

**Author:** Claude (subagent), commissioned by Walker, 2026-05-08
**Reviewer:** Walker (sign-off pending; expected by T-270)
**Replaces:** None (new spec)
**Supersedes:** None
**Cross-refs:**
- ADR-007 (auto-withdraw policy) — extended to executor commits
- ADR-009 (state machines descoped) — 3 exceptions declared here
- ADR-018 (specialist sub-agent boundary contract) — embodied in §3 TS interface
- IRIS_NATIVENESS_PLAN_2026-05-08.md — this is Phase 2 of 9
- PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md — direct upstream
- REVERSE_ENGINEERED_MILESTONES_2026-05-04.md — T-240 milestone "Iris graduates from drafter to actor"
- IRIS_CITATIONS_SPEC_2026-05-04.md (Days 38-41) — CodeAgent seed
- IRIS_VOICE_GUIDE_SPEC_2026-05-04.md (Days 43-49) — Drafter seed
- RFI_BUGATTI_POLISH_RECEIPT_2026-05-07.md — audit-coverage gate pattern
- Sprint Invariant #2 (money math) — MoneyAgent enforcement boundary
- `src/types/money.ts` — the only legal money math API

**Next phase:** PHASE_3_LONG_HORIZON_MEMORY_SPEC_2026-05-08.md (memory writes triggered by `iris_actions.final_state='committed'`)

**End of spec.**
