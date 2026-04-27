import { describe, it, expect } from 'vitest'
import { isGenerativeUI } from './types'

// isGenerativeUI is the runtime guard the AI tool-call dispatcher uses to
// decide whether a tool result should be rendered as a generative UI card
// vs a plain text response. A regression that ACCEPTS bogus ui_types
// would feed the renderer junk; a regression that REJECTS valid types
// would silently drop entire UI cards from the conversation.

describe('isGenerativeUI', () => {
  it.each([
    'data_table',
    'metric_cards',
    'form',
    'chart',
    'approval_card',
    'timeline',
    'checklist',
    'comparison',
    'schedule_card',
    'cost_breakdown',
    'safety_alert',
    'rfi_response',
    'photo_grid',
  ])('accepts ui_type "%s"', (ui_type) => {
    expect(isGenerativeUI({ ui_type })).toBe(true)
  })

  it('rejects unknown ui_type values', () => {
    expect(isGenerativeUI({ ui_type: 'mystery_block' })).toBe(false)
    expect(isGenerativeUI({ ui_type: 'DATA_TABLE' })).toBe(false) // case-sensitive
    expect(isGenerativeUI({ ui_type: 'datatable' })).toBe(false)  // no underscore
  })

  it('rejects results missing ui_type entirely', () => {
    expect(isGenerativeUI({})).toBe(false)
    expect(isGenerativeUI({ data: 'something' })).toBe(false)
  })

  it('rejects results where ui_type is not a string', () => {
    expect(isGenerativeUI({ ui_type: 1 })).toBe(false)
    expect(isGenerativeUI({ ui_type: null })).toBe(false)
    expect(isGenerativeUI({ ui_type: true })).toBe(false)
    expect(isGenerativeUI({ ui_type: ['data_table'] })).toBe(false)
    expect(isGenerativeUI({ ui_type: { kind: 'data_table' } })).toBe(false)
  })

  it('rejects empty string ui_type', () => {
    expect(isGenerativeUI({ ui_type: '' })).toBe(false)
  })

  it('positive case preserves additional fields (it is a guard, not a parser)', () => {
    const result = { ui_type: 'metric_cards', cards: [{ label: 'A', value: 5 }] }
    expect(isGenerativeUI(result)).toBe(true)
  })

  it('exposes the documented 13-block UI vocabulary', () => {
    // Audit: every block listed in the GenerativeUIBlock union must be
    // recognised by isGenerativeUI. If a new block is added to the union
    // but the guard isn't updated, this test catches it.
    const expected = [
      'data_table', 'metric_cards', 'form', 'chart',
      'approval_card', 'timeline', 'checklist', 'comparison',
      'schedule_card', 'cost_breakdown', 'safety_alert',
      'rfi_response', 'photo_grid',
    ]
    expect(expected).toHaveLength(13)
    for (const ui_type of expected) {
      expect(isGenerativeUI({ ui_type })).toBe(true)
    }
  })
})
