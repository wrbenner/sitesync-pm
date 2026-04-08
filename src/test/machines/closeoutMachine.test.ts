import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  closeoutItemMachine,
  getValidCloseoutTransitions,
  getCloseoutStatusConfig,
  getCloseoutCategoryConfig,
  computeWarrantyStatus,
  getWarrantyStatusConfig,
  generateCloseoutList,
  type CloseoutItemStatus,
  type WarrantyStatus,
  type ProjectType,
} from '../../machines/closeoutMachine'

describe('Closeout Item State Machine', () => {
  describe('getValidCloseoutTransitions', () => {
    it('required can only Send Request', () => {
      expect(getValidCloseoutTransitions('required')).toEqual(['Send Request'])
    })

    it('requested can only Mark Submitted', () => {
      expect(getValidCloseoutTransitions('requested')).toEqual(['Mark Submitted'])
    })

    it('submitted can Start Review or Approve', () => {
      const t = getValidCloseoutTransitions('submitted')
      expect(t).toContain('Start Review')
      expect(t).toContain('Approve')
    })

    it('under_review can Approve or Reject', () => {
      const t = getValidCloseoutTransitions('under_review')
      expect(t).toContain('Approve')
      expect(t).toContain('Reject')
    })

    it('approved is final with no transitions', () => {
      expect(getValidCloseoutTransitions('approved')).toEqual([])
    })

    it('rejected can Resubmit', () => {
      expect(getValidCloseoutTransitions('rejected')).toEqual(['Resubmit'])
    })
  })

  describe('getCloseoutStatusConfig', () => {
    it('all statuses return valid config with label and colors', () => {
      const statuses: CloseoutItemStatus[] = [
        'required', 'requested', 'submitted', 'under_review', 'approved', 'rejected',
      ]
      for (const status of statuses) {
        const config = getCloseoutStatusConfig(status)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^var\(/)
        expect(config.bg).toMatch(/^var\(/)
      }
    })

    it('approved shows green color', () => {
      expect(getCloseoutStatusConfig('approved').color).toContain('statusActive')
    })

    it('rejected shows red color', () => {
      expect(getCloseoutStatusConfig('rejected').color).toContain('statusCritical')
    })
  })

  describe('getCloseoutCategoryConfig', () => {
    it('known categories return label and icon', () => {
      const config = getCloseoutCategoryConfig('warranty')
      expect(config.label).toBe('Warranty Letter')
      expect(config.icon).toBeTruthy()
    })

    it('lien_waiver has correct label', () => {
      expect(getCloseoutCategoryConfig('lien_waiver').label).toBe('Lien Waiver')
    })

    it('unknown category falls back to other', () => {
      const config = getCloseoutCategoryConfig('other')
      expect(config.label).toBe('Other')
    })
  })

  describe('computeWarrantyStatus', () => {
    it('past date returns expired', () => {
      const past = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      expect(computeWarrantyStatus(past)).toBe('expired')
    })

    it('within 30 days returns expiring_soon', () => {
      const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      expect(computeWarrantyStatus(soon)).toBe('expiring_soon')
    })

    it('far future returns active', () => {
      const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      expect(computeWarrantyStatus(future)).toBe('active')
    })
  })

  describe('getWarrantyStatusConfig', () => {
    it('all warranty statuses have labels', () => {
      const statuses: WarrantyStatus[] = ['active', 'expiring_soon', 'expired', 'claimed']
      for (const status of statuses) {
        const config = getWarrantyStatusConfig(status)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^var\(/)
      }
    })
  })

  describe('generateCloseoutList', () => {
    it('returns items for commercial projects', () => {
      const items = generateCloseoutList('commercial')
      expect(items.length).toBeGreaterThan(0)
    })

    it('all project types produce a list', () => {
      const types: ProjectType[] = ['commercial', 'residential', 'industrial', 'healthcare', 'education', 'mixed_use']
      for (const type of types) {
        const items = generateCloseoutList(type)
        expect(items.length).toBeGreaterThan(0)
      }
    })

    it('each item has required fields', () => {
      const items = generateCloseoutList('commercial')
      for (const item of items) {
        expect(item.category).toBeTruthy()
        expect(item.title).toBeTruthy()
        expect(item.description).toBeTruthy()
      }
    })
  })

  describe('XState machine', () => {
    it('starts in required', () => {
      const actor = createActor(closeoutItemMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('required')
      actor.stop()
    })

    it('full happy path: required -> requested -> submitted -> under_review -> approved', () => {
      const actor = createActor(closeoutItemMachine)
      actor.start()
      actor.send({ type: 'REQUEST', contactId: 'sub-1' })
      expect(actor.getSnapshot().value).toBe('requested')
      actor.send({ type: 'SUBMIT', documentIds: ['doc-1'] })
      expect(actor.getSnapshot().value).toBe('submitted')
      actor.send({ type: 'START_REVIEW' })
      expect(actor.getSnapshot().value).toBe('under_review')
      actor.send({ type: 'APPROVE', reviewerId: 'pm-1' })
      expect(actor.getSnapshot().value).toBe('approved')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })

    it('fast-track: submitted -> approved (skip formal review)', () => {
      const actor = createActor(closeoutItemMachine)
      actor.start()
      actor.send({ type: 'REQUEST', contactId: 'sub-1' })
      actor.send({ type: 'SUBMIT', documentIds: ['doc-1'] })
      actor.send({ type: 'APPROVE', reviewerId: 'pm-1' })
      expect(actor.getSnapshot().value).toBe('approved')
      actor.stop()
    })

    it('rejection and resubmit path', () => {
      const actor = createActor(closeoutItemMachine)
      actor.start()
      actor.send({ type: 'REQUEST', contactId: 'sub-1' })
      actor.send({ type: 'SUBMIT', documentIds: ['doc-1'] })
      actor.send({ type: 'START_REVIEW' })
      actor.send({ type: 'REJECT', comments: 'Incomplete documentation', reviewerId: 'pm-1' })
      expect(actor.getSnapshot().value).toBe('rejected')
      actor.send({ type: 'RESUBMIT', documentIds: ['doc-2'] })
      expect(actor.getSnapshot().value).toBe('submitted')
      actor.stop()
    })

    it('invalid transitions are ignored', () => {
      const actor = createActor(closeoutItemMachine)
      actor.start()
      // Cannot approve from required state
      actor.send({ type: 'APPROVE', reviewerId: 'pm-1' })
      expect(actor.getSnapshot().value).toBe('required')
      actor.stop()
    })
  })
})
