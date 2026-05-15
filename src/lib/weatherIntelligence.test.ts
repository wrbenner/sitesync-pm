import { describe, it, expect } from 'vitest'
import { interpretWeather, getWeatherIcon } from './weatherIntelligence'
import type { WeatherSnapshot } from './weather'

// Build a snapshot with sensible mid-range defaults so each test only sets
// the fields under examination.
function snapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    conditions: 'Clear',
    temperature_high: 70,
    temperature_low: 50,
    wind_speed: 5,
    precipitation_probability: 10,
    weather_source: 'manual',
    weather_fetched_at: '',
    ...overrides,
  }
}

// ── Pour day (ACI 306 thresholds) ────────────────────────────────

describe('interpretWeather — pourDay (ACI 306)', () => {
  it('Mild dry day → pourDay=true', () => {
    expect(interpretWeather(snapshot()).pourDay).toBe(true)
  })

  it('At lower temp boundary (41F high) → pour ALLOWED (>40 strictly)', () => {
    expect(interpretWeather(snapshot({ temperature_high: 41 })).pourDay).toBe(true)
  })

  it('At lower-temp edge (40F high) → pour BLOCKED (>40 strictly required)', () => {
    expect(interpretWeather(snapshot({ temperature_high: 40 })).pourDay).toBe(false)
  })

  it('At upper temp boundary (94F high) → pour allowed', () => {
    expect(interpretWeather(snapshot({ temperature_high: 94 })).pourDay).toBe(true)
  })

  it('Hot day (95F high) → pour BLOCKED (<95 strictly required)', () => {
    expect(interpretWeather(snapshot({ temperature_high: 95 })).pourDay).toBe(false)
  })

  it('40% precip → pour BLOCKED (<40 strictly required)', () => {
    expect(interpretWeather(snapshot({ precipitation_probability: 40 })).pourDay).toBe(false)
  })

  it('39% precip → pour ALLOWED', () => {
    expect(interpretWeather(snapshot({ precipitation_probability: 39 })).pourDay).toBe(true)
  })

  it('Wind 25 mph → pour BLOCKED (<25 required)', () => {
    expect(interpretWeather(snapshot({ wind_speed: 25 })).pourDay).toBe(false)
  })

  it('Wind 24 mph → pour ALLOWED', () => {
    expect(interpretWeather(snapshot({ wind_speed: 24 })).pourDay).toBe(true)
  })
})

// ── Crane hold (OSHA wind limits) ────────────────────────────────

describe('interpretWeather — craneHold (OSHA)', () => {
  it('Wind 21 mph → craneHold=true (>20 sustained requires evaluation)', () => {
    expect(interpretWeather(snapshot({ wind_speed: 21 })).craneHold).toBe(true)
  })

  it('Wind 20 mph → craneHold=false (>20 strictly required)', () => {
    expect(interpretWeather(snapshot({ wind_speed: 20 })).craneHold).toBe(false)
  })
})

// ── Freeze risk ──────────────────────────────────────────────────

describe('interpretWeather — freezeRisk', () => {
  it('Low 31F → freezeRisk=true (<32 required)', () => {
    expect(interpretWeather(snapshot({ temperature_low: 31 })).freezeRisk).toBe(true)
  })

  it('Low 32F → freezeRisk=false (must drop strictly below)', () => {
    expect(interpretWeather(snapshot({ temperature_low: 32 })).freezeRisk).toBe(false)
  })

  it('Freezing summary includes the low temperature for the field log', () => {
    const ci = interpretWeather(snapshot({ temperature_low: 28 }))
    expect(ci.constructionSummary).toContain('Freeze risk')
    expect(ci.constructionSummary).toContain('28')
  })
})

// ── Rain risk ────────────────────────────────────────────────────

describe('interpretWeather — rainRisk', () => {
  it('Precip 51% → rainRisk=true (>50)', () => {
    expect(interpretWeather(snapshot({ precipitation_probability: 51 })).rainRisk).toBe(true)
  })

  it('Precip 50% → rainRisk=false (must exceed strictly)', () => {
    expect(interpretWeather(snapshot({ precipitation_probability: 50 })).rainRisk).toBe(false)
  })

  it('Rain summary includes the percent and "cover materials" guidance', () => {
    const ci = interpretWeather(snapshot({ precipitation_probability: 80 }))
    expect(ci.constructionSummary).toMatch(/80% rain/)
    expect(ci.constructionSummary).toContain('cover materials')
  })
})

// ── Heat risk ────────────────────────────────────────────────────

describe('interpretWeather — heatRisk', () => {
  it('Temp 95F → heatRisk=true (OSHA heat index triggers at 95+)', () => {
    expect(interpretWeather(snapshot({ temperature_high: 95 })).heatRisk).toBe(true)
  })

  it('Temp 94F → heatRisk=false', () => {
    expect(interpretWeather(snapshot({ temperature_high: 94 })).heatRisk).toBe(false)
  })

  it('Heat summary includes "Heat advisory"', () => {
    const ci = interpretWeather(snapshot({ temperature_high: 100 }))
    expect(ci.constructionSummary).toContain('Heat advisory')
  })
})

// ── Composite summary precedence ────────────────────────────────

describe('interpretWeather — constructionSummary precedence', () => {
  it('Good pour day → "Good pour day" leads the summary', () => {
    expect(interpretWeather(snapshot()).constructionSummary).toMatch(/^Good pour day/)
  })

  it('Rain blocks pour message even if temperature is fine', () => {
    expect(interpretWeather(snapshot({ precipitation_probability: 60 })).constructionSummary)
      .toMatch(/^No pour/)
  })

  it('Cold (freeze risk + temp <= 40) → "No pour — cold weather"', () => {
    const s = interpretWeather(snapshot({ temperature_high: 35, temperature_low: 25 }))
    expect(s.constructionSummary).toContain('cold weather')
  })

  it('High wind → "No pour — high wind"', () => {
    const s = interpretWeather(snapshot({ wind_speed: 30 }))
    expect(s.constructionSummary).toContain('high wind')
    expect(s.constructionSummary).toContain('Wind hold')
  })

  it('Marginal conditions get the "marginal" fallback', () => {
    // Temp drops just below pour-day threshold but not cold/rainy/windy
    const s = interpretWeather(snapshot({ temperature_high: 40 }))
    expect(s.constructionSummary).toContain('marginal')
  })
})

// ── Round-trip pass-through fields ──────────────────────────────

describe('interpretWeather — pass-through fields', () => {
  it('temperature, low, conditions, wind, precip pass through verbatim', () => {
    const s = interpretWeather(snapshot({
      temperature_high: 78, temperature_low: 55, conditions: 'Cloudy',
      wind_speed: 12, precipitation_probability: 20,
    }))
    expect(s.temperature).toBe(78)
    expect(s.temperatureLow).toBe(55)
    expect(s.conditions).toBe('Cloudy')
    expect(s.windSpeed).toBe(12)
    expect(s.precipitationChance).toBe(20)
  })
})

// ── getWeatherIcon ──────────────────────────────────────────────

describe('getWeatherIcon — emoji map', () => {
  it('Clear → sun emoji', () => {
    expect(getWeatherIcon('Clear')).toBe('☀️')
  })

  it('Rain → rain-cloud emoji', () => {
    expect(getWeatherIcon('Rain')).toBe('🌧️')
  })

  it('Thunderstorm → ⛈️', () => {
    expect(getWeatherIcon('Thunderstorm')).toBe('⛈️')
  })

  it('Snow → ❄️', () => {
    expect(getWeatherIcon('Snow')).toBe('❄️')
  })

  it('Unknown condition falls back to the sun emoji (default)', () => {
    expect(getWeatherIcon('Aurora Borealis')).toBe('☀️')
  })
})
