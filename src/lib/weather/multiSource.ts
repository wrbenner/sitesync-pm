// =============================================================================
// Multi-source weather fetcher (provider-agnostic façade)
// =============================================================================
// Wraps three providers behind a uniform interface so reconcileWeather can
// chew them all the same way. Each provider returns a WeatherSample (or
// null on error — the reconciler handles the missing-source case as
// "fewer sources reduce confidence", not as a failure).
// =============================================================================

import type { WeatherSample } from './reconcile'

export interface FetchInputs {
  lat: number
  lng: number
  /** YYYY-MM-DD — UTC. Providers map this to their daily endpoints. */
  date: string
}

export type ProviderFn = (inputs: FetchInputs) => Promise<WeatherSample | null>

/**
 * Run every provider in parallel and collect the non-null samples. A timeout
 * around each call ensures one slow provider doesn't hold up the others.
 */
export async function fetchAllSources(
  providers: ProviderFn[],
  inputs: FetchInputs,
  timeoutMs = 6000,
): Promise<WeatherSample[]> {
  const withTimeout = providers.map(p =>
    Promise.race([
      p(inputs),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]).catch(() => null),
  )
  const results = await Promise.all(withTimeout)
  return results.filter((s): s is WeatherSample => s != null)
}

// ── Provider stubs ──────────────────────────────────────────
// Real implementations live in supabase/functions/weather-multi-source/.
// These stubs are kept here as the typed interface so app-side callers
// have a single import surface.

export const noaaProvider: ProviderFn = async (_) => null
export const weatherApiProvider: ProviderFn = async (_) => null
export const openWeatherProvider: ProviderFn = async (_) => null
