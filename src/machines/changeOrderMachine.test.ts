import { describe, it, expect } from 'vitest'
import {
  getValidCOTransitions,
  getNextCOStatus,
  getNextCOType,
  getPreviousCOType,
  getCOTypeConfig,
  getCOStatusConfig,
  getReasonCodeConfig,
  getApprovalChain,
} from './changeOrderMachine'

describe('changeOrderMachine — getValidCOTransitions', () => {
  it('base actions per state', () => {
    expect(getValidCOTransitions('draft')).toEqual(['Submit for Review'])
    expect(getValidCOTransitions('pending_review')).toEqual(['Approve', 'Reject', 'Void'])
    expect(getValidCOTransitions('approved')).toEqual(['Void'])
    expect(getValidCOTransitions('rejected')).toEqual(['Revise and Resubmit'])
    expect(getValidCOTransitions('void')).toEqual([])
  })

  it('approved PCO can promote to COR (prepended)', () => {
    const r = getValidCOTransitions('approved', 'pco')
    expect(r[0]).toBe('Promote to COR')
  })

  it('approved COR can promote to CO', () => {
    const r = getValidCOTransitions('approved', 'cor')
    expect(r[0]).toBe('Promote to CO')
  })

  it('approved CO has no further promotion', () => {
    const r = getValidCOTransitions('approved', 'co')
    expect(r).toEqual(['Void'])
  })

  it('rejected COR/CO can return to previous stage', () => {
    expect(getValidCOTransitions('rejected', 'cor')).toContain('Return to PCO')
    expect(getValidCOTransitions('rejected', 'co')).toContain('Return to COR')
  })

  it('rejected PCO has no return option (no prior stage)', () => {
    const r = getValidCOTransitions('rejected', 'pco')
    expect(r).toEqual(['Revise and Resubmit'])
  })
})

describe('changeOrderMachine — getNextCOStatus', () => {
  it.each([
    ['draft', 'Submit for Review', 'pending_review'],
    ['pending_review', 'Approve', 'approved'],
    ['pending_review', 'Reject', 'rejected'],
    ['pending_review', 'Void', 'void'],
    ['approved', 'Void', 'void'],
    ['rejected', 'Revise and Resubmit', 'pending_review'],
    ['rejected', 'Return to PCO', 'draft'],
    ['rejected', 'Return to COR', 'draft'],
  ] as const)('%s + %s → %s', (from, action, to) => {
    expect(getNextCOStatus(from, action)).toBe(to)
  })

  it('returns null on invalid action / void terminal', () => {
    expect(getNextCOStatus('void', 'Approve')).toBeNull()
    expect(getNextCOStatus('draft', 'Approve')).toBeNull()
  })
})

describe('changeOrderMachine — getNextCOType / getPreviousCOType', () => {
  it('promotes PCO → COR → CO → null', () => {
    expect(getNextCOType('pco')).toBe('cor')
    expect(getNextCOType('cor')).toBe('co')
    expect(getNextCOType('co')).toBeNull()
  })

  it('demotes CO → COR → PCO → null', () => {
    expect(getPreviousCOType('co')).toBe('cor')
    expect(getPreviousCOType('cor')).toBe('pco')
    expect(getPreviousCOType('pco')).toBeNull()
  })
})

describe('changeOrderMachine — getCOTypeConfig', () => {
  it.each([
    ['pco', 'Potential Change Order', 'PCO'],
    ['cor', 'Change Order Request', 'COR'],
    ['co', 'Change Order', 'CO'],
  ] as const)('%s → %s / %s', (type, label, shortLabel) => {
    const c = getCOTypeConfig(type)
    expect(c.label).toBe(label)
    expect(c.shortLabel).toBe(shortLabel)
  })

  it('falls back to CO for unknown type', () => {
    // @ts-expect-error — exercising fallback
    expect(getCOTypeConfig('mystery').shortLabel).toBe('CO')
  })
})

describe('changeOrderMachine — getCOStatusConfig', () => {
  it('has a label for every state', () => {
    const states = ['draft', 'pending_review', 'approved', 'rejected', 'void'] as const
    for (const s of states) {
      const c = getCOStatusConfig(s)
      expect(c.label).toBeTruthy()
      expect(c.color).toBeTruthy()
      expect(c.bg).toBeTruthy()
    }
  })
})

describe('changeOrderMachine — getReasonCodeConfig', () => {
  it.each([
    ['owner_change', 'Owner Change'],
    ['design_error', 'Design Error'],
    ['field_condition', 'Field Condition'],
    ['regulatory', 'Regulatory'],
    ['value_engineering', 'Value Engineering'],
    ['unforeseen', 'Unforeseen'],
  ] as const)('%s → "%s"', (code, label) => {
    expect(getReasonCodeConfig(code).label).toBe(label)
  })

  it('returns the raw code as label for unknown codes', () => {
    // @ts-expect-error — exercising fallback
    const r = getReasonCodeConfig('mystery_code')
    expect(r.label).toBe('mystery_code')
  })
})

describe('changeOrderMachine — getApprovalChain', () => {
  it('PCO chain has Superintendent + Project Manager', () => {
    const chain = getApprovalChain('pco')
    expect(chain.map((c) => c.role)).toEqual(['Superintendent', 'Project Manager'])
  })

  it('COR chain has Owner Representative + Owner', () => {
    const chain = getApprovalChain('cor')
    expect(chain.map((c) => c.role)).toEqual(['Owner Representative', 'Owner'])
  })

  it('CO chain is the final co-signing step', () => {
    const chain = getApprovalChain('co')
    expect(chain).toHaveLength(1)
    expect(chain[0].role).toBe('Both Parties')
  })
})
