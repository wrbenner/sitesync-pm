# State Machine Inventory — Day 20 of Lap 1

**Date:** 2026-05-03
**Author:** Claude (acting under Walker)
**Status:** Replaces the placeholder `STATE_MACHINE_INVENTORY_2026-05-01.md`

---

## TL;DR

Fifteen XState machines exist under `src/machines/`. **Zero** are
currently driven by `useMachine()` in production — they are used as
**domain-model libraries** (status types, transition validators, ball-
in-court resolvers, urgency / config helpers). Mutations consult the
machines' transition tables but the runtime XState actor isn't mounted
in any component.

This finding **rescopes Days 22–26** of the original Lap-1 plan. The
audit assumed wiring 5 machines per day was a small mechanical change.
It isn't — components today don't have a host for the actor's lifetime,
the transition validators are baked into mutation hooks, and the UI
reads status from React Query data, not from `state.value`.

The inventory below documents what each machine actually IS today.
Recommendations at the bottom propose a realistic Lap-1 scope:
**Day 25 (devtool)** + **Day 26 (Friday gate sweep)** make sense and
deliver value; **Day 22–24 (wire 15 through useMachine)** should be a
post-Lap-1 initiative with explicit UX motivation.

---

## The 15 Machines

| # | Machine | LOC | Importers | Type union | Production role |
|---|---|---|---|---|---|
| 1 | `rfiMachine` | 188 | 7 | `RFIState` (6 states) | Validation + ball-in-court + UI helpers |
| 2 | `paymentMachine` | 280 | 12 | `PaymentStatus` (8) + `LienWaiverStatus` + `LienWaiverState` + `G702Data`/`G703LineItem` types + `calculateG702`/`calculateG703LineItem` functions | Validation, calculator, status config |
| 3 | `submittalMachine` | 255 | 9 | `SubmittalState` + `SubmittalStamp` | Validation + UI config |
| 4 | `changeOrderMachine` | 220 | 8 | `ChangeOrderState` + `ChangeOrderType` + `ReasonCode` | Validation, type-progression helpers |
| 5 | `dailyLogMachine` | 231 | 7 | `DailyLogState` (5) + `ENTRY_TYPES` constant | Validation + canEditLog rule |
| 6 | `punchItemMachine` | 114 | 5 | `PunchItemState` (5) | Validation + status config |
| 7 | `closeoutMachine` | 175 | 4 | (closeout phases) | Workflow validation |
| 8 | `taskMachine` | 83 | 4 | (task lifecycle) | Validation |
| 9 | `inspectionMachine` | 150 | 3 | `InspectionStatus` | Validation, score config |
| 10 | `equipmentMachine` | 90 | 3 | (equipment lifecycle) | Validation |
| 11 | `scheduleMachine` | 140 | 3 | `ScheduleStatus` (6) | Status derivation from progress |
| 12 | `drawingMachine` | 180 | 2 | `DrawingStatus` | Validation, days-since-issued |
| 13 | `documentMachine` | 160 | 2 | (document lifecycle) | Validation |
| 14 | `projectMemberMachine` | 138 | 2 | `MemberLifecycleState` | Role-permission derivation |
| 15 | `agentStreamMachine` | 151 | 1 | `AgentStreamState` | Idle/streaming/approval — **the only machine likely to benefit from useMachine** |

Total: 15 machines, ~2,755 LOC, 72 importer files.

---

## How They're Actually Used

### Pattern A: Mutation-time validation (most common)

```ts
// in src/hooks/mutations/state-machine-validation-helpers.ts
import { rfiMachine, getValidTransitions } from '../../machines/rfiMachine'
// Before issuing the supabase update, check the requested transition
// against getValidTransitions(currentStatus, userRole). If invalid, throw.
```

### Pattern B: Read-side status config

```ts
// in src/components/RfiCard.tsx
import { getRFIStatusConfig } from '../../machines/rfiMachine'
const cfg = getRFIStatusConfig(rfi.status)
// → { label, color, bg } for the status pill
```

### Pattern C: Derived helpers

```ts
// rfiMachine: getBallInCourt, getDueDateUrgency, getDaysOpen
// paymentMachine: calculateG702, calculateG703LineItem
// scheduleMachine: deriveStatusFromProgress
```

### Pattern D (rare): The XState `setup({...})` runtime

Each machine does export `const xMachine = setup({...})`, but the
constructed machine value is NOT consumed by `useMachine()` anywhere
in `src/components` or `src/pages`. It's reachable from tests
(`lifecycles.test.ts`, `rfi-flow.test.ts`) which exercise the
state graph in isolation.

---

## What "wire through useMachine" Would Actually Mean

For `rfiMachine` — the smallest of the typical entity machines — wiring
through `useMachine` in `src/pages/RFIs.tsx` looks like this:

1. Pick a host component for each RFI's actor lifetime. Currently
   the page renders RFIs from a React Query cache; there's no per-
   row component instance to "own" the actor.
2. Initialize the machine with the row's current status as initial
   state when the component mounts, sync `state.value` back to the
   query cache when transitions fire.
3. Handle the realtime case: when another user transitions an RFI in
   Supabase, the local actor needs to receive a `xstate.update` event,
   not just rerender from React Query.
4. Replace the existing mutation-time validation (which is correct
   today) with `state.can(eventName)` calls at the UI button level.

That's a **substantial architectural change** to how every entity's
state flows. It's defensible if the goal is event-sourced UI (e.g.,
"my UI must reflect every transition the system has made, including
ones from other users, in real time, with derived UI states like 'submitting'").

It's not "wire through useMachine in a day."

---

## Recommendations for Days 22–26

### KEEP — Day 25 (XState devtool in dev) — 30 min

Mount `@xstate/inspect` in dev so the existing machines light up when
exercised by tests + manual interactions. Doesn't require any
component-level wiring; just a dev-only devtool that observes spawned
actors. **Real value:** lets a developer see "this is the RFI machine,
these are the transitions it allows, this is the current state" while
debugging.

### KEEP — Day 26 (Friday gate sweep) — 1–2 hr

Audit every `*Service.ts` and `mutations/*.ts` to confirm:
- Every status transition consults the relevant machine's
  `getValidTransitions()`
- No raw `update({ status: 'X' })` bypasses exist (a mutation that
  can change status without going through the validator)
- Tests exist for invalid-transition rejection per machine

This is the actual subtraction work — verify the validation discipline
is consistently applied. Likely to find a few drift sites; small surgical
PRs to close them.

### DEFER to a post-Lap-1 initiative — Days 22–24 wiring

The "wire 5 machines per day through useMachine" goal would deliver
value if there's a UX problem the architecture solves (e.g., multi-
user real-time state preview, animated state-transition affordances,
optimistic UI with crash-safe rollback). Without that motivation, it's
an architectural rewrite for its own sake — exactly the kind of
"churn" Lap 1 is supposed to remove, not add.

If the team does want this for a future lap, the realistic path is:

- **One machine at a time, tied to a real UX feature.** E.g., wire
  `agentStreamMachine` first because it's the natural fit (idle → streaming →
   awaiting_approval → completed/error is genuinely event-driven).
- **Per-feature spike + retro.** Wire one, ship it, see what breaks,
  decide whether to roll the pattern across the others.

---

## What Day 26's Friday Gate Sweep Should Verify

For each machine in the table above, confirm:

1. **Transition validator** is the only path to status changes.
   Run: `grep -rn "update.*status:" src/services src/hooks/mutations`
   Each result must call `getValid*Transitions()` first.
2. **Test coverage** of the invalid-transition rejection path. The
   audit lists `lifecycles.test.ts` as a single combined test —
   each machine should have its own failing-transition assertion.
3. **No client-side bypass.** UI buttons that fire transitions read
   from `getValid*Transitions()` to determine enabled/disabled state.
   `grep -rn "disabled.*status" src/pages src/components` and confirm
   each one reads from the machine helper, not a hard-coded list.

---

## Summary

The original Lap-1 framing of state machines as "wire 15 through
`useMachine` in 3 days" doesn't match the codebase. The machines are
already doing useful work as domain-model libraries; the unfinished
Lap-1 work in this theme is **gate verification (Day 26)**, not
**runtime wiring (Days 22–24)**.

Day 22-24 of the tracker should be re-marked as deferred-to-future-lap;
Day 25 + 26 stay in scope as small, valuable items.
