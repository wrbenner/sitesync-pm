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
  formatCONumber,
  type ChangeOrderState,
  type ChangeOrderType,
  type ReasonCode,
} from '../../machines/changeOrderMachine'

describe('Change Order State Machine', () => {
  describe('getValidCOTransitions', () => {
    it('draft can Submit for Review', () => {
      expect(getValidCOTransitions('draft')).toEqual(['Submit for Review'])
    })

    it('pending_review can Approve, Reject, or Void', () => {
      const transitions = getValidCOTransitions('pending_review')
      expect(transitions).toContain('Approve')
      expect(transitions).toContain('Reject')
      expect(transitions).toContain('Void')
    })

    it('approved CO can Void', () => {
      expect(getValidCOTransitions('approved')).toContain('Void')
    })

    it('rejected can Revise and Resubmit', () => {
      expect(getValidCOTransitions('rejected')).toEqual(['Revise and Resubmit'])
    })

    it('void has no transitions (final state)', () => {
      expect(getValidCOTransitions('void')).toEqual([])
    })

    it('approved PCO can Promote to COR', () => {
      const transitions = getValidCOTransitions('approved', 'pco')
      expect(transitions[0]).toBe('Promote to COR')
    })

    it('approved COR can Promote to CO', () => {
      const transitions = getValidCOTransitions('approved', 'cor')
      expect(transitions[0]).toBe('Promote to CO')
    })

    it('approved CO cannot promote further', () => {
      const transitions = getValidCOTransitions('approved', 'co')
      expect(transitions).not.toContain('Promote to COR')
      expect(transitions).not.toContain('Promote to CO')
    })

    it('returns empty for unknown status', () => {
      expect(getValidCOTransitions('nonexistent' as ChangeOrderState)).toEqual([])
    })
  })

  describe('getNextCOStatus', () => {
    it('Submit from draft goes to pending_review', () => {
      expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
    })

    it('Approve from pending_review goes to approved', () => {
      expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')
    })

    it('Reject from pending_review goes to rejected', () => {
      expect(getNextCOStatus('pending_review', 'Reject')).toBe('rejected')
    })

    it('Void from pending_review goes to void', () => {
      expect(getNextCOStatus('pending_review', 'Void')).toBe('void')
    })

    it('Void from approved goes to void', () => {
      expect(getNextCOStatus('approved', 'Void')).toBe('void')
    })

    it('Revise and Resubmit from rejected goes back to pending_review', () => {
      expect(getNextCOStatus('rejected', 'Revise and Resubmit')).toBe('pending_review')
    })

    it('invalid transition returns null', () => {
      expect(getNextCOStatus('draft', 'Approve')).toBeNull()
      expect(getNextCOStatus('void', 'Submit for Review')).toBeNull()
    })
  })

  describe('getNextCOType (promotion chain)', () => {
    it('PCO promotes to COR', () => {
      expect(getNextCOType('pco')).toBe('cor')
    })

    it('COR promotes to CO', () => {
      expect(getNextCOType('cor')).toBe('co')
    })

    it('CO cannot promote further', () => {
      expect(getNextCOType('co')).toBeNull()
    })
  })

  describe('getCOTypeConfig', () => {
    it('returns config for all CO types', () => {
      for (const type of ['pco', 'cor', 'co'] as ChangeOrderType[]) {
        const config = getCOTypeConfig(type)
        expect(config.label).toBeTruthy()
        expect(config.shortLabel).toBeTruthy()
        expect(config.color).toMatch(/^#/)
        expect(config.bg).toMatch(/^rgba/)
      }
    })

    it('PCO has correct short label', () => {
      expect(getCOTypeConfig('pco').shortLabel).toBe('PCO')
    })

    it('returns fallback for unknown type', () => {
      const config = getCOTypeConfig('unknown' as ChangeOrderType)
      expect(config.label).toBeTruthy()
    })
  })

  describe('getCOStatusConfig', () => {
    it('returns config for all statuses', () => {
      const statuses: ChangeOrderState[] = ['draft', 'pending_review', 'approved', 'rejected', 'void']
      for (const status of statuses) {
        const config = getCOStatusConfig(status)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^#/)
        expect(config.bg).toMatch(/^rgba/)
      }
    })

    it('returns fallback for unknown status', () => {
      const config = getCOStatusConfig('nonexistent' as ChangeOrderState)
      expect(config).toBeTruthy()
    })
  })

  describe('getReasonCodeConfig', () => {
    it('returns config for all reason codes', () => {
      const codes: ReasonCode[] = ['owner_change', 'design_error', 'field_condition', 'regulatory', 'value_engineering', 'unforeseen']
      for (const code of codes) {
        const config = getReasonCodeConfig(code)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^#/)
      }
    })

    it('returns fallback for unknown code', () => {
      const config = getReasonCodeConfig('mystery' as ReasonCode)
      expect(config.label).toBe('mystery')
    })
  })

  describe('getApprovalChain', () => {
    it('PCO chain has Superintendent and PM', () => {
      const chain = getApprovalChain('pco')
      expect(chain.length).toBe(2)
      expect(chain[0].role).toBe('Superintendent')
    })

    it('COR chain has Owner Representative and Owner', () => {
      const chain = getApprovalChain('cor')
      expect(chain.length).toBe(2)
      expect(chain[0].role).toBe('Owner Representative')
    })

    it('CO chain has Both Parties', () => {
      const chain = getApprovalChain('co')
      expect(chain.length).toBe(1)
      expect(chain[0].role).toBe('Both Parties')
    })
  })

  describe('formatCONumber', () => {
    it('formats PCO numbers', () => {
      expect(formatCONumber('pco', 1)).toBe('PCO-001')
      expect(formatCONumber('pco', 42)).toBe('PCO-042')
    })

    it('formats COR numbers', () => {
      expect(formatCONumber('cor', 7)).toBe('COR-007')
    })

    it('formats CO numbers', () => {
      expect(formatCONumber('co', 123)).toBe('CO-123')
    })
  })

  // BUG #5 FIX TESTS: Return to previous stage

  describe('getPreviousCOType', () => {
    it('COR returns to PCO', () => {
      expect(getPreviousCOType('cor')).toBe('pco')
    })

    it('CO returns to COR', () => {
      expect(getPreviousCOType('co')).toBe('cor')
    })

    it('PCO has no previous', () => {
      expect(getPreviousCOType('pco')).toBeNull()
    })
  })

  describe('Return to PCO flow (Bug #5 Fix)', () => {
    it('rejected COR shows Return to PCO action', () => {
      const actions = getValidCOTransitions('rejected', 'cor')
      expect(actions).toContain('Return to PCO')
    })

    it('rejected CO shows Return to COR action', () => {
      const actions = getValidCOTransitions('rejected', 'co')
      expect(actions).toContain('Return to COR')
    })

    it('rejected PCO does NOT show return action', () => {
      const actions = getValidCOTransitions('rejected', 'pco')
      expect(actions).not.toContain('Return to PCO')
      expect(actions).not.toContain('Return to COR')
    })

    it('Return to PCO maps to draft status', () => {
      expect(getNextCOStatus('rejected', 'Return to PCO')).toBe('draft')
    })

    it('Return to COR maps to draft status', () => {
      expect(getNextCOStatus('rejected', 'Return to COR')).toBe('draft')
    })
  })

  describe('Full lifecycle: PCO → COR → CO', () => {
    it('promotion lifecycle', () => {
      expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
      expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')
      expect(getNextCOType('pco')).toBe('cor')
      expect(getNextCOType('cor')).toBe('co')
      expect(getNextCOType('co')).toBeNull()
    })

    it('COR rejection and return to PCO', () => {
      // COR gets rejected at owner review
      expect(getNextCOStatus('pending_review', 'Reject')).toBe('rejected')
      // Return to PCO stage for revision
      expect(getNextCOStatus('rejected', 'Return to PCO')).toBe('draft')
      expect(getPreviousCOType('cor')).toBe('pco')
    })
  })
})
