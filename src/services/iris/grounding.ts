// ─────────────────────────────────────────────────────────────────────────────
// Iris grounding — client-side service for Moment 2.5
// ─────────────────────────────────────────────────────────────────────────────
// Calls the `iris-ground` edge function and returns a normalized result the
// UI can render. Wraps the network call with the Session-C safety net
// (5s timeout + empty-lane detection + fixture fallback) so a quota burst
// or network blip during the demo never produces an empty drawer.
//
// Two ways to consume:
//
//   import { runGrounding } from '@/services/iris/grounding'
//   const result = await runGrounding({ entityType: 'rfi', entityId, projectId })
//   if (result.kind === 'live') { ... } else { ... fixture ... }
//
//   // or the convenience hook
//   const grounding = useGrounding()
//   await grounding.run({ entityType: 'rfi', entityId, projectId })
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react'

import { supabase } from '../../lib/supabase'
import {
  runGroundingWithFallback,
  type GroundingResult,
  type LiveGroundingResponse,
  GroundingFailure,
} from './groundingFallback'

export type { GroundingResult, LiveGroundingResponse } from './groundingFallback'
export { GroundingFailure } from './groundingFallback'

interface RunGroundingParams {
  entityType: 'rfi'
  entityId: string
  projectId: string
  /** For tests — bypass the toast notification on degradation. */
  silent?: boolean
}

/**
 * Invoke the iris-ground edge function and apply the safety-net wrapper.
 * Returns a discriminated union: `{ kind: 'live' }` for a real response, or
 * `{ kind: 'fixture' }` if we fell back to a bundled demo fixture.
 *
 * Throws `GroundingFailure` only when the call failed AND no fixture exists.
 */
export async function runGrounding(params: RunGroundingParams): Promise<GroundingResult> {
  const fetchLive = async (): Promise<LiveGroundingResponse> => {
    const { data, error } = await supabase.functions.invoke('iris-ground', {
      body: {
        entity_type: params.entityType,
        entity_id: params.entityId,
        project_id: params.projectId,
      },
    })
    if (error) {
      // Surface the edge function error so the wrapper classifies it as
      // fetch_failed and falls back to fixture.
      throw error
    }
    return data as LiveGroundingResponse
  }

  return runGroundingWithFallback({
    entityType: params.entityType,
    entityId: params.entityId,
    fetchLive,
    silent: params.silent,
  })
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseGroundingState {
  loading: boolean
  result: GroundingResult | null
  error: GroundingFailure | null
}

/**
 * React hook wrapper around `runGrounding`. Owns the loading/result/error
 * state so callers can render a loading spinner, then the drawer.
 */
export function useGrounding() {
  const [state, setState] = useState<UseGroundingState>({
    loading: false,
    result: null,
    error: null,
  })

  const run = useCallback(async (params: RunGroundingParams) => {
    setState({ loading: true, result: null, error: null })
    try {
      const result = await runGrounding(params)
      setState({ loading: false, result, error: null })
      return result
    } catch (err) {
      const failure =
        err instanceof GroundingFailure
          ? err
          : new GroundingFailure('fetch_failed')
      setState({ loading: false, result: null, error: failure })
      throw failure
    }
  }, [])

  const reset = useCallback(() => {
    setState({ loading: false, result: null, error: null })
  }, [])

  return { ...state, run, reset }
}
