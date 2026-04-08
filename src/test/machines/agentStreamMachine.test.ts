import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { agentStreamMachine } from '../../machines/agentStreamMachine'
import type { AgentStreamEventType } from '../../schemas/agentStream'

function makeStateSnapshot(state: string): AgentStreamEventType {
  return {
    type: 'state_snapshot',
    agent_id: 'agent-1',
    event_id: 'evt-1',
    timestamp: new Date().toISOString(),
    session_id: 'sess-1',
    data: { state: state as never, description: `Agent is ${state}`, progress: 50 },
  } as AgentStreamEventType
}

describe('Agent Stream State Machine', () => {
  describe('initial state', () => {
    it('starts in idle', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('idle')
      actor.stop()
    })

    it('starts with empty events array', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      expect(actor.getSnapshot().context.events).toEqual([])
      actor.stop()
    })
  })

  describe('idle -> streaming', () => {
    it('START transitions to streaming and sets session context', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 'sess-abc', projectId: 'proj-123' })
      const snap = actor.getSnapshot()
      expect(snap.value).toBe('streaming')
      expect(snap.context.sessionId).toBe('sess-abc')
      expect(snap.context.projectId).toBe('proj-123')
      expect(snap.context.currentAgentState).toBe('initializing')
      actor.stop()
    })

    it('START clears previous errors and events', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'ERROR', message: 'timeout' })
      actor.send({ type: 'RETRY' })
      actor.send({ type: 'START', sessionId: 's2', projectId: 'p2' })
      const snap = actor.getSnapshot()
      expect(snap.context.error).toBeNull()
      expect(snap.context.events).toEqual([])
      actor.stop()
    })
  })

  describe('streaming state', () => {
    it('EVENT_RECEIVED accumulates events', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'EVENT_RECEIVED', event: makeStateSnapshot('planning') })
      actor.send({ type: 'EVENT_RECEIVED', event: makeStateSnapshot('executing') })
      expect(actor.getSnapshot().context.events).toHaveLength(2)
      actor.stop()
    })

    it('state_snapshot event updates currentAgentState', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'EVENT_RECEIVED', event: makeStateSnapshot('analyzing') })
      expect(actor.getSnapshot().context.currentAgentState).toBe('analyzing')
      actor.stop()
    })

    it('COMPLETE transitions to completed (final)', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'COMPLETE' })
      const snap = actor.getSnapshot()
      expect(snap.value).toBe('completed')
      expect(snap.context.currentAgentState).toBe('completed')
      actor.stop()
    })

    it('ERROR transitions to error state with message', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'ERROR', message: 'Connection lost' })
      const snap = actor.getSnapshot()
      expect(snap.value).toBe('error')
      expect(snap.context.error).toBe('Connection lost')
      actor.stop()
    })

    it('APPROVAL_REQUIRED transitions to awaiting_approval with actionId', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'APPROVAL_REQUIRED', actionId: 'action-42' })
      const snap = actor.getSnapshot()
      expect(snap.value).toBe('awaiting_approval')
      expect(snap.context.activeApprovalId).toBe('action-42')
      actor.stop()
    })
  })

  describe('awaiting_approval state', () => {
    it('APPROVE returns to streaming and clears approvalId', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'APPROVAL_REQUIRED', actionId: 'action-42' })
      actor.send({ type: 'APPROVE', actionId: 'action-42' })
      const snap = actor.getSnapshot()
      expect(snap.value).toBe('streaming')
      expect(snap.context.activeApprovalId).toBeNull()
      actor.stop()
    })

    it('REJECT returns to streaming and clears approvalId', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'APPROVAL_REQUIRED', actionId: 'action-42' })
      actor.send({ type: 'REJECT', actionId: 'action-42', reason: 'Not safe' })
      const snap = actor.getSnapshot()
      expect(snap.value).toBe('streaming')
      expect(snap.context.activeApprovalId).toBeNull()
      actor.stop()
    })

    it('multiple approval cycles work correctly', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'APPROVAL_REQUIRED', actionId: 'action-1' })
      actor.send({ type: 'APPROVE', actionId: 'action-1' })
      actor.send({ type: 'APPROVAL_REQUIRED', actionId: 'action-2' })
      actor.send({ type: 'APPROVE', actionId: 'action-2' })
      actor.send({ type: 'COMPLETE' })
      expect(actor.getSnapshot().value).toBe('completed')
      actor.stop()
    })
  })

  describe('error recovery', () => {
    it('RETRY from error returns to idle', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'ERROR', message: 'Timeout' })
      actor.send({ type: 'RETRY' })
      const snap = actor.getSnapshot()
      expect(snap.value).toBe('idle')
      expect(snap.context.error).toBeNull()
      actor.stop()
    })

    it('RESET from error clears all context', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
      actor.send({ type: 'EVENT_RECEIVED', event: makeStateSnapshot('planning') })
      actor.send({ type: 'ERROR', message: 'Fatal' })
      actor.send({ type: 'RESET' })
      const snap = actor.getSnapshot()
      expect(snap.value).toBe('idle')
      expect(snap.context.events).toEqual([])
      expect(snap.context.error).toBeNull()
      expect(snap.context.activeApprovalId).toBeNull()
      actor.stop()
    })
  })

  describe('idle guard', () => {
    it('ignores non-START events while idle', () => {
      const actor = createActor(agentStreamMachine)
      actor.start()
      actor.send({ type: 'COMPLETE' })
      actor.send({ type: 'ERROR', message: 'oops' })
      expect(actor.getSnapshot().value).toBe('idle')
      actor.stop()
    })
  })
})
