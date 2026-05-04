import { describe, it, expect } from 'vitest'
import { parseTranscriptToCapture } from '../voiceParser'
import type { ParsedCapture } from '../../../types/walkthrough'

describe('parseTranscriptToCapture', () => {
  it('extracts trade, severity, and a tidy title from a standard capture', () => {
    const { result, modify_previous } = parseTranscriptToCapture(
      'Stained drywall in the east elevator lobby — needs touch up before owner walk',
    )
    expect(modify_previous).toBe(false)
    expect(result.severity).toBe('low')
    expect(result.trade).toBe('finishes')
    expect(result.title).toMatch(/Stained drywall/)
    // Location hint should pick up "the east elevator lobby"
    expect((result.location_hint ?? '').toLowerCase()).toContain('elevator')
  })

  it('detects modify-previous intent and amends the prior capture', () => {
    const previous: ParsedCapture = {
      title: 'Cracked tile near unit 304',
      description: 'Cracked tile near unit 304',
      severity: 'medium',
      trade: 'finishes',
      modify_previous: false,
    }
    const { result, modify_previous } = parseTranscriptToCapture(
      "Actually that one's the wrong unit — scratch that, it's unit 305",
      { previousCapture: previous },
    )
    expect(modify_previous).toBe(true)
    expect(result.modify_previous).toBe(true)
    expect(result.title).toContain('amended')
    expect(result.title).toContain('Cracked tile')
  })

  it('classifies leaks as critical with plumbing trade', () => {
    const { result } = parseTranscriptToCapture(
      'Pipe is leaking in the mechanical room',
    )
    expect(result.severity).toBe('critical')
    expect(result.trade).toBe('plumbing')
  })
})
