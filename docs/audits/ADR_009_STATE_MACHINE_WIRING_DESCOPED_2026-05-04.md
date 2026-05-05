# ADR-009 — State Machine `useMachine` Wiring Descoped

**Date:** 2026-05-04
**Status:** Accepted
**Decider:** Walker
**Supersedes:** the original Lap 1 Days 22–24 plan ("wire 5 machines per day to `useMachine` in production")
**Related:** `STATE_MACHINE_INVENTORY_2026-05-03.md` (the analysis that drove this), `LAP_1_CARRYOVER_PLAN_2026-05-04.md`

---

## Decision

The plan to wire all 15 XState machines (`rfiMachine`, `paymentMachine`, `submittalMachine`, `changeOrderMachine`, `dailyLogMachine`, `punchItemMachine`, `closeoutMachine`, `taskMachine`, `inspectionMachine`, `equipmentMachine`, `scheduleMachine`, `drawingMachine`, `documentMachine`, `projectMemberMachine`, `agentStreamMachine`) through `useMachine()` in production components is **descoped from the 90-day plan**. The machines remain in their current role: domain-model libraries consumed by mutation hooks, status helpers, and UI config.

This decision is **not** a deferral to Lap 2 or Lap 3. It is a removal from the planned work.

---

## Context

`STATE_MACHINE_INVENTORY_2026-05-03.md` documented the actual usage of all 15 machines. Three patterns dominate:

- **Pattern A — Mutation-time validation.** Mutation hooks consult `getValidTransitions(currentStatus, userRole)` before issuing the Supabase update.
- **Pattern B — Read-side status config.** Components import `get<Entity>StatusConfig(status)` to render status pills with the correct label/color.
- **Pattern C — Derived helpers.** Functions like `getBallInCourt`, `calculateG702`, `deriveStatusFromProgress` use the machine's transition table as the source of truth without instantiating an actor.

**Pattern D — `useMachine()` runtime actor lifetime in components — does not exist anywhere in the production codebase.** The constructed `setup({...})` machine values export from each file but are consumed only by tests (`lifecycles.test.ts`, `rfi-flow.test.ts`).

---

## Why descope, not defer

The original Lap 1 plan assumed wiring 15 machines through `useMachine` was "5 per day mechanical work." It isn't. For `rfiMachine` alone — the smallest typical entity machine — wiring through `useMachine` in `src/pages/RFIs.tsx` requires:

1. Picking a host component for each RFI's actor lifetime (the page renders RFIs from a React Query cache; no per-row component instance "owns" the actor today)
2. Initializing the machine with the row's current status as initial state when the component mounts; syncing `state.value` back to the query cache on transitions
3. Handling the realtime case: when another user transitions an RFI in Supabase, the local actor receives an `xstate.update` event and not just a React Query rerender
4. Replacing the existing mutation-time validation (which is correct today) with `state.can(eventName)` calls at the UI button level

This is a **substantial architectural change** to how every entity's state flows through the app. It's defensible if the goal is event-sourced UI — every state transition the system has made, including from other users, in real time, with derived UI states like "submitting" — but that's not Lap 1's goal. Lap 1's goal is subtraction. Lap 2's goal is the soft-pilot PMF signal. Lap 3's goal is auto-execute + the first paid contract. None of these require the architectural change.

Doing the architectural rewrite now would be exactly the kind of "churn" Lap 1 explicitly fought to remove.

---

## When this decision should be revisited

Only when there is an explicit UX motivation that `useMachine` solves and other architectures don't. Candidates:

- **Multi-user real-time state preview.** "I see the RFI status flip the moment the architect updates it, animated." → `useMachine` + Supabase realtime gives this for free.
- **Animated state-transition affordances.** "The submittal card slides through stages with a transition between each." → state-driven animations want a state primitive.
- **Optimistic UI with crash-safe rollback.** "I tap approve; the UI flips immediately; if the server rejects, the UI rolls back deterministically." → state machines are good at this; React Query's `onError` rollback is sufficient for now.

If any of these become real product requirements, revisit. Until then, the machines stay where they are.

### The realistic path if/when revisited

Per the Inventory's recommendations:

1. **One machine at a time, tied to a real UX feature.** `agentStreamMachine` first because it's the natural fit (idle → streaming → awaiting_approval → completed/error is genuinely event-driven and the existing UI already half-emulates a state machine).
2. **Per-feature spike + retro.** Wire one, ship it, observe what breaks, decide whether to roll the pattern across other entities.
3. **Decision as an ADR each time.** Every machine wired = a written architectural call.

---

## Consequences

### Positive

- Lap 1 closure receipt (Day 30) accurately reflects what shipped (no "wiring deferred" footnote)
- Lap 2 Day 22–24 of the new plan freed for other work (Lap 2 has no use for those 3 days, so the slack flows to risk buffer)
- The substrate is honest: machines are validators + helpers, not actors
- Future contributors don't waste time looking for `useMachine` calls that aren't there

### Negative

- The current README + tracker still gestures at "state machines wired" as a finished item; we have to update those references
- We lose the "every status change goes through an XState actor" architectural cleanliness. We keep "every status change is validated by an XState transition table" — which is what actually matters for correctness; the actor part was aesthetic
- If a future engineer joining the project assumes the machines are wired and writes against `useMachine`, they'll be surprised. ADR-009 in the index head-off this confusion

### Neutral

- The 15 machines remain real engineering investment. They are extensively unit-tested via `lifecycles.test.ts` and document the system's status semantics formally. Their value is in the validation layer, not the runtime actor

---

## What we explicitly DO keep from the original Days 22–26

| Day | Original target | Status |
|---|---|---|
| 22–24 | Wire 15 machines to `useMachine` | **DESCOPED — this ADR** |
| 25 | XState devtool in dev | **Shipped** (per Day 26 receipt) |
| 26 | Friday gate sweep — verify every mutation consults a transition validator | **Shipped** (per Day 26 receipt) |

Days 25 and 26 delivered the actual subtraction-era value: a debugging affordance + verification that the validator layer is consistently applied. Day 22–24 was the speculative architectural piece, and that's the piece we drop.

---

## Update to other docs

- `INDEX.md` → mark `STATE_MACHINE_INVENTORY_2026-05-03.md` row as "Descoped per ADR-009"
- `CLAUDE.md` → update sprint-invariant section to remove any implication that machines are wired through `useMachine`
- `LAP_1_CARRYOVER_PLAN_2026-05-04.md` → reference this ADR
- `SiteSync_90_Day_Tracker.xlsx` → annotate Days 22–24 of Lap 1 as "descoped — see ADR-009"; the Status column stays at whatever it currently is for those rows

---

## Tracker update

`SiteSync_90_Day_Tracker.xlsx` → "Decisions" sheet → new row 12:

| # | Date | Title | Decider | Considered | Rationale |
|---|---|---|---|---|---|
| 12 | 2026-05-04 | Descope `useMachine` wiring for the 15 XState machines; keep them as domain libraries | Walker | Wire all 15 in Lap 2 / Lap 3; wire `agentStreamMachine` only as a single-feature spike; full event-sourced UI rewrite | The machines already provide validation, status config, and derived helpers in their current role. `useMachine` wiring would be a substantial architectural change without a UX motivation that justifies it. Re-open only when an explicit UX requirement emerges. |
