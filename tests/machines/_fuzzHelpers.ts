/**
 * Shared fuzz harness for XState machines.
 *
 * Hand-rolled (no `@xstate/test` dep) — for each (state × event) pair we:
 *   1. Spawn an actor.
 *   2. Drive it to the target state by replaying a precomputed event path.
 *   3. Send the candidate event.
 *   4. Capture the resulting snapshot and stop the actor.
 *
 * Then per-pair we assert one of:
 *   - the snapshot.value transitioned to a *defined* state name, OR
 *   - the snapshot.value did NOT change (the event was rejected — no silent
 *     non-deterministic drop into `undefined` / an off-graph state).
 *
 * Used by every `tests/machines/<machine>.fuzz.spec.ts`.
 */
import { createActor, type AnyStateMachine, type EventObject } from 'xstate'

export interface FuzzCase {
  state: string
  event: string
  eventPayload?: Record<string, unknown>
}

export interface FuzzReachability {
  /**
   * For each non-initial state, the list of events (in order) that drives the
   * machine from the initial state to that state. The events are sent in
   * sequence on a fresh actor; payload-bearing events use minimal stub
   * payloads supplied by the caller via `eventPayloadFor`.
   */
  path: Record<string, Array<EventObject>>
  /**
   * Map state-name → list of every event the machine could ever try to fire
   * (the union of `events` from the machine type). The fuzz matrix is
   * `states × eventNames`.
   */
  states: string[]
  eventNames: string[]
}

/**
 * Send a sequence of events on a fresh actor, snapshot the result, and stop.
 * Returns the final state-value as a string ('draft' | 'open' | … | 'final').
 */
export function driveTo(
  machine: AnyStateMachine,
  events: EventObject[],
): { state: string; status: 'active' | 'done' | 'error' | 'stopped' } {
  const actor = createActor(machine)
  actor.start()
  for (const e of events) {
    actor.send(e)
  }
  const snap = actor.getSnapshot()
  const value = typeof snap.value === 'string' ? snap.value : JSON.stringify(snap.value)
  // `status` is xstate v5 actor lifecycle status.
  const status = snap.status as 'active' | 'done' | 'error' | 'stopped'
  actor.stop()
  return { state: value, status }
}

/**
 * For every (state, event) pair, build a fresh actor at `state` and try
 * sending `event`. Returns the post-send state and a boolean flagging whether
 * the event was accepted (state changed) or rejected (state held).
 */
export function fuzzMatrix(
  machine: AnyStateMachine,
  reachability: FuzzReachability,
  payloadFor: (event: string) => Record<string, unknown>,
): Array<{
  state: string
  event: string
  before: string
  after: string
  accepted: boolean
  reached: boolean // did we actually drive to `state` first?
}> {
  const results: Array<{
    state: string
    event: string
    before: string
    after: string
    accepted: boolean
    reached: boolean
  }> = []

  for (const targetState of reachability.states) {
    const path = reachability.path[targetState] ?? []
    for (const event of reachability.eventNames) {
      const actor = createActor(machine)
      actor.start()
      for (const e of path) actor.send(e)
      const beforeSnap = actor.getSnapshot()
      const before = typeof beforeSnap.value === 'string' ? beforeSnap.value : JSON.stringify(beforeSnap.value)
      const reached = before === targetState

      const payload = payloadFor(event)
      try {
        actor.send({ type: event, ...payload } as EventObject)
      } catch (_err) {
        // XState v5 throws on unknown event types when `strict` is on; we treat
        // that as a rejected event (the contract test below would catch a
        // silent drop, but raising is also acceptable).
        results.push({
          state: targetState,
          event,
          before,
          after: before,
          accepted: false,
          reached,
        })
        actor.stop()
        continue
      }

      const afterSnap = actor.getSnapshot()
      const after = typeof afterSnap.value === 'string' ? afterSnap.value : JSON.stringify(afterSnap.value)
      results.push({
        state: targetState,
        event,
        before,
        after,
        accepted: before !== after,
        reached,
      })
      actor.stop()
    }
  }

  return results
}

/**
 * Asserts that every snapshot returned by `fuzzMatrix` has a `value` that is
 * a defined string belonging to the machine's known state set. A silently
 * dropped event MUST leave the actor in `before` (no jump to `undefined`).
 */
export function assertNoSilentDrops(
  rows: Array<{ state: string; event: string; before: string; after: string }>,
  knownStates: string[],
): void {
  for (const row of rows) {
    if (!knownStates.includes(row.after)) {
      throw new Error(
        `Silent drop in (state=${row.state}, event=${row.event}): post-send state '${row.after}' is not in known states [${knownStates.join(', ')}]`,
      )
    }
  }
}
