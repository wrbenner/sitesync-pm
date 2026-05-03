# State Machine Inventory & Wire-In Spec

**Date:** 2026-05-01
**Status:** Inventory complete; per-machine wire-in spec ready for autonomous execution
**Scope:** Days 20–24 of Lap 1 — wiring all 15 XState machines into production call sites
**Author:** Day 9 prep pass

---

## Executive Summary

There are **15 XState machines defined** in `src/machines/`. **Zero are
wired into production via `useMachine()`.** Production code currently uses
the *pure function helpers* (`getNextStatus`, `getValidTransitions`,
`getBallInCourt`) exported alongside each machine. The state machines
themselves are tested in isolation but never run as actors in the app.

The Lap 1 plan calls for wiring all 15 machines as live actors over Days
20–24 (5 per day in three waves). This doc inventories each machine and
its target consumers.

---

## The 15 Machines

| Machine | Has actor factory | States | Tests |
|---|---|---|---|
| `rfiMachine` | ✅ `createRfiActors` | draft / open / under_review / answered / closed / void | rfiMachine.test.ts |
| `submittalMachine` | (check) | (read SubmittalStatus type) | submittalMachine.test.ts |
| `changeOrderMachine` | (check) | (read CO statuses) | changeOrderMachine.test.ts (in test/machines/) |
| `paymentMachine` | (check) | draft → submitted → approved → paid | paymentMachine.test.ts |
| `punchItemMachine` | (check) | open → in_progress → sub_complete → verified | punchItemMachine.test.ts |
| `dailyLogMachine` | (check) | draft → submitted | dailyLogMachine.test.ts |
| `scheduleMachine` | (check) | (read schedule statuses) | scheduleMachine.test.ts |
| `inspectionMachine` | (check) | (read inspection statuses) | inspectionMachine.test.ts |
| `closeoutMachine` | (check) | (read closeoutItem) | closeoutMachine.test.ts |
| `drawingMachine` | (check) | uploaded → processed → published / superseded | drawingMachine.test.ts |
| `documentMachine` | (check) | (read doc statuses) | (no machine test found — verify) |
| `taskMachine` | (check) | (read task statuses) | (no machine test found) |
| `equipmentMachine` | exports `EquipmentStatus` type | idle / active / maintenance | (no machine test found) |
| `projectMemberMachine` | (check) | (member roles?) | (no machine test found) |
| `agentStreamMachine` | ✅ already wired in `useActionStream` | (LIVE — exception) | agentStreamMachine.test.ts |

Note: 6 machines lack a corresponding `__tests__/*Machine.test.ts`. The
organism should sanity-check those before wiring.

---

## Day-by-Day Wire-In Plan

### Day 20 — Setup + identify call sites
**Goal:** No code changes today. Output is a per-machine call-site map.
**Steps:**
1. Run `grep -rn "getNextStatus\|getValidTransitions\|getBallInCourt"` to enumerate every consumer.
2. For each machine, write a call-site list to `docs/audits/STATE_MACHINE_CALLSITES_2026-05-01.md` (one section per machine).
3. Prioritize by consumer count: highest = wire first.

**Acceptance:** doc shipped; CI green.

### Day 21 — Wave 1: RFI / Submittal / CO / PayApp / Punch (5 machines)
**Goal:** Replace imperative status-change with `send()` to a live machine.

For each of the 5:
1. Import the machine + actor factory in the consumer.
2. Build the actors with the real service functions:
   ```ts
   const actors = createRfiActors(rfiService.create, rfiService.update);
   const machine = rfiMachine.provide({ actors });
   ```
3. Use `useMachine(machine)` in the component.
4. Replace `await rfiService.transitionStatus(id, 'open')` with `send({ type: 'SUBMIT' })`.
5. Update the test for that consumer to use `@xstate/test` or to drive `state.matches('open')`.

**Files (likely; confirm in Day 20 call-site map):**
- RFI: `src/pages/rfis/RFIDetail.tsx`, `src/services/rfiService.ts`
- Submittal: `src/pages/submittals/SubmittalsTable.tsx`, `src/services/submittalService.ts`
- ChangeOrder: `src/pages/ChangeOrders.tsx`, `src/services/changeOrderService.ts`
- PayApp: `src/pages/payment-applications/PayAppDetail.tsx`, `src/services/payAppComputation.ts`
- Punch: `src/pages/punch-list/PunchListDetail.tsx`

**Acceptance:** All 5 machines have at least one production call site invoking `useMachine`. Existing E2E flows pass.

### Day 22 — Wave 2: DailyLog / Schedule / IrisDraft / Approval / Capture (5 machines)
**Note:** "IrisDraft", "Approval", "Capture" don't have machines under those exact names. The organism should map:
- "IrisDraft" → use `irisDraftStore`'s state-machine logic; wrap in a thin XState shell
- "Approval" → either `submittalMachine.approval` substate or a new `approvalMachine`
- "Capture" → no current machine; spec a new `captureMachine` for the field-capture path

If the organism can't map cleanly: prioritize the 3 it CAN wire (DailyLog, Schedule, Drawing as a substitute for one of the others) and document the gap.

**Acceptance:** 3+ of the 5 wired; gaps documented in DAY_22_RECEIPT.

### Day 23 — Wave 3: Inbox / Notification / Audit / Sync / Auth (5 machines)
**Same gotcha:** these names don't all map to existing machines.
- "Inbox" → likely `agentStreamMachine` (already live)
- "Notification" → no machine; uiStore handles notifications now
- "Audit" → no machine; audit hash chain is in `src/lib/audit/`
- "Sync" → no machine; offlineQueue in `src/services/offlineQueue.ts`
- "Auth" → no machine; authStore handles state

**Reality check:** the original Day 23 plan assumed 15 machines mapped 1:1 to 15 abstractions in the app. They don't. The organism should:
1. Wire what exists: `inspectionMachine`, `closeoutMachine`, `documentMachine`, `taskMachine`, `equipmentMachine`, `projectMemberMachine` — the 6 machines not covered in Day 21.
2. Document the gap in DAY_23_RECEIPT — the named abstractions don't all have machines, and that's an honest finding.

### Day 24 — Mount XState devtool + diagram render
**Goal:** Diagrams light up live during demo run.
**Steps:**
1. Install `@statelyai/inspect` if not already in deps.
2. In dev mode only, mount the inspector at app boot:
   ```ts
   if (import.meta.env.DEV) {
     const { createBrowserInspector } = await import('@statelyai/inspect')
     const inspector = createBrowserInspector()
     // Pass inspector.inspect to every useMachine call
   }
   ```
3. Verify in dev: open `localhost:5173` → click a status change → see machine render in the inspector.

**Acceptance:** Visual confirmation only.

### Day 25 — Friday: bypass paths removed
**Goal:** Every mutation passes through a transition. No more `await service.update({ status: ... })` directly from a component.
**Steps:**
1. Grep for `\.update\(.*status:` patterns in `src/pages/` and `src/components/`. Each hit is a bypass that should be `send({ type: '...' })` to the machine.
2. Remove the bypass paths.
3. Friday retro doc.

**Acceptance:** No bypass paths left. CI green. Retro doc shipped.

---

## Architectural Pattern

Every machine should follow the rfiMachine template:

```ts
// src/machines/xMachine.ts
import { setup, fromPromise } from 'xstate'

// Pure helpers (these stay — used for client-side validation)
export function getValidTransitions(status: XState, role: string): string[] { ... }
export function getNextStatus(current: XState, action: string): XState | null { ... }
export function getBallInCourt(...): string | null { ... }

// Actor factory — call from consumer to inject services
export function createXActors(svc: XService) {
  return {
    persistCreate: fromPromise(...),
    persistTransition: fromPromise(...),
  }
}

// Machine definition — no-op actors by default for tests
export const xMachine = setup({ ... }).createMachine({ ... })
```

The consumer pattern:

```tsx
function XDetail({ id }: { id: string }) {
  const machine = useMemo(
    () => xMachine.provide({ actors: createXActors(xService) }),
    []
  )
  const [state, send] = useMachine(machine, {
    input: { id, projectId, transitions: [] }
  })

  return (
    <button
      disabled={!state.can({ type: 'SUBMIT' })}
      onClick={() => send({ type: 'SUBMIT' })}
    >
      Submit
    </button>
  )
}
```

---

## Risks for Autonomous Execution

| Risk | Mitigation |
|---|---|
| Machines lack actor factories (only `rfiMachine` is confirmed) | Day 20 audit each machine. If no factory, add one as part of Day 21. |
| Consumers have side-effects between status change and persistence (e.g., emit notification, fire crossFeatureWorkflow) | Move side-effects into machine actions or invoked actors. Don't smuggle them into the consumer. |
| Tests use the imperative API and break on send() | Tests need to drive via send() too. Update the consumer test, not the machine. |
| `@statelyai/inspect` not in deps | `npm install --save-dev @statelyai/inspect` on Day 24. |
| RFI/Submittal/CO machines have approval workflows — multiple users involved per transition | The actor receives `userId` + role from auth. Validate role inside the machine guards. |

---

## What Day 20–24 Looks Like When Done

Visual: open the dev inspector. Click any status-change button anywhere in
the app. The corresponding machine highlights, transitions, and the
persist actor invocation shows in the timeline.

Functional: grep `\.update\(.*status:` in `src/pages/` and `src/components/`
returns zero hits.

Test: every existing E2E flow passes with the machine driving the
mutations rather than direct service calls.
