import { describe, it, expect } from 'vitest'
import { getValidTaskTransitions, getNextTaskStatus, getTaskStatusConfig, type TaskState } from '../../machines/taskMachine'

describe('Task State Machine', () => {
  describe('getValidTaskTransitions', () => {
    it('todo can Start Work or Mark Complete', () => {
      const transitions = getValidTaskTransitions('todo')
      expect(transitions).toContain('Start Work')
      expect(transitions).toContain('Mark Complete')
    })

    it('in_progress can Submit for Review or Mark Complete', () => {
      const transitions = getValidTaskTransitions('in_progress')
      expect(transitions).toContain('Submit for Review')
      expect(transitions).toContain('Mark Complete')
    })

    it('in_review can Approve or Send Back', () => {
      const transitions = getValidTaskTransitions('in_review')
      expect(transitions).toContain('Approve')
      expect(transitions).toContain('Send Back')
    })

    it('done can only Reopen', () => {
      expect(getValidTaskTransitions('done')).toEqual(['Reopen'])
    })
  })

  describe('getNextTaskStatus', () => {
    it('Start Work from todo goes to in_progress', () => {
      expect(getNextTaskStatus('todo', 'Start Work')).toBe('in_progress')
    })

    it('Approve from in_review goes to done', () => {
      expect(getNextTaskStatus('in_review', 'Approve')).toBe('done')
    })

    it('Send Back from in_review goes to in_progress', () => {
      expect(getNextTaskStatus('in_review', 'Send Back')).toBe('in_progress')
    })

    it('Reopen from done goes to todo', () => {
      expect(getNextTaskStatus('done', 'Reopen')).toBe('todo')
    })
  })

  describe('getTaskStatusConfig', () => {
    it('returns label and colors for each status', () => {
      const statuses: TaskState[] = ['todo', 'in_progress', 'in_review', 'done']
      for (const status of statuses) {
        const config = getTaskStatusConfig(status)
        expect(config).toHaveProperty('label')
        expect(config).toHaveProperty('color')
        expect(config).toHaveProperty('bg')
        expect(config.label.length).toBeGreaterThan(0)
      }
    })
  })
})
