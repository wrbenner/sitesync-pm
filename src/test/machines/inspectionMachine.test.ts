import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  inspectionMachine,
  getValidInspectionTransitions,
  getInspectionStatusConfig,
  getScoreConfig,
  type InspectionStatus,
} from '../../machines/inspectionMachine'

describe('Inspection State Machine', () => {
  describe('getValidInspectionTransitions', () => {
    it('viewer gets no transitions', () => {
      expect(getValidInspectionTransitions('scheduled', 'viewer')).toEqual([])
      expect(getValidInspectionTransitions('in_progress', 'viewer')).toEqual([])
    })

    it('subcontractor gets no transitions', () => {
      expect(getValidInspectionTransitions('scheduled', 'subcontractor')).toEqual([])
    })

    it('superintendent can start a scheduled inspection', () => {
      expect(getValidInspectionTransitions('scheduled', 'superintendent')).toContain('in_progress')
    })

    it('superintendent can complete an in-progress inspection', () => {
      expect(getValidInspectionTransitions('in_progress', 'superintendent')).toContain('completed')
    })

    it('superintendent cannot approve or reject', () => {
      const t = getValidInspectionTransitions('completed', 'superintendent')
      expect(t).not.toContain('approved')
      expect(t).not.toContain('rejected')
    })

    it('project_manager can approve from completed', () => {
      expect(getValidInspectionTransitions('completed', 'project_manager')).toContain('approved')
    })

    it('project_manager can reject from completed', () => {
      expect(getValidInspectionTransitions('completed', 'project_manager')).toContain('rejected')
    })

    it('admin can cancel scheduled inspection', () => {
      expect(getValidInspectionTransitions('scheduled', 'admin')).toContain('cancelled')
    })

    it('admin can cancel in-progress inspection', () => {
      expect(getValidInspectionTransitions('in_progress', 'admin')).toContain('cancelled')
    })

    it('rejected inspection can be rescheduled by superintendent', () => {
      expect(getValidInspectionTransitions('rejected', 'superintendent')).toContain('scheduled')
    })

    it('approved is a final state with no transitions', () => {
      expect(getValidInspectionTransitions('approved', 'admin')).toEqual([])
    })

    it('cancelled is a final state with no transitions', () => {
      expect(getValidInspectionTransitions('cancelled', 'admin')).toEqual([])
    })

    it('default role (no role provided) gets no transitions', () => {
      expect(getValidInspectionTransitions('scheduled')).toEqual([])
    })
  })

  describe('XState machine', () => {
    it('starts in scheduled', () => {
      const actor = createActor(inspectionMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('scheduled')
      actor.stop()
    })

    it('happy path: scheduled -> in_progress -> completed -> approved', () => {
      const actor = createActor(inspectionMachine)
      actor.start()
      actor.send({ type: 'START' })
      expect(actor.getSnapshot().value).toBe('in_progress')
      actor.send({ type: 'COMPLETE', score: 95 })
      expect(actor.getSnapshot().value).toBe('completed')
      actor.send({ type: 'APPROVE', userId: 'pm-1' })
      expect(actor.getSnapshot().value).toBe('approved')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })

    it('rejection path: completed -> rejected -> scheduled (re-inspect)', () => {
      const actor = createActor(inspectionMachine)
      actor.start()
      actor.send({ type: 'START' })
      actor.send({ type: 'COMPLETE' })
      actor.send({ type: 'REJECT', userId: 'pm-1', reason: 'Deficiencies found' })
      expect(actor.getSnapshot().value).toBe('rejected')
      actor.send({ type: 'RESCHEDULE', userId: 'super-1' })
      expect(actor.getSnapshot().value).toBe('scheduled')
      actor.stop()
    })

    it('cancel from scheduled is final', () => {
      const actor = createActor(inspectionMachine)
      actor.start()
      actor.send({ type: 'CANCEL', userId: 'admin-1', reason: 'Project cancelled' })
      expect(actor.getSnapshot().value).toBe('cancelled')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })

    it('cancel from in_progress is final', () => {
      const actor = createActor(inspectionMachine)
      actor.start()
      actor.send({ type: 'START' })
      actor.send({ type: 'CANCEL', userId: 'admin-1', reason: 'Weather delay' })
      expect(actor.getSnapshot().value).toBe('cancelled')
      actor.stop()
    })

    it('ignores invalid events', () => {
      const actor = createActor(inspectionMachine)
      actor.start()
      actor.send({ type: 'COMPLETE' })
      expect(actor.getSnapshot().value).toBe('scheduled')
      actor.stop()
    })
  })

  describe('getInspectionStatusConfig', () => {
    it('all statuses have config with label and CSS var colors', () => {
      const statuses: InspectionStatus[] = [
        'scheduled', 'in_progress', 'completed', 'approved', 'rejected', 'cancelled',
      ]
      for (const s of statuses) {
        const c = getInspectionStatusConfig(s)
        expect(c.label).toBeTruthy()
        expect(c.color).toMatch(/^var\(/)
        expect(c.bg).toMatch(/^var\(/)
      }
    })

    it('approved shows green active color', () => {
      const c = getInspectionStatusConfig('approved')
      expect(c.color).toBe('var(--color-statusActive)')
    })

    it('rejected shows red critical color', () => {
      const c = getInspectionStatusConfig('rejected')
      expect(c.color).toBe('var(--color-statusCritical)')
    })
  })

  describe('getScoreConfig', () => {
    it('null score returns not scored', () => {
      expect(getScoreConfig(null).label).toBe('Not scored')
    })

    it('score >= 90 is Pass (green)', () => {
      const c = getScoreConfig(95)
      expect(c.label).toContain('Pass')
      expect(c.color).toBe('var(--color-statusActive)')
    })

    it('score 70-89 is Marginal (amber)', () => {
      const c = getScoreConfig(75)
      expect(c.label).toContain('Marginal')
      expect(c.color).toBe('var(--color-statusPending)')
    })

    it('score < 70 is Fail (red)', () => {
      const c = getScoreConfig(60)
      expect(c.label).toContain('Fail')
      expect(c.color).toBe('var(--color-statusCritical)')
    })
  })
})
