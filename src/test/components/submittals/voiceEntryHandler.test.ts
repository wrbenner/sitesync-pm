// Phase 5 — Voice entry deterministic transcript extractor tests.

import { describe, it, expect } from 'vitest'
import { extractEntitiesFromTranscript } from '../../../components/submittals/Create/EntryMethods/VoiceEntryHandler'

describe('extractEntitiesFromTranscript', () => {
  it('extracts CSI section in 08 41 13 format', () => {
    const e = extractEntitiesFromTranscript('Storefront aluminum, spec section 08 41 13.')
    expect(e.csi_section).toBe('08 41 13')
  })

  it('extracts kind from "shop drawing"', () => {
    const e = extractEntitiesFromTranscript('Draft a shop drawing for storefront aluminum')
    expect(e.kind).toBe('shop_drawing')
  })

  it('extracts kind from "cut sheet"', () => {
    const e = extractEntitiesFromTranscript('Add a cut sheet for the curtain wall')
    expect(e.kind).toBe('product_data')
  })

  it('extracts sub name from "ACME Glass" pattern', () => {
    const e = extractEntitiesFromTranscript('ACME Glass shop drawing for spec 08 41 13')
    expect(e.sub_name).toMatch(/ACME Glass/)
  })

  it('strips lead-in verbs from the title', () => {
    const e = extractEntitiesFromTranscript('Hey Iris, draft a submittal for storefront frame')
    expect(e.title?.toLowerCase().startsWith('hey iris')).toBe(false)
    expect(e.title?.toLowerCase()).toContain('storefront')
  })

  it('truncates titles longer than 60 chars', () => {
    const long = 'Draft ' + 'x'.repeat(200)
    const e = extractEntitiesFromTranscript(long)
    expect(e.title?.length).toBeLessThanOrEqual(60)
  })

  it('returns empty when transcript has nothing extractable', () => {
    const e = extractEntitiesFromTranscript('blah blah')
    expect(e.csi_section).toBeUndefined()
    expect(e.kind).toBeUndefined()
    expect(e.sub_name).toBeUndefined()
  })
})
