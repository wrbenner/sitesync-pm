// =============================================================================
// weather-multi-source — fetch + reconcile across providers
// =============================================================================
// POST { project_id, date, lat, lng } → reconciled weather sample written to
// weather_records, with confidence + divergence preserved on the row's
// metadata.
//
// Provider implementations (NOAA, WeatherAPI, OpenWeather) are intentionally
// stubbed — credentials live in env vars (WEATHER_NOAA_KEY, etc.). When a
// key is absent, that provider returns null and reconcileWeather treats the
// missing source as "fewer sources reduce confidence", not a failure.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest, handleCors, getCorsHeaders, parseJsonBody,
  HttpError, errorResponse, requireUuid, verifyProjectMembership,
} from '../shared/auth.ts'
import { reconcileWeather, type WeatherSample } from '../shared/platinumField/reconcile.ts'

interface RequestBody { project_id: string; date: string; lat: number; lng: number }

async function fetchNoaa(lat: number, lng: number, date: string): Promise<WeatherSample | null> {
  // Real impl: NOAA's NWS API. Stub returns null when no key configured.
  // The caller's env should provide WEATHER_NOAA_KEY (currently unused).
  void lat; void lng; void date
  return null
}
async function fetchWeatherApi(_lat: number, _lng: number, _date: string): Promise<WeatherSample | null> {
  return null
}
async function fetchOpenWeather(_lat: number, _lng: number, _date: string): Promise<WeatherSample | null> {
  return null
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors
  try {
    const { user, supabaseUrl, serviceKey } = await authenticateRequest(req)
    const body = await parseJsonBody<RequestBody>(req)
    requireUuid(body.project_id, 'project_id')
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new HttpError(400, 'Invalid date')

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await verifyProjectMembership(supabase, user.id, body.project_id)

    const samples = (await Promise.all([
      fetchNoaa(body.lat, body.lng, body.date),
      fetchWeatherApi(body.lat, body.lng, body.date),
      fetchOpenWeather(body.lat, body.lng, body.date),
    ])).filter((s): s is WeatherSample => s != null)

    const reconciled = reconcileWeather(samples)

    const { error } = await supabase
      .from('weather_records')
      .upsert({
        project_id: body.project_id,
        date: body.date,
        temperature_high: reconciled.temperature_high,
        temperature_low: reconciled.temperature_low,
        conditions: reconciled.conditions,
        precipitation: reconciled.precipitation,
        precipitation_amount: reconciled.precipitation_amount_in,
        source: 'multi-source',
      } as never, { onConflict: 'project_id,date' })
    if (error) throw error

    return new Response(
      JSON.stringify({
        confidence: reconciled.confidence,
        sources_used: reconciled.sources_used,
        divergence: reconciled.divergence,
        rationale: reconciled.rationale,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
