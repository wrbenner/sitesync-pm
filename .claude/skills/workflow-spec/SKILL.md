---
name: workflow-spec
description: File a tier-1 Workflow Spec describing one cross-feature chain in src/lib/crossFeatureWorkflows.ts (trigger, inputs/outputs, idempotency, audit, telemetry, acceptance) in ~250 words; sister to page-card and iris-spec.
version: "1.0.0"
when_to_use: When a new cross-feature chain is added to src/lib/crossFeatureWorkflows.ts, or when reviewing an existing chain's contract, idempotency guarantee, or audit trail.
allowed-tools: read_file, write_file, bash, grep, edit_file
---

## Overview

A **Workflow Spec** is the primary spec unit for any cross-feature workflow chain in SiteSync — the `runX...Chain` and `runX...Sweep` exports in `src/lib/crossFeatureWorkflows.ts`. There are 12 chains today (per `project_cross_feature_workflows.md` memory): RFI overdue sweep, submittal rejected, daily-log incident, drawing revised, schedule slip, discrepancy detected, daily-log delay, meeting action items, submittal approved, punch verified, permit approved, crew no-show.

The card answers: when does this fire, what does it create, how do we know it won't double-fire, and how do we audit it? In ~250 words. Deep details (state machines, full audit-row examples, edge-case enumeration) go behind `[Deep dive →]` links.

Sister templates: `/page-card` (UI surfaces) and `/iris-spec` (Iris features). All three share the same 10-field shape.

**Golden rule:** Every chain is idempotent (per the project's `metadata` JSONB containment convention). If your card can't state the idempotency guarantee in one line, you don't ship it.

---

## Template

Copy this block, fill it in, save to `docs/audits/WORKFLOW_SPEC_<NAME>_<YYYY-MM-DD>.md`.

```markdown
# Workflow Spec — `runXxxChain`

**Date:** YYYY-MM-DD · **Status:** Draft | Reviewed | Locked
**Implementation:** `src/lib/crossFeatureWorkflows.ts` → `runXxxChain`

| Field | Value |
|---|---|
| **Persona(s)** | (per ADR-019) — who indirectly causes this to fire (or `system` for cron-driven chains) |
| **Job-to-be-done** | One sentence. "When X happens, automatically do Y." |
| **Trigger** | The deterministic predicate. SQL-style. `[Deep dive →]` |
| **Inputs/Outputs** | `Input{...} → Output{...}` — entity shapes, not full schemas. `[Deep dive →]` |
| **Stores** | Stores updated by side effects (typically none — chains write through hooks). |
| **Idempotency Guarantee** | The exact `metadata @> '{...}'` containment check that prevents re-fires. `[Deep dive →]` |
| **Compensating actions** | If the chain partially succeeds, what reverses it. `—` for read-only chains. |
| **Iris hooks** | If Iris drafts the side-effect content (e.g., RFI auto-draft from chain output). |
| **Telemetry** | `workflow.fired`, `workflow.completed`, `workflow.skipped_idempotent` events emitted, or `⚠️ none`. |
| **Acceptance** | Unit test count + integration test path + manual smoke (3 lines). `[Deep dive →]` |

**Open questions:** 1–3 bullets. Empty when locked.
```

---

## Section-by-section authoring guide

| Field | What goes here | What does NOT go here |
|---|---|---|
| **Persona(s)** | The actor whose action causes the chain. For cron-driven chains (e.g., `runRfiOverdueSweep`), write `system (cron)`. | Don't write "all roles" — name the originator. |
| **Job-to-be-done** | The why, in business language. "When a Submittal is rejected, ensure an Incident + follow-up Task exist." | Don't paraphrase the function name. |
| **Trigger** | The deterministic predicate as close to SQL as you can write it: `submittals.status = 'rejected' AND NOT (metadata @> '{"source": "runSubmittalRejectedChain"}')`. | Don't write "when something happens"; be exact. |
| **Inputs/Outputs** | Entity shape only: `Submittal{id, project_id, status} → Incident{id, source}, Task{id, source, assigned_to}`. | Don't paste full table schemas; that's the deep dive. |
| **Stores** | Almost always `—` for chains. List only if a chain mutates a store directly. | Don't list every store the entities live in. |
| **Idempotency Guarantee** | The exact JSONB containment check. Example: `incident.metadata @> '{"source": "runSubmittalRejectedChain", "submittal_id": <id>}'` — if any matching row exists, skip. | Don't write "we check for duplicates"; show the predicate. |
| **Compensating actions** | What reverses partial success. For most chains: `—` because they're additive (creating Incident + Task — no mutation of source). For chains that close/reopen: list the reverse. | Don't promise compensation you can't implement. |
| **Iris hooks** | If Iris drafts the title, body, or attachments of the side-effect entity. | Don't list Iris hooks on the consumer side (those are page-card concerns). |
| **Telemetry** | Direct inserts into `iris_telemetry` or `audit_log` from this chain. Most chains today emit none — write `⚠️ none` and add an Open Question. | Don't list events emitted by the entities the chain creates (those belong on the entity's page card). |
| **Acceptance** | "N unit tests in `src/lib/__tests__/crossFeatureWorkflows.test.ts` covering happy path + idempotent skip + missing-input. Integration smoke: `runXxxChain('seed-id')` → query side-effect rows." | Don't paste the test source. |
| **Open questions** | Concrete bullets. "Should the chain emit `workflow.fired` telemetry to feed the Lap 2 matview?" — that kind of thing. | Don't list TODOs that belong in code comments. |

---

## How to populate from code (the 60-second sweep)

```bash
# Find the chain implementation
grep -n "export async function run" src/lib/crossFeatureWorkflows.ts

# Read just the body of one chain (e.g., runSubmittalRejectedChain)
awk '/runSubmittalRejectedChain/,/^export/' src/lib/crossFeatureWorkflows.ts | head -80

# Find the idempotency guard
grep -n "metadata.*@>" src/lib/crossFeatureWorkflows.ts | head

# Find the existing tests
grep -l "runSubmittalRejectedChain" src/lib/__tests__/*.test.ts

# Find every page that calls the chain (consumer side)
grep -rn "runSubmittalRejectedChain" src/pages src/components src/hooks
```

Convention: every chain returns `WorkflowResult | WorkflowResult[]` with `{ status: 'created' | 'skipped_idempotent' | 'error', entityType, entityId?, reason? }`. The "skipped_idempotent" branch is what the Idempotency Guarantee field describes.

---

## Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Idempotency = "we have a check" | Card doesn't state the predicate; reviewers can't verify | Write the exact `metadata @> '{...}'` clause |
| Trigger uses verbal English | "When something happens" — not testable | Write SQL-style; the trigger should be reproducible in a query |
| Compensating actions = "rollback the transaction" | Most chains are multi-table; tx rollback isn't always available | List the actual rows to delete or null-out, OR commit to additive-only and write `—` |
| Telemetry = `(none)` without flagging | Lap 2 acceptance gate needs `workflow.*` events to compute a matview row; silent gap | Write `⚠️ none` and add an Open Question |
| Card lists "potential" Iris drafting | Wishful — not what's wired today | Only list Iris hooks that exist in code at filing time |
| Filing under the wrong path | Card hides from `INDEX.md` | `docs/audits/WORKFLOW_SPEC_<NAME>_<DATE>.md` and append to INDEX |
| Skipping Open Questions on a chain whose source feature is still WIP | Card silently locks something that's actively changing | Status stays `Draft` until the upstream feature is `Reviewed` or `Locked` |

---

## After you save

1. Append a one-line entry to `docs/audits/INDEX.md` under the **Workflow Specs** section
2. Cross-link: every page that triggers this chain should list it under the page card's **Workflows triggered** field; verify the back-references
3. If `⚠️ none` is in the Telemetry field, add the chain to the Lap-2 telemetry-instrumentation punch list

---

## Usage Tracking

usage_count: 0
last_used: null
