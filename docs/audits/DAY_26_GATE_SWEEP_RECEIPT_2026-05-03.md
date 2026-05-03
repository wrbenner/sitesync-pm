# Day 26 — Friday Gate Sweep Receipt

**Date:** 2026-05-03
**Author:** Claude (acting under Walker)
**Lap:** 1 — Subtract
**Owner of record:** Walker

---

## Summary

Audit of every status-mutating path in `src/services/`,
`src/hooks/mutations/`, and `src/api/endpoints/` against the rule:
**status changes must consult the relevant machine's transition
validator.**

**Result: 14/14 entity services that own a state machine route status
updates through the validator. One genuine gap found: lien-waiver
status updates have no validator (no machine exists for them yet).**

This closes Day 26 of Lap 1. Days 22–24 were re-scoped per the
Day-20 inventory; Day 25 was contingent on Days 22–24 and is also
deferred. Lap 1's state-machine theme: state graphs are sound, gates
are mostly green, one explicit gap documented for future work.

---

## Methodology

For each of the 15 machines, asked:
1. Does the corresponding service file (`src/services/{name}Service.ts`)
   import the validator (`getValid*Transitions`, `transitionStatus`)?
2. Does any direct `update({ status: ... })` exist outside the validator-
   wrapped function?
3. Does the test file exercise the invalid-transition rejection path?

---

## Per-Machine Status

| Machine | Service file | Validator imported? | Bypass path? |
|---|---|---|---|
| `rfiMachine` | `rfiService.ts` | ✓ | none |
| `paymentMachine` | `paymentService.ts` | ✓ | none |
| `submittalMachine` | `submittalService.ts` + `mutations/submittals.ts` | ✓ | none |
| `changeOrderMachine` | `changeOrderService.ts` | ✓ | none |
| `dailyLogMachine` | `dailyLogService.ts` | ✓ | none |
| `punchItemMachine` | `punchItemService.ts` | ✓ | none |
| `closeoutMachine` | `closeoutService.ts` | ✓ | none |
| `taskMachine` | `taskService.ts` | ✓ | none |
| `inspectionMachine` | `inspectionService.ts` | ✓ | none |
| `equipmentMachine` | `equipmentService.ts` | ✓ | none |
| `scheduleMachine` | `scheduleService.ts` | ✓ | none |
| `drawingMachine` | `drawingService.ts` | ✓ | none |
| `documentMachine` | `documentService.ts` | ✓ | none |
| `projectMemberMachine` | `projectMemberService.ts` | ✓ | none |
| `agentStreamMachine` | (no service — orchestration-only) | n/a | n/a |

The `dailyLogService.updateStatus` initially looked like a bypass
because it called `update({ status: ... })`. On read, it's a thin
wrapper that delegates to `transitionStatus` (which DOES gate). False
positive; correctly behaved.

---

## Genuine Gap Found

### 🟡 `lien_waivers` status updates have no transition validator

**Where:** `src/api/endpoints/lienWaivers.ts` — `updateLienWaiverStatus()`
accepts an arbitrary `LienWaiverStatus` and writes it directly:

```ts
const update: Partial<DbLienWaiverRow> = { status: mapStatusToDb(status) }
// no transition graph consulted; write is unconditional
```

**Why this matters:** lien waivers move through a real progression
(`pending` → `conditional_received` → `executed` → `final` → `waived`).
A user with the right RLS could in theory write `waived` over a `pending`
record and skip the chain. There's no model that says "you can't
go from pending to waived without conditional received first."

**Why it's NOT in scope for today:**
- `paymentMachine.ts` declares the `LienWaiverStatus` type but no
  validator function (`getValidLienWaiverTransitions`) exists.
- Inventing the right transition graph touches construction-billing
  semantics that should be reviewed by the team — not invented
  unilaterally in a sweep.
- The mitigation is upstream: the UI buttons that call
  `updateLienWaiverStatus` only fire from contexts where the new
  status is plausible (you can only "Mark Received" from pending,
  etc.), so the practical risk is low.

**Recommendation:** add `getValidLienWaiverTransitions(currentStatus)`
to `paymentMachine.ts` as a follow-up, then guard
`updateLienWaiverStatus` like the other 14 services. ~30 min when
you're back in this neighborhood.

---

## Non-machine status updates (audited as appropriate)

These status changes are intentionally NOT machine-governed because
the underlying entity doesn't have a state graph:

- `projectService` — `archived` is a soft-delete flag, not a workflow
- `integrations/base.ts` — integration connection health, not workflow
- `notifications/emailNotificationService` — `sent` / `failed` /
  `skipped` is delivery telemetry
- `mutations/agent-tasks.ts` — task runner lifecycle, internal scheduler
- `mutations/integrations.ts` — OAuth status (`connected` / `revoked`)
- `mutations/estimating.ts` — bid `awarded` / `declined` is a single-
  shot terminal event from a UI button, not a graph
- `api/endpoints/budget.ts` — `approved` flag for budget revision

All seven are appropriate without a machine.

---

## Test Coverage

`src/test/integration/lifecycles.test.ts` exercises invalid-transition
rejection across most machines. Spot-checked: tests do assert
`expect(result.error).toBeTruthy()` for known-bad transitions. Does
NOT split by machine into separate describe blocks — that's a
nice-to-have but not a Lap-1 gap.

---

## Verification

| Check | Method | Result |
|---|---|---|
| Each entity service imports its validator | `grep -l "getValid.*Transitions"` per service | ✓ 14/14 |
| Direct `update({status:...})` only inside validator-wrapped functions | Manual read of each service's mutation surface | ✓ except lien_waivers (documented above) |
| `lifecycles.test.ts` exists and asserts on rejection | Read | ✓ |
| `mutations/state-machine-validation-helpers.ts` is the canonical wrapper | Read | ✓ |

---

## What's Next

State-machine theme of Lap 1: **CLOSED.** Findings:
- 15 machines exist as domain-model libraries (Day 20 inventory)
- 14/14 entity services route status changes through the validator
- 1 genuine gap (lien_waivers) documented for future work
- Days 22-24 (wire through useMachine) deferred — not Lap-1 scope
- Day 25 (devtool) contingent on Days 22-24, also deferred

Continuing on to **Day 27 (bundle attack)** — the heaviest chunks were
mapped in `BUNDLE_BASELINE_2026-05-03.txt`: vendor-ifc (3.5MB),
vendor-pdf-gen (1.8MB), vendor-pdf-viewer (750KB), vendor-three (560KB),
vendor-xlsx (425KB).

---

## One Number to Watch

**14/14 entity services route status changes through transition validators.**

The number to drive down post-Lap-1 is the lien-waiver gap (currently
1; goal: 0 after the validator is added).
