import { describe, it, expect } from 'vitest'
import { processQuotePdfExtraction } from '../quotePdf'

describe('quotePdf extractor', () => {
  it('routes high-confidence extraction to auto_apply', () => {
    const r = processQuotePdfExtraction({
      payload: {
        vendor: 'ACME Subs',
        date: '2026-04-29',
        total_amount: 12500,
        line_items: [{ description: 'labor', qty: 10, unit_price: 1000, subtotal: 10000 }],
      },
      confidence: 0.9,
    })
    expect(r.status).toBe('auto_apply')
  })

  it('flags total when its per-field confidence is low', () => {
    const r = processQuotePdfExtraction({
      payload: { vendor: 'X', date: '2026-04-29', total_amount: 0, line_items: [] },
      confidence: 0.95,
      field_confidence: { total_amount: 0.4 },
    })
    expect(r.flagged_fields).toContain('total_amount')
  })

  it('routes <0.7 to manual review', () => {
    const r = processQuotePdfExtraction({
      payload: { vendor: '?', date: '?', total_amount: 0, line_items: [] },
      confidence: 0.5,
    })
    expect(r.status).toBe('manual_review')
  })
})
