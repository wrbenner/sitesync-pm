# IRIS Phase 2 — Specialist Sub-Agents (Spec)

**Date:** 2026-05-08
**Status:** Draft. Targeted for Lap 3 second half (~Sep–Oct 2026, T-240 → T-210 window per `REVERSE_ENGINEERED_MILESTONES_2026-05-04.md`).
**Author:** Walker (with Claude as drafting partner).
**Companion plan:** `IRIS_NATIVENESS_PLAN_2026-05-08.md` §7 — Phase 2.
**Format reference:** `IRIS_TELEMETRY_SPEC_2026-05-04.md`, `IRIS_CITATIONS_SPEC_2026-05-04.md`.
**Blocks:** Phase 3 (Universal Knowledge Absorption) — `IrisCodeAgent` consumes Phase 3's KB; Phase 4 (Per-Page Coverage) — Insight Slots consume specialist outputs. Phase 1 (Role Layer + Context Fabric v0) is a hard prerequisite — specialists pull from `contextFabric.ts`, not from caller-supplied `system=`.
**Reuses:** Cancel-window pattern from `AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md`; money math invariant from `src/types/money.ts`; pg_cron + pgmq + edge-fn worker pattern from `ADR_003_HYBRID_CRON_2026-05-04.md` and `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md`; auto-withdraw policy from `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md`; citation contract from `IRIS_CITATIONS_SPEC_2026-05-04.md`.
**ADR introduced:** ADR-018 — Specialist Sub-Agent Boundary Contract (inline §6).

---

## 1. Status

**Draft.** Ratified once Phase 1 (Role Layer + Context Fabric v0) is shipped and the foreign-key contract from `IrisContext` is locked. Intent is for this spec to be the design document the engineer #2 hire reads on day 1 of Phase 2 build.

Calendar window:

| Marker | Date (calendar) | T-X | Phase 2 milestone |
|---|---|---|---|
| Phase 2 open | 2026-09-15 | T-228 | Day 1: scaffold the 4 specialist classes + router |
| Mid-phase gate | 2026-10-01 | T-211 | Days 17–20 — IrisCodeAgent + KB-stub fallback |
| Phase 2 close | 2026-10-15 | T-197 | Days 26–30 — goldens + telemetry + exit gate |

Phase 2 is exactly 30 working days inside Lap 3. It runs in parallel with the Procore audit-chain certification work (T-195) but does not touch its files; the only shared surface is `iris_actions` audit-log writes, which the audit-chain cert already inspects.

---

## 2. Why specialists, not one mega-agent

Three lessons converge on this decision.

**Lesson 1 — Hippocratic / Sierra: specialist sub-agents shrink the safety surface.** A single mega-prompt that drafts an RFI, computes pay-app math, traverses the schedule's critical path, and resolves spec citations is a single point of failure. One regression in the system prompt regresses all four. One adversarial input route that bypasses the math guardrail bypasses everything. The Hippocratic Polaris architecture (a primary supervisor + a constellation of narrowly-scoped clinical specialists) shipped because each specialist was small enough to test exhaustively. Sierra's published "evals as code" pattern requires the same: each agent has a finite tool surface and a finite prompt surface. SiteSync's safety surface today (one Iris prompt over four very different problem domains) is too large to test exhaustively. Phase 2 cuts it into four smaller surfaces.

**Lesson 2 — Sprint Invariant #2: all money math goes through `src/types/money.ts`.** The invariant is currently enforced in non-AI code paths. The moment Iris narrates pay-app math, the invariant is at risk: an LLM token-decoded to `12.42` in the middle of a budget summary is a violation, even if the user only sees it for a second. The only safe pattern is a **deterministic specialist** that reads cents from the DB, computes the math through `addCents/multiplyCents/applyRateCents`, and gives the LLM the *post-computation result* to wrap in narrative. The LLM never sees raw dollars or computes math; it composes prose around verified cents values. This is non-negotiable.

**Lesson 3 — Schedule reasoning has its own ontology.** CPM (Critical Path Method), float, lookaheads, free vs. total slack, weather-sensitive activities, variance against baseline — these are not generalist-LLM concepts. A generalist LLM gets float wrong about half the time when the network is non-trivial. A deterministic schedule specialist (CPM math + topological walk + slack computation) is right 100% of the time. The narrative wrapper goes to the LLM; the math goes to deterministic code.

The same logic applies to code references (OSHA, building code, contract clauses): retrieval + verification is deterministic; synthesis is LLM. The specialist boundary is **always the line between "must be right" (deterministic) and "must read well" (LLM).**

A second-order benefit: specialists are independently swappable. When OpenAI ships a better summarizer, the Drafter upgrades; the Money Agent doesn't move. When pg_trgm + the Phase 3 KB beats vector retrieval at exact spec lookups, the Code Agent's retrieval swaps; the Drafter doesn't move. **Coupling is the enemy of safe iteration.**

---

## 3. The 4 specialists

Each specialist exposes the same interface (§6 ADR-018) and ships with: deterministic check function, LLM scope, write scope, latency budget, audit log fields, model choice, and tool allow-list. Specialists never call each other directly — they're orchestrated by the Router (§4).

### 3.1 IrisDrafterAgent

**Scope.** Drafts RFIs, submittal responses, daily logs, OAC weekly summaries, owner monthly updates. The "competent communication drafter" pattern that ships today (`src/services/iris/drafts.ts` + `templates.ts`) — generalized.

**Service file:** `src/services/iris/agents/drafter.ts`

**Deterministic check.** Voice linter (`src/lib/iris/voiceLinter.ts`, existing) + length budget (per draft type, per `templates.ts`) + citation presence check (carry-forward from `IRIS_CITATIONS_SPEC` Phase 3 — every draft must cite ≥1 source per `draftAction.ts`).

**LLM scope.** Generation. Sonnet-class for production drafts; Haiku-class fallback for non-critical surfaces (e.g., draft preview tooltips).

**Write scope.** `drafted_actions` only (the existing path). NEVER writes to source-of-truth tables (RFI, submittal, daily_log) directly. Hand-off to executors (§5) is the only path to source-of-truth writes.

**Latency budget.** P95 ≤ 6.0s end-to-end (router-in to drafter-out). Includes context fabric build, model call, voice lint, citation verification.

**Audit log fields.** `specialist_name='drafter'`, `model_id`, `prompt_tokens`, `completion_tokens`, `voice_lint_passed`, `voice_lint_fixes_applied`, `citations_verified`, `draft_id`.

**Model choice.** Sonnet-class for `rfi`, `submittal_response`, `owner_update`, `weekly_oac`. Haiku-class for `daily_log`, `tooltip_preview`, `inbox_subject_line`. The split is per-template, declared in `templates.ts`.

**Tool allow-list:** `contextFabric.read`, `templates.render`, `voiceLinter.lint`, `citationVerify.snippet`, `draftAction.create`. Cannot read or write to `rfis`, `submittals`, `daily_logs`, `change_orders`, `pay_apps`, `schedule_activities`, `budget_items`.

### 3.2 IrisMoneyAgent

**Scope.** Budget vs. ledger reconciliation, change-order math verification, pay-app validation, billing roll-ups, schedule of values audits. The line between "AI tells me what the number is" (DANGEROUS) and "AI tells me whether the number is right" (SAFE) — and we ship only the latter.

**Service file:** `src/services/iris/agents/money.ts`

**Deterministic check.** ALL math through `src/types/money.ts`. No `Number * Number` on dollar amounts. The agent receives cents as input, computes through `addCents`, `subtractCents`, `multiplyCents`, `applyRateCents`, and returns cents as output. Three safety walls:

1. Input gate: refuse to process any payload that fails `isCents(value)` on every monetary field.
2. Computation gate: every arithmetic op routes through one of the 5 helpers in `money.ts`. CI lint (extended in Phase 2 Day 1) enforces.
3. Output gate: any cents value to be displayed runs through `centsToDisplay()`; the LLM narrative receives the formatted string, not the raw value.

**LLM scope.** Narrative wrappers ONLY. The agent computes the math first (deterministic), then asks the LLM to "describe these numbers in plain language" with the verified cents values pre-formatted. The LLM never sees a raw dollar value to compute, never multiplies or adds, and never proposes a number. If the LLM emits a digit pattern (`\$\d`) outside the pre-formatted bracket, the deterministic check rejects the output.

**Write scope.** Read-only on source-of-truth (`change_orders`, `pay_apps`, `budget_items`, `cost_codes`, `transactions`). Writes to `iris_actions` audit log + `drafted_actions` (for Drafter hand-off). Hand-off to `co_pricing_attach_executor` (§5.2) is the only path to a CO update.

**Latency budget.** P95 ≤ 4.0s. Math is fast; the latency is dominated by row reads and the (small) narrative LLM call.

**Audit log fields.** `specialist_name='money'`, `entities_read` (array of `{table, id}`), `cents_inputs` (array of `{label, cents}`), `cents_outputs` (array), `discrepancies_flagged` (array), `narrative_model_id`, `discrepancy_total_cents`.

**Model choice.** Deterministic-only for the math. Haiku-class for the narrative wrapper (a 50–150 token summary; small surface, small model).

**Tool allow-list:** `contextFabric.read`, `money.{addCents,subtractCents,multiplyCents,applyRateCents}`, `db.read.{change_orders,pay_apps,budget_items,cost_codes,transactions,schedule_of_values}`, `centsToDisplay`. Cannot write to source-of-truth tables. Cannot read `auth.users` directly.

**Sprint invariant tie-in.** This specialist is the answer to "how does AI safely participate in money workflows under Sprint Invariant #2." If we ship Phase 2 without this agent, Money & schedule remain LLM-prohibited. With this agent, they're LLM-eligible behind a deterministic gate.

### 3.3 IrisScheduleAgent

**Scope.** Weather impact narration, lookahead deltas, float consumption, milestone risk, slip-risk synthesis. Schedule has its own ontology (CPM, predecessors, lag, free vs. total slack); generalist LLMs muddle these. We ship deterministic CPM math + LLM narrative.

**Service file:** `src/services/iris/agents/schedule.ts`

**Deterministic check.** CPM math + topological walk + slack computation in TypeScript. Reuses the existing weather detector (`src/services/iris/insights.ts` — weather kind) and adds a CPM module. Inputs: schedule activities + dependencies + baseline + actuals + weather forecast. Outputs: free slack per activity, total float per activity, critical path, weather-sensitive activities at risk in next 5 days.

**LLM scope.** Narrative summary of the deterministic outputs. "Three activities on the critical path consume float in the next 7 days. Activity #142 (concrete pour, Floor 3) is weather-blocked Mon–Tue per NOAA." The LLM never invents a float number, never proposes a critical-path member, never moves an activity.

**Write scope.** Read-only on `schedule_activities`, `schedule_dependencies`, `schedule_baselines`, `schedule_actuals`, `weather_forecasts`. Writes to `iris_actions` audit log + `drafted_actions`. Hand-off to `schedule_lookahead_publish_executor` (§5.3) is the only path to publishing a 2-week lookahead.

**Latency budget.** P95 ≤ 5.0s. CPM walk on a 500-activity schedule is < 200ms in pure TS; the rest is the narrative LLM call.

**Audit log fields.** `specialist_name='schedule'`, `cpm_walk_duration_ms`, `critical_path_activity_count`, `weather_at_risk_count`, `narrative_model_id`, `slack_distribution` (p50/p95 cents-equivalent total float days).

**Model choice.** Deterministic for CPM math. Haiku-class for the narrative.

**Tool allow-list:** `contextFabric.read`, `cpm.computeFloat`, `cpm.computeCriticalPath`, `cpm.findWeatherAtRisk`, `db.read.{schedule_activities,schedule_dependencies,schedule_baselines,schedule_actuals,weather_forecasts}`. Cannot move an activity, cannot edit a baseline, cannot publish a lookahead — only the executor (§5.3) can, and only behind cancel-window approval.

### 3.4 IrisCodeAgent

**Scope.** OSHA references, building code lookups, contract clause retrieval, spec section retrieval, AIA contract templates. The "verify the citation, never invent the citation" specialist.

**Service file:** `src/services/iris/agents/code.ts`

**Deterministic check.** Vector retrieval + keyword retrieval over the Phase 3 knowledge base, AND `verifyCitationSnippet` (existing, from `IRIS_CITATIONS_SPEC` Phase 4). Every output cites the source clause; if the snippet substring-match fails, the agent refuses to emit. Phase 2 ships a stub KB (5,000 hand-curated clauses across OSHA Subpart C, IBC §1604–1606, AIA A201 §1–11, common spec sections); Phase 3 swaps in the full pgvector-backed KB without changing the agent's contract.

**LLM scope.** Synthesis. The agent retrieves (deterministic), verifies (deterministic), then asks the LLM to "summarize these N clauses in answer to question Q." The LLM never invents a clause, never paraphrases law in a way that loses citation linkage.

**Write scope.** Read-only on the KB. Writes to `iris_actions` audit log + `drafted_actions`. Never writes to source-of-truth tables.

**Latency budget.** P95 ≤ 5.0s. Retrieval ~500ms; verification ~200ms; LLM synthesis ~3s.

**Audit log fields.** `specialist_name='code'`, `kb_query`, `retrieved_chunk_count`, `verified_chunk_count`, `synthesis_model_id`, `cited_chunk_ids[]`.

**Model choice.** Deterministic for retrieval and verification. Sonnet-class for synthesis (legal/code language is high-precision; Haiku regresses).

**Tool allow-list:** `contextFabric.read`, `kb.vectorRetrieve`, `kb.keywordRetrieve`, `citationVerify.snippet`, `db.read.kb_chunks`. Cannot write to KB. Cannot read source-of-truth tables (only the KB and the entity in question via context fabric).

---

## 4. Router pattern

One Router, one entrypoint, one decision function.

**Service file:** `src/services/iris/router.ts`

**Public interface:**

```typescript
import type { IrisContext } from './contextFabric'

export type SpecialistName = 'drafter' | 'money' | 'schedule' | 'code'

export interface SpecialistRoute {
  specialist: SpecialistName
  confidence: number          // 0..1, deterministic regex/keyword score; LLM-fallback fills in for ambiguous cases
  reason: string              // human-readable; surfaces in audit log
  fallback?: SpecialistName   // if primary returns deterministic_check_failed, try fallback
}

export interface IrisInvocation {
  ctx: IrisContext
  intent: string              // free-text user query OR workflow event tag (e.g., 'cron:weekly_oac')
  source: 'user_chat' | 'workflow_button' | 'cron_detector' | 'insight_slot'
}

export function routeInvocation(inv: IrisInvocation): SpecialistRoute
```

**Routing strategy.** Deterministic-first.

1. **Workflow tag match.** If `intent` is a workflow event (`cron:weekly_oac`, `button:rfi_draft`, `insight:weather_lookahead`), the workflow tag → specialist mapping is a static table. Confidence = 1.0.

2. **Regex / keyword classifier.** For free-text user queries, apply a 30-rule regex bank (e.g., `/budget|cost|change\s*order|pay\s*app|cents|reconcile/i` → `money`). Confidence = match-length-normalized score, 0.0..0.95. Anything ≥ 0.6 routes deterministically.

3. **LLM fallback.** Below 0.6 confidence, invoke a Haiku-class classifier with a structured prompt: "Here's the user query and 2-line context. Pick one of: drafter, money, schedule, code, or unknown." Returned confidence = the model's self-reported confidence (clamped 0.5..0.85; LLM cannot self-report > 0.85 to keep deterministic routing the high-confidence path).

4. **Unknown.** If both rule-based and LLM fallback return `unknown`, the router routes to `drafter` with a reason of "fallback to drafter — no specialist match" and confidence 0.4. The drafter then asks the user a clarifying question.

**Routing telemetry.** New columns on `iris_invocations` (introduced in Phase 1, extended here):

```sql
ALTER TABLE iris_invocations
  ADD COLUMN specialist_name TEXT
    CHECK (specialist_name IN ('drafter', 'money', 'schedule', 'code')),
  ADD COLUMN route_chosen TEXT NOT NULL,
  ADD COLUMN route_confidence NUMERIC(3, 2)
    CHECK (route_confidence BETWEEN 0 AND 1),
  ADD COLUMN route_method TEXT
    CHECK (route_method IN ('workflow_tag', 'regex', 'llm_fallback', 'unknown_fallback')),
  ADD COLUMN route_overridden_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN deterministic_check_passed BOOLEAN,
  ADD COLUMN executor_invoked TEXT,
  ADD COLUMN cancel_window_used BOOLEAN NOT NULL DEFAULT FALSE;
```

The user override path: every Iris response includes a small "switch specialist" affordance (a chip showing the chosen specialist with a dropdown). When the user switches, `route_overridden_by_user=TRUE` plus the new specialist gets logged. Override rate is a leading indicator of router miscalibration.

**Goldens.** A 200-question routing test set lives at `e2e/iris-router-goldens.spec.ts`. Each row:

```typescript
{ query: string, expected_specialist: SpecialistName, min_confidence: number, source: 'user_chat' | ... }
```

Distribution: 50 each of money / schedule / code / drafter; 20 ambiguous edge cases. CI gate: ≥95% correct routing on the 200-Q set. Below 95% → block deploy.

---

## 5. The 3 hardened executors

Phase 2 ships exactly 3 executors. They are the **first AI code paths that write to source-of-truth tables.** Every one wraps the cancel-window pattern from `AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md`.

The criteria for picking 3 (vs. 5 or 10): high value to soft pilot (Brad Cameron, Carleton), low risk if a write goes wrong, reversible failure mode. The 3 chosen all satisfy all three.

### 5.1 rfi_create_executor

**What it commits.** Drafted RFI → submitted RFI. Promotes a `drafted_actions` row of type `rfi_draft` to a real RFI row in the `rfis` table.

**Source specialist.** `IrisDrafterAgent`. The drafter produces the draft + citations + suggested assignee + suggested cost code; the executor commits when approval is granted.

**Write scope.** INSERT into `rfis`, INSERT into `rfi_messages` (the question body), UPDATE `drafted_actions` (status to `'executed'`).

**Approval gate.** PermissionGate on the user (per Sprint Invariant #5 — RFI touches money via cost-code linkage). Cancel-window default 60s per `AUTO_EXECUTE_CANCEL_WINDOW_SPEC` for users who have opted into auto-execute; otherwise standard approve/reject in the inbox.

**Dry-run mode.** `executor_runs.dry_run=TRUE` writes to a shadow row `rfis_shadow` with `is_shadow=TRUE`, never visible to non-engineering users. Used in goldens; never on a production project. The shadow table mirrors the real `rfis` schema 1:1.

**Audit log fields.** `executor_name='rfi_create'`, `drafted_action_id`, `committed_rfi_id`, `cost_code_id`, `assignee_user_id`, `was_human_cancelled` (per cancel-window spec), `latency_ms`.

**Rollback path.** Before commit: delete the shadow row, no DB state change. Mid-commit (between INSERTs): wrapped in a single transaction; ROLLBACK on error. Post-commit: `withdrawRfi(rfi_id, reason)` is the rollback path; sets `rfis.status='withdrawn'`, leaves the row for audit. The audit chain documents the withdraw.

**RLS implications.** The executor runs as `SECURITY DEFINER` because the cron worker isn't the user. It must verify the user's project membership before INSERT. Pattern from `record_draft_view` in `IRIS_TELEMETRY_SPEC`.

### 5.2 co_pricing_attach_executor

**What it commits.** `IrisMoneyAgent` computes a CO's priced version (line items × unit prices × markup × tax = total cents); user approves; executor attaches the priced version as the next revision on the change order.

**Source specialist.** `IrisMoneyAgent`. The agent reads CO line items + applies cost-code unit prices + applies firm markup + tax, produces a cents total, then the drafter wraps narrative.

**Write scope.** INSERT into `change_order_revisions` (a new revision row with the priced amounts), UPDATE `change_orders.current_revision_id`, INSERT into `iris_actions`. NEVER updates `change_orders.amount` directly — always through a revision.

**Approval gate.** PermissionGate (`change_orders.write` permission, audit-coverage gate enforced — ref `RFI_BUGATTI_POLISH_RECEIPT_2026-05-07.md`). Cancel-window: opt-in per user, default 60s. **Money agent's deterministic check must pass before the user even sees the draft.** If the math doesn't reconcile (e.g., line item totals don't sum to header), the executor refuses to enqueue and surfaces the discrepancy.

**Dry-run mode.** Computes the revision, writes to `change_order_revisions_shadow`, never touches the real `change_orders` table.

**Audit log fields.** `executor_name='co_pricing_attach'`, `change_order_id`, `revision_id`, `total_cents`, `line_item_count`, `markup_pct`, `tax_pct`, `discrepancy_cents` (always 0 if it committed; non-zero would have refused).

**Rollback path.** Before commit: discard shadow row. Mid-commit: transaction ROLLBACK. Post-commit: revisions are append-only by design — to "undo," create a new revision that supersedes. The audit chain shows both. Never DELETE a revision.

**RLS implications.** Same pattern as 5.1. Plus: the audit log entry includes the CO's `tenant_id` for ADR-006 multi-tenancy enforcement.

### 5.3 schedule_lookahead_publish_executor

**What it commits.** `IrisScheduleAgent` drafts a 2-week lookahead from current schedule + actuals + weather; user approves; executor publishes the lookahead as a published `schedule_lookaheads` row visible to the field.

**Source specialist.** `IrisScheduleAgent`. Reuses the existing weather detector + the new CPM module.

**Write scope.** INSERT into `schedule_lookaheads`, INSERT into `schedule_lookahead_activities` (foreign-keyed; one row per included activity), INSERT into `iris_actions`.

**Approval gate.** PermissionGate (`schedule.publish` permission). Cancel-window 60s for opt-in users. Lookaheads are review-grade — the super sees the published one in the field; if it's wrong, that's a trust-eroding moment. Default for Phase 2 is approve-not-auto (cancel window opt-in is Lap 4).

**Dry-run mode.** Writes to `schedule_lookaheads_shadow`; field UI never shows shadow rows.

**Audit log fields.** `executor_name='schedule_lookahead_publish'`, `lookahead_id`, `start_date`, `end_date`, `activity_count`, `weather_at_risk_count`, `critical_path_intersect_count`.

**Rollback path.** `unpublishLookahead(lookahead_id, reason)`. Lookaheads are versioned by date; the next day's lookahead supersedes the prior. To withdraw an already-published lookahead, set `published=FALSE` and audit; never DELETE.

**RLS implications.** Lookaheads are project-scoped; the cron path that runs the executor must respect `project_members` membership for the user who approved. ADR-006 multi-tenancy applies.

---

## 6. Specialist boundary contract (ADR-018 inline summary)

This is ADR-018, drafted inline. A standalone ADR-018 file ships in the same PR as the Phase 2 Day 1 scaffolding.

**Decision.** Every IRIS specialist conforms to a standard interface enforced at compile time and at CI lint time. The interface is the answer to "what is a specialist, contractually."

```typescript
// src/services/iris/agents/contract.ts

export interface SpecialistContract {
  /** Stable name used in routing, telemetry, audit logs. */
  name: SpecialistName

  /** Semver. Bumped when prompt, tool list, or deterministic check changes. */
  version: string

  /**
   * Returns true iff the agent's output passes the deterministic check.
   * Receives the full output payload (post-LLM); returns a verdict + reason.
   * Pure function. No I/O. No DB. Deterministic.
   */
  deterministicCheck: (output: unknown) => { passed: boolean; reason?: string }

  /** What part of the output is LLM-generated; used for redaction in audit. */
  llmScope: 'full' | 'narrative_only' | 'classification_only' | 'none'

  /**
   * What tables/operations the specialist may write to. CI-enforced via the
   * tool-call audit on `iris_actions.tool_calls`.
   */
  writeScope: {
    tables: string[]
    operations: ('insert' | 'update')[]
  }

  /** P95 budget. CI fails if 7-day P95 exceeds this for > 1 day. */
  latencyBudgetMs: number

  /** Names of fields the specialist writes to `iris_actions.specialist_payload`. */
  auditFields: string[]

  /** Allow-list of tool names. Calls to anything else throw at runtime. */
  toolAllowList: string[]
}
```

**CI lint enforcement.** A new script `scripts/audit-specialists.mjs` walks `src/services/iris/agents/*.ts`, ensures every file exports a `SpecialistContract`, ensures the `toolAllowList` matches the actual `import` graph (no specialist imports a tool it didn't declare), ensures `writeScope.tables` is a subset of the tables actually written by the specialist (verified via static AST walk). PR fails if drift is detected.

**Why declare the contract instead of relying on review.** Specialists drift fast. A 6-month-old specialist with no contract can quietly grow a write to a new table. The contract catches that on the PR that introduces it. Same pattern as `audit-permission-gate.mjs` (Sprint Invariant #5 enforcement) — discoverable, automated, blocking.

---

## 7. Migration / sequencing (30 days)

The 30 days are roughly 6 weeks of working days inside Phase 2.

| Day | Work | Specialist | Commit boundary |
|---|---|---|---|
| 1 | Scaffold 4 specialist class files + `contract.ts` + router stub. No LLM calls yet. CI lint plumbed. | (all) | PR #1 |
| 2–6 | **IrisDrafterAgent** — extract from existing `src/services/iris/drafts.ts` + `templates.ts`; normalize; wire to `contextFabric` from Phase 1; voice linter integration. | drafter | PR #2 |
| 7–11 | **IrisMoneyAgent** + 1 deterministic CO math endpoint (sum of revisions reconciliation). | money | PR #3 |
| 12–16 | **IrisScheduleAgent** + lookahead detector reuse + new CPM module. | schedule | PR #4 |
| 17–20 | **IrisCodeAgent** + KB-stub fallback (5K hand-curated clauses) + verifyCitationSnippet integration. | code | PR #5 |
| 21–25 | 3 executors (`rfi_create`, `co_pricing_attach`, `schedule_lookahead_publish`) with cancel windows. | (executors) | PR #6 |
| 26–30 | Goldens (200-Q routing + 50-Q/specialist + 50 negative tests/executor), telemetry dashboard tile, exit gate verification. | (eval) | PR #7 |

Branch strategy: Phase 2 work lands on feature branches off `main`, gated through the existing PR process. Each PR carries its own receipt under `docs/audits/PHASE_2_DAY_NN_RECEIPT_*.md`. Phase 2 close PR #7 ships the master receipt (`PHASE_2_CLOSE_RECEIPT_*.md`).

Critical-path long-lead: PR #1 (Day 1) blocks PR #2–7. PR #2 blocks PR #6 (executor depends on drafter). PR #3 blocks PR #6 (`co_pricing_attach` depends on Money agent). PR #4 blocks PR #6 (`schedule_lookahead_publish` depends on Schedule agent). PR #7 depends on all.

Engineer #2 hire is a hard prerequisite (per `IRIS_NATIVENESS_PLAN_2026-05-08.md` §8 Risk #7). Walker cannot ship Phase 2 alone within the calendar.

---

## 8. Telemetry

Phase 2 extends the `iris_invocations` table introduced in Phase 1 (per `LAP_2_ACCEPTANCE_GATE_SPEC` and `IRIS_TELEMETRY_SPEC`). The router-level columns are listed in §4. The specialist-level columns:

```sql
ALTER TABLE iris_invocations
  ADD COLUMN specialist_payload JSONB,        -- per-specialist audit fields
  ADD COLUMN deterministic_check_reason TEXT,  -- when check fails
  ADD COLUMN latency_specialist_ms INTEGER,
  ADD COLUMN latency_deterministic_check_ms INTEGER;
```

Plus a new `iris_actions` table for executor commits:

```sql
CREATE TABLE iris_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invocation_id UUID NOT NULL REFERENCES iris_invocations(id),
  executor_name TEXT NOT NULL,
  drafted_action_id UUID REFERENCES drafted_actions(id),
  committed_entity_table TEXT NOT NULL,
  committed_entity_id UUID NOT NULL,
  was_human_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_window_seconds INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'executed', 'cancelled', 'failed')),
  failure_reason TEXT,
  payload JSONB,                              -- executor-specific snapshot
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_iris_actions_invocation ON iris_actions(invocation_id);
CREATE INDEX idx_iris_actions_executor_status ON iris_actions(executor_name, status);
```

**Dashboard tile (extends Lap 2 standup feed).**

- Per-specialist acceptance: % of drafts produced by each specialist that the user approved (vs. rejected or auto-withdrew). Healthy: ≥75% drafter, ≥85% money, ≥80% schedule, ≥85% code.
- Per-executor cancel rate: % of executor runs cancelled inside the cancel window. Healthy: < 5% (per Lap 3 Gate 4).
- Per-executor failure mode breakdown: count of `status='failed'` rows by `failure_reason` (RLS denial, deterministic check failed post-render, downstream DB error). Healthy: < 1% total failure rate.
- Routing override rate: % of invocations with `route_overridden_by_user=TRUE`. Healthy: < 5%.

Refresh: hourly via the same pg_cron pattern as `lap_2_gate_metrics_daily`.

---

## 9. Test plan

### 9.1 Unit tests (Vitest)

- **Deterministic checks per specialist — 100% coverage.** Each specialist's `deterministicCheck` is a pure function with finite branches. Coverage is enforced via the existing istanbul threshold (raise to 100% for `src/services/iris/agents/**/deterministicCheck.ts`).
- **Money math invariant tests.** 50 cases: every input is `Cents`-branded; every output is `Cents`-branded; no `Number` arithmetic on dollar values appears in the call graph. Static check via `audit-money-cents.mjs` (existing).
- **Router classification.** Each of the 30 regex rules has a positive and negative test. The LLM-fallback path is tested with mock returns.

### 9.2 Integration tests

- **End-to-end golden flows per specialist — 50 each = 200 total.** A golden is `(input, context, expected_output_shape, expected_specialist)`. Run nightly. Golden suite lives in `e2e/iris-goldens/`.
- **Executor commit + rollback.** Each executor has 10 commit-success tests + 5 commit-rollback tests + 5 cancel-window-fired tests. Total: 60 executor tests.

### 9.3 Routing goldens — 200-Q test set

Lives at `e2e/iris-router-goldens.spec.ts`. Each row asserts `routeInvocation(...).specialist === expected`. Distribution: 50 money / 50 schedule / 50 code / 50 drafter / 20 ambiguous (overlap edge cases). CI gate: ≥95% correct. Manually curated by Walker with engineer #2 in week 1.

### 9.4 Executor safety — 50 negative tests per executor

For each of the 3 executors, 50 inputs that should NOT produce a write:

- 10 RLS-denied cases (user not in project)
- 10 invalid-payload cases (missing required fields, wrong types)
- 10 deterministic-check-failed cases (e.g., money math doesn't reconcile)
- 10 cancel-window-fired cases (user cancels at second 30)
- 10 race-condition cases (entity deleted between draft and commit)

**Acceptance:** 0 of 150 produce a write to source-of-truth. Any single write = block deploy.

### 9.5 Latency load test

Synthetic load: 100 concurrent invocations, mixed across specialists (25 each). Measure P95 per specialist; assert all within budget (§3). Run on staging weekly via `lap-2-acceptance.yml` extension.

---

## 10. Failure modes

Every failure mode here has a deterministic recovery path. No silent failures.

**FM-1 — Specialist disagrees with router.** Router routes to Money; Money's `deterministicCheck` returns `passed: false` post-LLM (e.g., LLM emitted a digit pattern outside the formatted bracket). Behavior: surface to user with a structured reason ("I'm not sure about this one — pull the human in. Reason: [details]"). Do NOT fall back to a different specialist (silently re-routing is worse than refusing). Audit log: `deterministic_check_passed=FALSE`, `specialist_name='money'`, `deterministic_check_reason='digit_pattern_outside_brackets'`.

**FM-2 — Money math underflow / overflow.** Guarded by `money.ts`. Specialist refuses if any input fails `isCents(value)`. Behavior: refuse to enqueue, log to `iris_actions.failure_reason='input_not_in_cents'`, surface to user as "I can't compute this — the inputs aren't in the right format. Please refresh." Never produces a draft.

**FM-3 — Schedule data missing or stale.** Schedule agent checks `schedule_baselines.last_updated_at >= NOW() - INTERVAL '14 days'` before computing. Behavior: refuse + ask for refresh ("Your baseline is from 2026-09-01 — refresh before I compute float."). Audit: `failure_reason='schedule_baseline_stale'`.

**FM-4 — LLM returns hallucinated cents value.** The Money agent's narrative LLM somehow emits `$42.00` in a position the post-process expected to be empty. Deterministic check catches via the digit-pattern regex on the narrative output (rejecting any unbracketed `\$\d+` or `\d+(\.\d{2})?` outside whitelist positions). Output is rejected; user sees "Iris produced an invalid output — try again."

**FM-5 — Executor write fails (RLS / DB).** Cancel window auto-fires (write attempt fails before commit), `iris_actions.status='failed'`, `failure_reason` populated, user notified via the inbox feed: "Iris tried to commit RFI #N but couldn't — let me try again or do it manually." Audit chain stays clean.

**FM-6 — Cancel-window race.** User cancels at second 61 (per `AUTO_EXECUTE_CANCEL_WINDOW_SPEC`). The atomic cancel RPC returns `window_expired_or_already_terminated`. UI offers "Withdraw it" → fires the executor's withdraw path (5.1: `withdrawRfi`; 5.2: new revision; 5.3: `unpublishLookahead`).

**FM-7 — KB stub returns no results for IrisCodeAgent.** Agent refuses to synthesize without sources ("I couldn't find a reference for that. Phase 3 brings the full KB online — until then, ask a more specific question or attach a doc."). Audit: `failure_reason='kb_no_results'`.

**FM-8 — Two specialists invoked in parallel for one workflow.** Allowed (e.g., a weekly OAC summary calls Drafter + Money + Schedule). Each gets its own `iris_invocations` row; the workflow orchestrator (in `src/services/iris/router.ts` or workflow-specific code) joins their outputs. Failure of one does not fail the others; the workflow assembles whatever specialists succeeded with a clear "[Money agent failed — section omitted]" placeholder.

---

## 11. Acceptance gate

The exit gate from `IRIS_NATIVENESS_PLAN_2026-05-08.md` Phase 2 row, restated and made measurable:

1. **Router ≥95% correct routing** on the 200-Q goldens. CI: `npm run iris:goldens:routing` returns ≥190/200.
2. **3 executors live with ≥85% auto-approval acceptance** on pilot data — measured over a 7-day window across Brad Cameron's project + Carleton's project. Counted: `iris_actions WHERE status='executed'` ÷ `iris_actions WHERE status IN ('executed', 'cancelled')`. Excludes `failed` from the denominator.
3. **4 specialists with deterministic checks passing 100%.** No specialist may ship with a deterministic check that has < 100% line coverage. Istanbul threshold enforced.
4. **Latency P95 within budget per specialist.** P95 measured on the trailing 7-day window from `iris_invocations.latency_specialist_ms`. Drafter ≤ 6s, Money ≤ 4s, Schedule ≤ 5s, Code ≤ 5s.
5. **Zero source-of-truth writes outside the 3 executors.** Audit query: `SELECT COUNT(*) FROM iris_actions WHERE executor_name NOT IN (...)` returns 0.

Each gate is a CI workflow. Same pattern as `lap-2-acceptance.yml`. Phase 2 closes when all 5 are green for 3 consecutive days. Receipt at `docs/audits/PHASE_2_CLOSE_RECEIPT_2026-10-15.md`.

---

## 12. Cross-references

**Depends on:**

- Phase 1 (Role Layer + Context Fabric v0) — specialists consume `IrisContext` from `src/services/iris/contextFabric.ts`. Without Phase 1, specialists fall back to a Phase-0-shape context that omits role, recent actions, intent. Phase 2 cannot ship without Phase 1.
- Phase 0 — citations (`IRIS_CITATIONS_SPEC_2026-05-04.md`). The Drafter and Code agents both depend on `verifyCitationSnippet` and `resolve_citation`.

**Inputs to:**

- Phase 3 (Universal Knowledge Absorption) — `IrisCodeAgent` graduates from KB-stub to pgvector-backed full KB without changing its contract. Phase 3 swaps the retrieval layer; the agent's interface is stable.
- Phase 4 (Per-Page Coverage + Ambient Layer) — Insight Slots invoke specialists. Phase 4's per-page generators are Phase 2's specialists, surfaced.

**ADRs created:**

- ADR-018 — Specialist Sub-Agent Boundary Contract (this spec, §6).

**Reuses:**

- Cancel-window pattern: `AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md` — every executor wraps it.
- Money math: `src/types/money.ts` — Money agent's deterministic gate.
- Cron + pgmq: `ADR_003_HYBRID_CRON_2026-05-04.md` and `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` — the schedule agent's lookahead worker is a new pgmq consumer.
- Auto-withdraw: `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md` — when an executor's drafted_action withdraws (e.g., entity state changed before commit), the executor honors withdraw.
- Citation contract: `IRIS_CITATIONS_SPEC_2026-05-04.md` — Drafter and Code agents.

---

## 13. Day-by-day breakdown (30 days, Lap 3 second half)

Calendar dates assume 2026-09-15 Phase 2 open. Adjust if Phase 1 closes late.

| Day | Date | Work | Output |
|---|---|---|---|
| 1 | 2026-09-15 | Scaffold `src/services/iris/agents/{drafter,money,schedule,code}.ts` empty classes implementing `SpecialistContract`. `router.ts` stub. `contract.ts` interface. CI lint script `audit-specialists.mjs`. | PR #1 lands. Empty agents, no LLM calls. |
| 2 | 2026-09-16 | `drafter.ts`: extract `generateIrisDraft()` from `src/services/iris/drafts.ts`. Wire to `contextFabric` (Phase 1). | Drafter compiles; existing draft tests pass. |
| 3 | 2026-09-17 | `drafter.ts`: voice linter integration; deterministic check (citation presence + voice lint + length). | Deterministic check unit tests green. |
| 4 | 2026-09-18 | `drafter.ts`: model selection per draft type (Sonnet vs. Haiku); cost telemetry. | Model-choice tests green. |
| 5 | 2026-09-21 | `drafter.ts`: 50 golden flows. | Goldens green. |
| 6 | 2026-09-22 | `drafter.ts`: receipt + PR #2 close. | PR #2 lands. |
| 7 | 2026-09-23 | `money.ts`: scaffold + input gate (`isCents` enforcement). | Compiles; input gate tests green. |
| 8 | 2026-09-24 | `money.ts`: CO math endpoint (`computeChangeOrderTotal`). All math through `money.ts`. | CO math 50-case test green. |
| 9 | 2026-09-25 | `money.ts`: pay-app reconciliation endpoint. | Reconciliation 30-case test green. |
| 10 | 2026-09-28 | `money.ts`: narrative wrapper (Haiku-class). Output gate (digit-pattern regex). | Output gate 20-case adversarial test green. |
| 11 | 2026-09-29 | `money.ts`: 50 goldens + receipt + PR #3 close. | PR #3 lands. |
| 12 | 2026-09-30 | `schedule.ts`: scaffold + CPM module skeleton (`src/lib/cpm/`). | Compiles. |
| 13 | 2026-10-01 | `schedule.ts`: CPM `computeFloat` + `computeCriticalPath` on a 500-activity graph. | CPM unit tests green. |
| 14 | 2026-10-02 | `schedule.ts`: weather detector reuse + `findWeatherAtRisk`. | Weather integration test green. |
| 15 | 2026-10-05 | `schedule.ts`: lookahead synthesis (deterministic activity selection + Haiku narrative). | Lookahead 30-case test green. |
| 16 | 2026-10-06 | `schedule.ts`: 50 goldens + receipt + PR #4 close. | PR #4 lands. |
| 17 | 2026-10-07 | `code.ts`: scaffold + KB-stub data ingestion (5K hand-curated clauses). | KB stub queryable. |
| 18 | 2026-10-08 | `code.ts`: vector retrieval (pgvector on the stub) + keyword retrieval (pg_trgm). | Retrieval tests green. |
| 19 | 2026-10-09 | `code.ts`: `verifyCitationSnippet` integration; Sonnet synthesis. | Verification tests green. |
| 20 | 2026-10-12 | `code.ts`: 50 goldens + receipt + PR #5 close. | PR #5 lands. |
| 21 | 2026-10-13 | `rfi_create_executor`: scaffold + cancel-window integration + dry-run mode. | Compiles. |
| 22 | 2026-10-14 | `co_pricing_attach_executor`: scaffold + Money agent integration + revision INSERT. | Compiles. |
| 23 | 2026-10-15 | `schedule_lookahead_publish_executor`: scaffold + Schedule agent integration. | Compiles. |
| 24 | 2026-10-16 | All 3 executors: 50 negative tests each (150 total). | Negative tests green. |
| 25 | 2026-10-19 | All 3 executors: end-to-end commit tests on staging; receipt + PR #6 close. | PR #6 lands. |
| 26 | 2026-10-20 | Routing goldens: 200-Q test set (curated by Walker + engineer #2). | Goldens green ≥95%. |
| 27 | 2026-10-21 | Telemetry dashboard tile extension (Lap 2 standup feed). | Tile renders. |
| 28 | 2026-10-22 | Latency load test on staging; tune any specialist over budget. | P95 budgets verified. |
| 29 | 2026-10-23 | Pilot rollout: enable Phase 2 for Brad Cameron's project + Carleton's project under feature flag. | Flag green. |
| 30 | 2026-10-26 | Phase 2 close: all 5 acceptance gates green for 3 consecutive days; PR #7 + master receipt. | PR #7 lands. Phase 2 closes. |

---

## 14. Risks specific to Phase 2

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| P2-1 | **Money agent's narrative LLM emits a digit pattern that bypasses the regex gate** (e.g., spelled-out "forty-two thousand four hundred dollars") | Medium | High (sprint invariant violation, even without numeric error) | Output gate v2: NER pass over the narrative output; flag any number-bearing phrase that wasn't pre-formatted; reject. Adversarial test set of 100 "trick the regex" prompts in the 50-case goldens. |
| P2-2 | **Schedule agent's CPM walk silently disagrees with the user's manual calculation** (different `lag` interpretation, different "calendar days vs. work days" convention) | Medium | Medium | Document the assumed convention in the agent's prompt + emit it in every narrative ("computed using calendar-day lag, exclude Sundays"); cross-check against Primavera P6 export on 5 real projects from the pilot. |
| P2-3 | **Code agent KB-stub gives partial answers for OSHA Subpart D** (subpart not in stub) | High | Low (refuses gracefully per FM-7) | Document the KB-stub coverage in the agent's user-facing message; queue Phase 3 KB build with an explicit list of pilot-needed sections. |
| P2-4 | **Router LLM-fallback gets stuck below 0.6 on common queries**, sending too much to `unknown_fallback` (drafter) | Medium | Medium (drafter does the wrong thing) | Calibrate the LLM-fallback prompt during Day 26 goldens curation; if `unknown_fallback` rate > 10%, expand the regex bank in week 6. |
| P2-5 | **Cancel-window opt-in rate stays below 20% on the soft pilot** (super doesn't trust auto-execute) | High | Low (executors still ship; just used in approve-not-auto mode) | Default to approve-not-auto for Phase 2; opt-in rate is a Lap 4 concern (pilot scaling). Phase 2's gate doesn't measure opt-in rate. |
| P2-6 | **Executor write fails on a real pilot project**, dirty rollback leaves an orphaned `change_order_revisions_shadow` row | Low | High (data quality) | Single-transaction wrap on every executor's commit; ROLLBACK on any error; CI test for forced mid-commit failure verifies no shadow row leaks. Daily cleanup job on staging deletes shadow rows older than 24h. |
| P2-7 | **A specialist accidentally reads a table not in its `toolAllowList`** (e.g., Drafter reads `change_orders` for "context" — innocent but boundary-breaking) | Medium | Medium (boundary erosion) | `audit-specialists.mjs` CI lint catches at PR time; runtime `requireTool(name)` throws if unknown tool invoked. |
| P2-8 | **Engineer #2 hire slips past Aug 1**; Walker writes Phase 2 alone | Medium | High | Per `IRIS_NATIVENESS_PLAN_2026-05-08.md` §8 #7, the search opens before Phase 1. Phase 2 calendar is exactly 30 working days; Walker alone needs 60+. If hire slips: descope `IrisCodeAgent` to Phase 3 (Days 17–20 pulled out); keep 3 specialists + 2 executors for Phase 2 close. |
| P2-9 | **Auto-withdraw fires on a draft mid-executor-commit**, race condition leaves the draft `'rejected'` but the entity already inserted | Low | High (audit chain inconsistency) | The executor wraps the draft status update + entity INSERT in a single transaction. The withdraw RPC has `WHERE status = 'pending'` — once the executor flips to `'executing'`, withdraw is a no-op. Tested in 50 negative tests per executor. |
| P2-10 | **Latency budget regression on Drafter** when context fabric grows (Phase 1 ships fat context, Drafter slows from 4s to 7s) | Medium | Medium | Latency CI gate fails if 7-day P95 > budget for > 1 day. Mitigation: context fabric size cap (Phase 1 introduces `context_fabric_size_kb` column for a reason). |

---

## Appendix A — Why the executor list is exactly 3

Phase 2 ships 3 executors, not 5 or 10. The selection criteria, applied to the candidate list:

| Candidate | Value to pilot | Risk if wrong | Reversibility | Phase |
|---|---|---|---|---|
| `rfi_create_executor` | High (RFIs are the daily currency of the PM) | Low (withdraw is one click) | Easy (rfi.status='withdrawn') | **Phase 2** |
| `co_pricing_attach_executor` | High (CO math is where money goes wrong today) | Medium (audit-chain implications) | Easy (new revision supersedes) | **Phase 2** |
| `schedule_lookahead_publish_executor` | High (super wants this Monday morning) | Medium (super publishes wrong lookahead, field confused) | Easy (unpublish) | **Phase 2** |
| `submittal_create_executor` | Medium (submittals are slower-cycle) | Low | Easy | Phase 4 |
| `pay_app_attach_executor` | High | High (touches wire-transfer math) | Hard (downstream ACH effects) | Phase 7 (post-Embedded Payments v0) |
| `daily_log_finalize_executor` | Medium (super uses, not PM) | Low | Easy | Phase 5 (foreman flow) |
| `lien_waiver_chase_executor` | Medium (office uses, not PM) | Low | Easy | Phase 5 |
| `change_order_send_executor` | Medium | High (sends external email) | Hard (email un-send is impossible) | Phase 7 |

The 3 chosen are the value × risk × reversibility frontier. Anything that touches an irreversible external system (ACH, email send) is deferred to Phase 7 where the cancel-window, audit-chain, and the partner-API integration are all hardened together.

---

## Appendix B — What this spec deliberately does NOT cover

- **Workflow orchestration that calls multiple specialists.** The "weekly OAC summary" workflow that fans out to Drafter + Money + Schedule lives in a separate spec (Phase 4 — Per-Page Coverage + Ambient Layer). Phase 2 ships the specialists; Phase 4 ships the workflows.
- **The persona system.** Persona is Phase 1. Specialists consume `IrisContext.who.persona` but do not define it.
- **The full pgvector KB.** Phase 3. Code agent ships against a 5K hand-curated stub.
- **The mobile surfaces.** Phase 5. Phase 2 specialists are web-only; mobile invocations land in Phase 5.
- **Cross-project memory.** Phase 6. Specialists are project-scoped in Phase 2.
- **The integration marketplace.** Phase 7. Phase 2 specialists never call external APIs (Procore, Sage, etc.).
- **Specialist self-eval / self-improvement loop.** Devin-style replayability. Lap 4+.

---

## Appendix C — Compatibility with sprint invariants (audit)

Mapped to the seven sprint invariants in `CLAUDE.md`:

| Invariant | Phase 2 behavior |
|---|---|
| #1 — Typecheck green | Every PR lands green. The contract type (`SpecialistContract`) is enforced at compile time. |
| #2 — Money math through `money.ts` | Money agent §3.2 is the embodiment. CI lint extended in Day 1 PR enforces `Number * Number` on dollar values stays banned. |
| #3 — No re-adding deleted stores | Phase 2 introduces zero new stores. Specialists are services, not state. |
| #4 — 13-store target | Unchanged. |
| #5 — PermissionGate wraps money/schedule/field | Every executor's commit step wraps PermissionGate. `audit-permission-gate.mjs` extended to recognize the executor pattern. |
| #6 — Update tracker on day completion | Days 1–30 each update the Lap 3 tracker tab. |
| #7 — Receipt per day | 30 receipts under `docs/audits/PHASE_2_DAY_NN_RECEIPT_*.md` plus master close receipt. |

---

*End of spec. Phase 2 opens 2026-09-15 (T-228); closes 2026-10-26 (T-187). 30 working days. 5 acceptance gates. ADR-018 inline. 4 specialists, 3 executors, 1 router, 200-Q goldens.*
