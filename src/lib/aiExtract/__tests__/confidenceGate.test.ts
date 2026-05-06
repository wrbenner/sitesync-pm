import { describe, it, expect } from 'vitest'
import { gate, GATE_THRESHOLDS } from '../confidenceGate'

describe('confidenceGate', () => {
  it('returns auto_apply for confidence >= 0.85', () => {
    const r = gate({ payload: { x: 1 }, confidence: 0.9 })
    expect(r.status).toBe('auto_apply')
  })

  it('returns auto_apply_with_warning for confidence in [0.7, 0.85)', () => {
    expect(gate({ payload: {}, confidence: 0.7 }).status).toBe('auto_apply_with_warning')
    expect(gate({ payload: {}, confidence: 0.84 }).status).toBe('auto_apply_with_warning')
  })

  it('returns manual_review for confidence < 0.7', () => {
    expect(gate({ payload: {}, confidence: 0.69 }).status).toBe('manual_review')
    expect(gate({ payload: {}, confidence: 0 }).status).toBe('manual_review')
  })

  it('flags fields with per-field confidence < 0.7', () => {
    const r = gate({
      payload: { a: 1, b: 2 },
      confidence: 0.95,
      field_confidence: { a: 0.95, b: 0.5, c: 0.65 },
    })
    expect(r.flagged_fields).toContain('b')
    expect(r.flagged_fields).toContain('c')
    expect(r.flagged_fields).not.toContain('a')
  })

  it('preserves bbox + pdf_page for hallucination verification', () => {
    const r = gate({ payload: {}, confidence: 0.95, pdf_page: 3, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } })
    expect(r.pdf_page).toBe(3)
    expect(r.bbox).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 })
  })

  it('exports threshold constants for UI consumption', () => {
    expect(GATE_THRESHOLDS.AUTO_APPLY).toBe(0.85)
    expect(GATE_THRESHOLDS.WARNING).toBe(0.7)
  })
})
