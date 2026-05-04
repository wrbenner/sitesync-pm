import { describe, it, expect } from 'vitest'
import { processSpecPdfExtraction } from '../specPdf'

describe('specPdf extractor', () => {
  it('passes high-confidence extraction through to auto_apply', () => {
    const r = processSpecPdfExtraction({
      payload: {
        spec_section: '03 30 00',
        title: 'Cast-in-place concrete',
        reference_standards: ['ACI 318'],
        product_substitutions_allowed: true,
        acceptance_criteria: ['28-day strength ≥ 4000 psi'],
      },
      confidence: 0.92,
    })
    expect(r.status).toBe('auto_apply')
    expect(r.payload.spec_section).toBe('03 30 00')
  })

  it('flags low-confidence fields even when overall is high', () => {
    const r = processSpecPdfExtraction({
      payload: {
        spec_section: '03 30 00',
        title: 'Cast-in-place concrete',
        reference_standards: [],
        product_substitutions_allowed: false,
        acceptance_criteria: [],
      },
      confidence: 0.95,
      field_confidence: { spec_section: 0.95, title: 0.55, product_substitutions_allowed: 0.6 },
    })
    expect(r.status).toBe('auto_apply')
    expect(r.flagged_fields).toEqual(expect.arrayContaining(['title', 'product_substitutions_allowed']))
  })

  it('routes mid-confidence to auto_apply_with_warning', () => {
    const r = processSpecPdfExtraction({
      payload: {
        spec_section: '03 30 00',
        title: 'x',
        reference_standards: [],
        product_substitutions_allowed: false,
        acceptance_criteria: [],
      },
      confidence: 0.75,
    })
    expect(r.status).toBe('auto_apply_with_warning')
  })
})
