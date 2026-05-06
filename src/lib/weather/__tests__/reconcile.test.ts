import { describe, it, expect } from 'vitest'
import { reconcileWeather, type WeatherSample } from '../reconcile'

const sample = (overrides: Partial<WeatherSample>): WeatherSample => ({
  source: 'noaa',
  temperature_high: 75,
  temperature_low: 55,
  precipitation: 'none',
  precipitation_amount_in: 0,
  conditions: 'Clear',
  ...overrides,
})

describe('reconcileWeather', () => {
  it('returns unknown when no sources reported', () => {
    const r = reconcileWeather([])
    expect(r.confidence).toBe('unknown')
    expect(r.sources_used).toEqual([])
  })

  it('high confidence when 3 sources agree', () => {
    const r = reconcileWeather([
      sample({ source: 'noaa' }),
      sample({ source: 'weatherapi' }),
      sample({ source: 'openweather' }),
    ])
    expect(r.confidence).toBe('high')
    expect(r.divergence).toHaveLength(0)
    expect(r.temperature_high).toBe(75)
  })

  it('medium confidence with 2 agreeing sources', () => {
    const r = reconcileWeather([
      sample({ source: 'noaa' }),
      sample({ source: 'weatherapi' }),
    ])
    expect(r.confidence).toBe('medium')
  })

  it('low confidence when temperature spread exceeds 5°F', () => {
    const r = reconcileWeather([
      sample({ source: 'noaa', temperature_high: 70 }),
      sample({ source: 'weatherapi', temperature_high: 80 }),
      sample({ source: 'openweather', temperature_high: 75 }),
    ])
    expect(r.confidence).toBe('low')
    expect(r.divergence.find(d => d.metric === 'temperature_high')).toBeDefined()
    expect(r.temperature_high).toBe(75)  // median of 70, 75, 80
  })

  it('low confidence when sources disagree on precipitation', () => {
    const r = reconcileWeather([
      sample({ source: 'noaa', precipitation: 'none' }),
      sample({ source: 'weatherapi', precipitation: 'heavy' }),
    ])
    expect(r.confidence).toBe('low')
    expect(r.divergence.find(d => d.metric === 'precipitation')).toBeDefined()
  })

  it('preserves source identifiers in sources_used', () => {
    const r = reconcileWeather([
      sample({ source: 'noaa' }),
      sample({ source: 'weatherapi' }),
    ])
    expect(r.sources_used).toEqual(['noaa', 'weatherapi'])
  })

  it('takes the median for temperature when an outlier disagrees within tolerance', () => {
    const r = reconcileWeather([
      sample({ source: 'a', temperature_high: 70 }),
      sample({ source: 'b', temperature_high: 71 }),
      sample({ source: 'c', temperature_high: 73 }),
    ])
    expect(r.temperature_high).toBe(71)
  })

  it('rationale text mentions agreement when high confidence', () => {
    const r = reconcileWeather([
      sample({ source: 'noaa' }),
      sample({ source: 'weatherapi' }),
      sample({ source: 'openweather' }),
    ])
    expect(r.rationale).toMatch(/agree/i)
  })
})
