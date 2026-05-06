import { describe, it, expect } from 'vitest'
import { transition, evaluateExpression } from '../runner'
import type { WorkflowDefinition, EntityState, WorkflowEvent } from '../../../types/workflows'
import { defaultChangeOrderWorkflow, defaultRfiWorkflow } from '../definitions'

const PROJECT = '00000000-0000-0000-0000-000000000001'

function pinned(def: WorkflowDefinition, current_step: string, entity: Record<string, unknown> = {}): EntityState {
  return {
    current_step,
    entity,
    pinned_definition_id: def.id,
    pinned_version: def.version,
  }
}

describe('workflow runner — linear chain', () => {
  it('moves a draft RFI to pending_response on submit', () => {
    const def = defaultRfiWorkflow(PROJECT)
    const state = pinned(def, 'draft')
    const evt: WorkflowEvent = { type: 'submit', actor_user_id: 'u1', actor_role: 'pm' }
    const result = transition(def, state, evt)
    expect(result.error).toBeNull()
    expect(result.data?.next_step).toBe('pending_response')
    expect(result.data?.terminal).toBe(false)
    expect(result.data?.notify_severity).toBe('normal')
  })

  it('answers an RFI from pending_response on approve', () => {
    const def = defaultRfiWorkflow(PROJECT)
    const state = pinned(def, 'pending_response')
    const result = transition(def, state, { type: 'approve', actor_user_id: 'a1', actor_role: 'architect' })
    expect(result.data?.next_step).toBe('answered')
    expect(result.data?.terminal).toBe(true)
  })
})

describe('workflow runner — conditional branching', () => {
  it('routes CO under $50k to PM approval', () => {
    const def = defaultChangeOrderWorkflow(PROJECT)
    const state = pinned(def, 'route', { cost_impact: 25000 })
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'pm' })
    expect(result.data?.next_step).toBe('pm_approval')
  })

  it('routes CO over $50k to owner approval', () => {
    const def = defaultChangeOrderWorkflow(PROJECT)
    const state = pinned(def, 'route', { cost_impact: 75000 })
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'pm' })
    expect(result.data?.next_step).toBe('owner_approval')
    expect(result.data?.notify_severity).toBe('critical')
  })

  it('falls through to default branch when no condition matches', () => {
    const def: WorkflowDefinition = {
      id: 'test',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'test',
      start_step: 'a',
      steps: [
        {
          id: 'a',
          name: 'a',
          transitions: [
            { when: 'priority == "critical"', to: 'b' },
            { to: 'c' },
          ],
        },
        { id: 'b', name: 'b', terminal: true, transitions: [] },
        { id: 'c', name: 'c', terminal: true, transitions: [] },
      ],
    }
    const state = pinned(def, 'a', { priority: 'low' })
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'pm' })
    expect(result.data?.next_step).toBe('c')
  })
})

describe('workflow runner — role gating', () => {
  it('rejects a submit by an unauthorized role', () => {
    const def = defaultRfiWorkflow(PROJECT)
    const state = pinned(def, 'draft')
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'sub' })
    expect(result.error?.category).toBe('PermissionError')
  })

  it('allows pm role to submit a draft', () => {
    const def = defaultRfiWorkflow(PROJECT)
    const state = pinned(def, 'draft')
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'pm' })
    expect(result.error).toBeNull()
  })

  it('allows admin role on owner approval step (multi-role)', () => {
    const def = defaultChangeOrderWorkflow(PROJECT)
    const state = pinned(def, 'owner_approval', {})
    const result = transition(def, state, { type: 'approve', actor_user_id: 'u1', actor_role: 'admin' })
    expect(result.data?.next_step).toBe('approved')
  })
})

describe('workflow runner — version pinning', () => {
  it('rejects when pinned version drifts', () => {
    const def = defaultRfiWorkflow(PROJECT)
    const state: EntityState = {
      current_step: 'draft',
      entity: {},
      pinned_definition_id: def.id,
      pinned_version: 0, // wrong
    }
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'pm' })
    expect(result.error?.category).toBe('ValidationError')
    expect(result.error?.message).toContain('version')
  })

  it('rejects when pinned definition id mismatches', () => {
    const def = defaultRfiWorkflow(PROJECT)
    const state: EntityState = {
      current_step: 'draft',
      entity: {},
      pinned_definition_id: 'some-other-id',
      pinned_version: def.version,
    }
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'pm' })
    expect(result.error?.category).toBe('ValidationError')
    expect(result.error?.message).toContain('definition')
  })
})

describe('workflow runner — terminal handling', () => {
  it('rejects transitioning out of a terminal step', () => {
    const def = defaultRfiWorkflow(PROJECT)
    const state = pinned(def, 'answered')
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'pm' })
    expect(result.error?.message).toContain('terminal')
  })

  it('reports terminal=true on entry to terminal step', () => {
    const def = defaultChangeOrderWorkflow(PROJECT)
    const state = pinned(def, 'pm_approval')
    const result = transition(def, state, { type: 'approve', actor_user_id: 'u1', actor_role: 'pm' })
    expect(result.data?.terminal).toBe(true)
    expect(result.data?.next_step).toBe('approved')
  })
})

describe('workflow runner — no matching transition', () => {
  it('errors when no transition matches the event', () => {
    const def = defaultRfiWorkflow(PROJECT)
    const state = pinned(def, 'pending_response')
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'architect' })
    expect(result.error?.message).toContain('No transition matched')
  })
})

describe('workflow runner — malformed expression', () => {
  it('rejects malformed expression at runtime', () => {
    const def: WorkflowDefinition = {
      id: 'test',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'test',
      start_step: 'a',
      steps: [
        { id: 'a', name: 'a', transitions: [{ when: 'foo >>>>> 1', to: 'b' }] },
        { id: 'b', name: 'b', terminal: true, transitions: [] },
      ],
    }
    const state = pinned(def, 'a', {})
    const result = transition(def, state, { type: 'submit', actor_user_id: 'u1', actor_role: 'pm' })
    expect(result.error?.code).toBe('INVALID_TRANSITION')
    expect(result.error?.message).toContain('Malformed')
  })
})

describe('expression evaluator', () => {
  it('handles simple comparisons', () => {
    expect(evaluateExpression('cost > 100', { cost: 200 })).toEqual({ ok: true, value: true })
    expect(evaluateExpression('cost > 100', { cost: 50 })).toEqual({ ok: true, value: false })
  })

  it('handles && and ||', () => {
    expect(evaluateExpression('a > 1 && b == "x"', { a: 5, b: 'x' })).toEqual({ ok: true, value: true })
    expect(evaluateExpression('a > 1 || b == "x"', { a: 0, b: 'x' })).toEqual({ ok: true, value: true })
    expect(evaluateExpression('a > 1 && b == "x"', { a: 0, b: 'x' })).toEqual({ ok: true, value: false })
  })

  it('handles dotted paths', () => {
    expect(evaluateExpression('user.role == "admin"', { user: { role: 'admin' } })).toEqual({ ok: true, value: true })
    expect(evaluateExpression('entity.cost_impact > 50000', { cost_impact: 75000 })).toEqual({ ok: true, value: true })
  })

  it('handles negation and parens', () => {
    expect(evaluateExpression('!(a > 1)', { a: 0 })).toEqual({ ok: true, value: true })
  })

  it('rejects unknown identifiers gracefully (treat as undefined, not strictly null)', () => {
    const r = evaluateExpression('unknown_field == null', {})
    expect(r.ok).toBe(true)
    // undefined !== null; expression is false
    expect(r.ok && r.value).toBe(false)
  })

  it('rejects malformed expressions', () => {
    expect(evaluateExpression('a >', {})).toMatchObject({ ok: false })
    expect(evaluateExpression('(a > 1', {})).toMatchObject({ ok: false })
  })

  it('handles negative numbers', () => {
    expect(evaluateExpression('cost == -50', { cost: -50 })).toEqual({ ok: true, value: true })
  })
})
