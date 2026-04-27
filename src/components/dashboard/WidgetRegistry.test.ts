import { describe, it, expect } from 'vitest'
import { widgetDefinitions, getWidgetDef } from './WidgetRegistry'

describe('WidgetRegistry — widgetDefinitions', () => {
  it('contains the documented dashboard widgets', () => {
    const types = widgetDefinitions.map((w) => w.type).sort()
    expect(types).toEqual(
      [
        'ai-insights',
        'bim-preview',
        'cash-flow',
        'live-site',
        'milestone-timeline',
        'photo-feed',
        'productivity-pulse',
        'risk-heatmap',
        'weather-impact',
      ].sort(),
    )
  })

  it('every widget has all required fields', () => {
    for (const w of widgetDefinitions) {
      expect(w.type).toBeTruthy()
      expect(w.label).toBeTruthy()
      expect(w.description).toBeTruthy()
      expect(w.icon).toBeTruthy()
      expect(w.defaultW).toBeGreaterThan(0)
      expect(w.defaultH).toBeGreaterThan(0)
    }
  })

  it('minW ≤ defaultW and minH ≤ defaultH for every widget', () => {
    for (const w of widgetDefinitions) {
      if (w.minW != null) expect(w.minW).toBeLessThanOrEqual(w.defaultW)
      if (w.minH != null) expect(w.minH).toBeLessThanOrEqual(w.defaultH)
    }
  })

  it('every widget type is unique (no duplicates)', () => {
    const types = widgetDefinitions.map((w) => w.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('every widget label is unique', () => {
    const labels = widgetDefinitions.map((w) => w.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('WidgetRegistry — getWidgetDef', () => {
  it('returns the matching definition by type', () => {
    const r = getWidgetDef('cash-flow')
    expect(r?.label).toBe('Cash Flow')
  })

  it('returns undefined for an unknown type', () => {
    expect(getWidgetDef('mystery-widget')).toBeUndefined()
  })

  it('lookup is case-sensitive (exact match only)', () => {
    expect(getWidgetDef('CASH-FLOW')).toBeUndefined()
  })
})
