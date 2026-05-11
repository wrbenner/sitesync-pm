# ADR-018 — Specialist Sub-Agent Boundary Contract

**Date:** 2026-05-08
**Status:** Accepted (in advance of Phase 2 open)
**Decider:** Walker
**Related:** `IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md`, `IRIS_NATIVENESS_PLAN_2026-05-08.md`, `ADR_002_AI_STORES_STAY_SEPARATE_2026-05-01.md`, `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md`

---

## Decision

Every IRIS specialist sub-agent (Drafter, Money, Schedule, Code, Field, Historian, plus any future specialists) **must conform to a single boundary contract**. The contract names the safe surface area each specialist exposes: deterministic check, LLM scope, write scope, latency budget, audit fields, tool allow-list. A CI lint (`scripts/audit-specialists.mjs`) enforces conformance on every PR.

The contract is the way we get Hippocratic-style safety (specialist boundaries shrink the safety surface) without devolving into one mega-agent or a chaos of one-off agent shapes.

---

## The contract

Every specialist exports a typed declaration:

```typescript
// src/services/iris/specialists/types.ts
export interface SpecialistDecl {
  name: string;                  // 'drafter' | 'money' | 'schedule' | 'code' | 'field' | 'historian'
  version: string;               // semver. CI bump-required on contract change.

  // SAFETY GATES (deterministic, never LLM-evaluated)
  deterministicCheck: (input: SpecialistInput, ctx: IrisContext) => DeterministicResult;
  // Returns { ok: boolean, blockers?: string[], warnings?: string[] }.
  // ok=false MUST short-circuit before any LLM call.

  // LLM USAGE
  llmScope:
    | 'narrative_only'        // LLM writes the narrative wrapper around deterministic facts (Money)
    | 'synthesis'             // LLM combines deterministic signals into a draft (Schedule, Code)
    | 'generative'            // LLM authors the artifact body (Drafter, Field)
    | 'none';                 // No LLM call (Historian retrieval-only path)
  modelTier: 'haiku' | 'sonnet' | 'opus';   // hard pin per specialist
  promptVersion: string;       // changes ratcheted via promptVersion ↑ + golden re-run

  // WRITE SCOPE
  writeScope: WriteScope[];   // exhaustive list of (table, columns, conditions). Empty = read-only.
  // Lint enforces every write goes through src/services/iris/executors/* — no in-specialist DB writes.

  // LATENCY BUDGET
  latencyBudgetMs: { p50: number, p95: number };
  // P95 enforced as alert threshold. Two consecutive 24h windows over budget → autopage.

  // AUDIT
  auditFields: string[];      // every field appended to iris_actions on this specialist's invocation
  // At minimum: specialist_name, version, model_tier, deterministic_check_passed,
  // llm_call_count, llm_total_tokens, latency_ms, executor_invoked, executor_outcome.

  // TOOLS
  toolAllowList: ToolName[];  // closed list. CI lint blocks new tool calls without ADR.
}
```

---

## The four current specialists, declared

| Specialist | Det. check | LLM scope | Model | Write scope | Latency P95 |
|---|---|---|---|---|---|
| **Drafter** | RFI/submittal/log schema fields populated | generative | Sonnet | drafted_actions write via executor | 6s |
| **Money** | Inputs are cents (number bigint) AND through `src/types/money.ts` AND source rows exist | narrative_only | Haiku | None directly; co_pricing_attach_executor ratifies | 4s |
| **Schedule** | Lookahead window valid (≤14d), float values present, weather feed fresh ≤1h | synthesis | Sonnet | None directly; schedule_lookahead_publish_executor ratifies | 5s |
| **Code** | KB retrieval recall@5 ≥0.5 over candidate clauses; no hallucinated section IDs | synthesis | Sonnet | None — read-only specialist | 5s |

Phase-5 specialists (Field) and Phase-6 specialist (Historian) declared at their phase open.

---

## Rules (CI-enforced)

1. **No specialist writes to the database directly.** All writes go through named executors in `src/services/iris/executors/*`. The lint blocks `import { supabase }` inside any file under `src/services/iris/specialists/`.

2. **Deterministic check runs first, always.** Lint asserts every specialist's entry function calls `deterministicCheck` before any `await llm(...)` call. If `ok=false`, the function returns the blocker — no LLM call.

3. **Money math through `src/types/money.ts` only.** Sprint Invariant #2. Lint blocks `+`, `-`, `*`, `/` on any value typed `Cents` outside that module.

4. **Tool allow-list is closed.** Adding a new tool call requires bumping `version` + ADR (this one or a sub-ADR).

5. **Audit log on every invocation.** No specialist call without an `iris_actions` row. Lint asserts every specialist exit point writes the row.

6. **Latency budget is enforced.** Specialist file declares budget; runtime instrumentation records P50/P95; weekly job alerts on two consecutive 24h windows over budget.

7. **No specialist invokes another specialist directly.** Cross-specialist calls go through the router. This keeps the call graph flat and the audit chain clean.

---

## Why this matters

- **Hippocratic / Sierra lesson:** specialist boundaries shrink the safety surface. A bug in the Money agent cannot leak into RFI drafting.
- **Audit chain integrity:** every IRIS action has a single specialist signature. The audit-chain certification (T-195 milestone) requires this.
- **Engineering velocity:** engineer #2 can own a specialist end-to-end without coordinating with engineer #1's specialist.
- **Procore moat:** specialist boundaries + audit chain + cross-project memory = a moat. Procore's copilot is one big agent; that's a feature gap they cannot close cheaply.

---

## CI lint: `scripts/audit-specialists.mjs`

Runs on every PR + push. Asserts:

- Every file under `src/services/iris/specialists/` exports a valid `SpecialistDecl`.
- `deterministicCheck` is called before any LLM call (AST scan).
- No DB write outside `src/services/iris/executors/`.
- Every `toolAllowList` entry corresponds to a registered tool.
- Every audit field listed is actually written by the specialist's exit handler.
- Money math constraints (Sprint Invariant #2) hold.

Failures block merge. Bypass requires explicit Walker review + ADR amendment.

---

## Test plan

- **Unit:** each specialist's `deterministicCheck` covered 100%.
- **Integration:** end-to-end golden flow per specialist (50 each = 200 total).
- **Routing goldens:** 200-Q router test → ≥95% correct routing.
- **Negative tests:** 50 per executor where deterministic check should refuse.
- **Lint regression:** synthetic violation tests that the CI lint catches every rule above.

---

## Consequences

**Positive:** engineer #2 can ship a specialist autonomously. Audit chain stays clean. Specialist bugs don't cross-contaminate. Scaling the Iris surface is "add a specialist" not "complicate the mega-agent." Hippocratic-class safety story for SOC 2 + customers.

**Negative:** 7 rules to remember. CI lint surface to maintain. Cross-specialist orchestration goes through the router (one extra hop per multi-specialist call — acceptable; latency budgets account for it).

---

## Status timeline

- **2026-05-08** — Accepted, pre-Phase-2 open.
- **Phase 2 open (~Sep 2026)** — Drafter, Money, Schedule, Code declared per contract.
- **Phase 5 open (~Jan 2027)** — Field declared.
- **Phase 6 open (~Mar 2027)** — Historian declared.
- **Re-review at end of every Phase** for contract drift.
