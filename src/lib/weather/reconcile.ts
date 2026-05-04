// =============================================================================
// Multi-source weather reconciliation
// =============================================================================
// Pure consensus logic — given N independent weather observations for a day,
// pick the canonical value and emit a confidence band.
//
// Three independent agreeing sources is gold for a delay claim. One source
// disagreeing is fine — we go with the median. Wildly divergent sources
// (>5°F spread on temperature, mismatched precipitation) trigger
// confidence='low' with the discrepancy preserved on the daily log.
// =============================================================================

export interface WeatherSample {
  source: string                  // 'noaa' | 'weatherapi' | 'openweather' | 'manual'
  temperature_high: number | null // °F
  temperature_low: number | null  // °F
  precipitation: 'none' | 'light' | 'moderate' | 'heavy' | null
  precipitation_amount_in: number | null
  conditions: string | null       // free-text from the provider
}

export type WeatherConfidence = 'high' | 'medium' | 'low' | 'unknown'

export interface ReconciledWeather {
  /** The values you'd write to weather_records. */
  temperature_high: number | null
  temperature_low: number | null
  precipitation: 'none' | 'light' | 'moderate' | 'heavy' | null
  precipitation_amount_in: number | null
  conditions: string | null
  confidence: WeatherConfidence
  /** Sources that informed the final values. */
  sources_used: string[]
  /** Human-readable summary for the daily log banner. */
  rationale: string
  /** Discrepancies preserved verbatim for the audit trail. */
  divergence: { metric: string; values: Array<{ source: string; value: unknown }> }[]
}

const TEMP_DIVERGENCE_F = 5

function median(values: number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function mode<T>(values: T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: { v: T; c: number } | null = null
  for (const [v, c] of counts) {
    if (!best || c > best.c) best = { v, c }
  }
  return best?.v ?? null
}

export function reconcileWeather(samples: WeatherSample[]): ReconciledWeather {
  if (samples.length === 0) {
    return {
      temperature_high: null,
      temperature_low: null,
      precipitation: null,
      precipitation_amount_in: null,
      conditions: null,
      confidence: 'unknown',
      sources_used: [],
      rationale: 'No weather sources reported.',
      divergence: [],
    }
  }

  const divergence: ReconciledWeather['divergence'] = []

  // ── Temperature ──────────────────────────────────
  const highs = samples.map(s => s.temperature_high).filter((v): v is number => typeof v === 'number')
  const lows = samples.map(s => s.temperature_low).filter((v): v is number => typeof v === 'number')

  const highSpread = highs.length > 0 ? Math.max(...highs) - Math.min(...highs) : 0
  const lowSpread = lows.length > 0 ? Math.max(...lows) - Math.min(...lows) : 0

  if (highSpread > TEMP_DIVERGENCE_F) {
    divergence.push({
      metric: 'temperature_high',
      values: samples.filter(s => s.temperature_high != null).map(s => ({ source: s.source, value: s.temperature_high })),
    })
  }
  if (lowSpread > TEMP_DIVERGENCE_F) {
    divergence.push({
      metric: 'temperature_low',
      values: samples.filter(s => s.temperature_low != null).map(s => ({ source: s.source, value: s.temperature_low })),
    })
  }

  // ── Precipitation kind ───────────────────────────
  const precipKinds = samples.map(s => s.precipitation).filter((v): v is NonNullable<typeof v> => v != null)
  const precipMode = mode(precipKinds)
  const allAgreePrecip = precipKinds.every(p => p === precipMode)
  if (!allAgreePrecip && precipKinds.length > 1) {
    divergence.push({
      metric: 'precipitation',
      values: samples.filter(s => s.precipitation != null).map(s => ({ source: s.source, value: s.precipitation })),
    })
  }

  // ── Confidence ───────────────────────────────────
  let confidence: WeatherConfidence
  if (samples.length >= 3 && divergence.length === 0) confidence = 'high'
  else if (samples.length >= 2 && divergence.length === 0) confidence = 'medium'
  else if (divergence.length > 0) confidence = 'low'
  else confidence = 'medium'

  // ── Pick representative values ───────────────────
  const tempHigh = highs.length > 0 ? Math.round(median(highs) as number) : null
  const tempLow = lows.length > 0 ? Math.round(median(lows) as number) : null
  const amounts = samples.map(s => s.precipitation_amount_in).filter((v): v is number => typeof v === 'number')
  const precipAmount = amounts.length > 0 ? Number((median(amounts) as number).toFixed(2)) : null

  // First non-null conditions string from the highest-priority sources we have.
  const conditions = samples.find(s => s.conditions)?.conditions ?? null

  // ── Rationale ────────────────────────────────────
  const sourcesList = samples.map(s => s.source).join(', ')
  let rationale: string
  if (confidence === 'high') {
    rationale = `${samples.length} sources agree (${sourcesList}).`
  } else if (confidence === 'medium') {
    rationale = `${samples.length} source${samples.length === 1 ? '' : 's'} reported (${sourcesList}).`
  } else if (confidence === 'low') {
    rationale = `Sources disagree on ${divergence.map(d => d.metric).join(', ')}. ` +
                `Going with median temp / mode precipitation. Review the day's weather banner.`
  } else {
    rationale = 'No sources reported.'
  }

  return {
    temperature_high: tempHigh,
    temperature_low: tempLow,
    precipitation: precipMode,
    precipitation_amount_in: precipAmount,
    conditions,
    confidence,
    sources_used: samples.map(s => s.source),
    rationale,
    divergence,
  }
}
