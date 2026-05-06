import { describe, it, expect } from 'vitest'
import { processInspectionReportExtraction } from '../inspectionReport'

describe('inspectionReport extractor', () => {
  it('routes a clean pass to auto_apply', () => {
    const r = processInspectionReportExtraction({
      payload: { inspection_type: 'Framing', date: '2026-04-29', inspector_name: 'J. Doe', result: 'pass', deficiencies: [] },
      confidence: 0.95,
    })
    expect(r.status).toBe('auto_apply')
    expect(r.payload.result).toBe('pass')
  })

  it('routes ambiguous extraction to manual_review', () => {
    const r = processInspectionReportExtraction({
      payload: { inspection_type: '?', date: '?', inspector_name: '?', result: 'fail', deficiencies: [] },
      confidence: 0.5,
    })
    expect(r.status).toBe('manual_review')
  })

  it('preserves multiple deficiencies', () => {
    const r = processInspectionReportExtraction({
      payload: {
        inspection_type: 'Framing',
        date: '2026-04-29',
        inspector_name: 'J. Doe',
        result: 'fail',
        deficiencies: [
          { description: 'missing hold-down', severity: 'high' },
          { description: 'overdriven nails', severity: 'low' },
        ],
      },
      confidence: 0.88,
    })
    expect(r.payload.deficiencies.length).toBe(2)
  })
})
