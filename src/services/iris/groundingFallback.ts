// ─────────────────────────────────────────────────────────────────────────────
// groundingFallback — Moment 2.5 client-side safety net (Session C)
// ─────────────────────────────────────────────────────────────────────────────
// Wraps Session A's `iris-ground` edge function call with three layers:
//
//   1. 5-second wall-clock timeout (hard cut — Session A's server budget is
//      4s/lane × 3 lanes; the client gives one extra second of slack).
//   2. Empty-lane detection — if any of the three lanes is missing/empty in
//      the response, treat it as a partial failure.
//   3. Fixture fallback for demo anchor RFIs only — if the live call fails
//      OR times out OR returns an empty lane, swap in the bundled fixture
//      from `src/lib/demoGroundingFixtures.ts` and emit a single toast.
//
// Session A's `grounding.ts` integrates this in two lines. Either:
//
//   import { runGroundingWithFallback } from './groundingFallback'
//   …
//   return runGroundingWithFallback({ entityType, entityId, fetchLive })
//
// where `fetchLive` is the actual edge-function call. The helper handles
// timeout, empty-lane detection, fixture fallback, and the degraded-mode
// toast on its own.
// ─────────────────────────────────────────────────────────────────────────────

import { toast } from 'sonner'

import {
  getDemoGroundingFixture,
  hasDemoGroundingFixture,
  type GroundingResponse as FixtureGroundingResponse,
} from '../../lib/demoGroundingFixtures'

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * Shape returned by Session A's edge function. Mirrors
 * `supabase/functions/iris-ground/index.ts` GroundResponse — kept loose here
 * so this module doesn't fail to compile if Session A iterates on the shape.
 */
export interface LiveGroundingResponse {
  project: { response: unknown | null; error: unknown | null; latency_ms: number }
  world: { response: unknown | null; error: unknown | null; latency_ms: number }
  structure: { response: unknown | null; error: unknown | null; latency_ms: number }
  latency_ms: number
  cached: boolean
}

/**
 * Discriminated union the UI (Session A) ultimately renders. Either the live
 * shape from the edge function, or the demo-narrative fixture shape from
 * `demoGroundingFixtures.ts`. Session A's UI normalizes both.
 */
export type GroundingResult =
  | { kind: 'live'; data: LiveGroundingResponse; degraded: false; reason: null }
  | { kind: 'fixture'; data: FixtureGroundingResponse; degraded: true; reason: DegradedReason }

export type DegradedReason =
  | 'timeout'        // 5s budget exceeded
  | 'fetch_failed'   // network / 5xx / 429 / parse error
  | 'empty_lane'     // call succeeded but at least one lane was empty
  | 'no_fixture'     // for entities without a fixture; never returned with kind=fixture

// ── Constants ────────────────────────────────────────────────────────────────

const CLIENT_TIMEOUT_MS = 5000
const DEGRADED_TOAST_ID = 'iris-grounding-degraded'
const DEGRADED_TOAST_MESSAGE = 'Showing cached grounding — live providers slow.'

// ── Helpers ──────────────────────────────────────────────────────────────────

function isLaneEmpty(
  lane: { response: unknown | null; error: unknown | null } | undefined | null,
): boolean {
  if (!lane) return true
  // Live response is non-null only when the provider settled successfully.
  // Treat null-response OR explicit error as empty for fallback purposes.
  return lane.response == null || lane.error != null
}

function hasAnyEmptyLane(r: LiveGroundingResponse): boolean {
  return isLaneEmpty(r.project) || isLaneEmpty(r.world) || isLaneEmpty(r.structure)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`grounding call exceeded ${ms}ms`))
    }, ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

class TimeoutError extends Error {
  readonly isTimeout = true
}

function notifyDegraded(reason: DegradedReason): void {
  // Single toast id keeps a flurry of failed clicks from stacking.
  toast.message(DEGRADED_TOAST_MESSAGE, {
    id: DEGRADED_TOAST_ID,
    description:
      reason === 'timeout'
        ? 'Live providers exceeded the 5-second budget.'
        : reason === 'empty_lane'
          ? 'A provider returned an empty lane.'
          : 'Network or provider error.',
    duration: 4000,
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface RunGroundingArgs {
  entityType: 'rfi'
  entityId: string
  /** Session A's actual edge-function call — pure side-effect, returns the live shape. */
  fetchLive: () => Promise<LiveGroundingResponse>
  /** Override the 5s client timeout (testing only). */
  timeoutMs?: number
  /** Suppress the degraded toast (Playwright spec only). */
  silent?: boolean
}

/**
 * Run a grounding call with timeout + empty-lane detection + fixture fallback.
 *
 * Returns a `GroundingResult` discriminated union. The caller (Session A's
 * grounding.ts) is responsible for normalizing the two `kind`s into whatever
 * shape the UI consumes.
 */
export async function runGroundingWithFallback(
  args: RunGroundingArgs,
): Promise<GroundingResult> {
  const timeoutMs = args.timeoutMs ?? CLIENT_TIMEOUT_MS
  const silent = args.silent === true

  const fixture = getDemoGroundingFixture(args.entityType, args.entityId)

  let live: LiveGroundingResponse | null = null
  let reason: DegradedReason | null = null

  try {
    live = await withTimeout(args.fetchLive(), timeoutMs)
  } catch (err) {
    reason = err instanceof TimeoutError ? 'timeout' : 'fetch_failed'
    live = null
  }

  if (live && !hasAnyEmptyLane(live)) {
    return { kind: 'live', data: live, degraded: false, reason: null }
  }

  if (live && hasAnyEmptyLane(live)) {
    reason = 'empty_lane'
  }

  // Live failed or partial — fall back to fixture if we have one.
  if (fixture) {
    if (!silent) notifyDegraded(reason ?? 'fetch_failed')
    return {
      kind: 'fixture',
      data: { ...fixture, generatedAt: new Date().toISOString() },
      degraded: true,
      reason: reason ?? 'fetch_failed',
    }
  }

  // No fixture and no live data — re-throw so Session A can render a real
  // error state instead of silently faking success.
  if (!live) {
    throw new GroundingFailure(reason ?? 'fetch_failed')
  }

  // Live data with at least one empty lane and no fixture: surface it as-is
  // and let the UI render per-lane empty states. This is the "honest partial"
  // path — the demo path will always have a fixture, so this branch is for
  // production traffic against non-anchor entities.
  return { kind: 'live', data: live, degraded: false, reason: null }
}

export class GroundingFailure extends Error {
  readonly reason: DegradedReason
  constructor(reason: DegradedReason) {
    super(`Iris grounding failed: ${reason}`)
    this.name = 'GroundingFailure'
    this.reason = reason
  }
}

// ── Re-exports for the Playwright spec ───────────────────────────────────────
// Spec asserts: clicking "Ground in the world" on RFI #15 with the network
// disabled returns the fixture in <500ms. Re-exporting these keeps the spec's
// import surface tight and stable.
export { getDemoGroundingFixture, hasDemoGroundingFixture }
export { DEMO_ANCHOR_RFI_IDS, DEMO_ANCHOR_ENTITY_IDS } from '../../lib/demoGroundingFixtures'
