import { describe, it, expect } from 'vitest'
import { validateGraph } from '../validators'
import { defaultRfiWorkflow, defaultChangeOrderWorkflow } from '../definitions'
import type { WorkflowDefinition } from '../../../types/workflows'

const PROJECT = '00000000-0000-0000-0000-000000000001'

describe('validateGraph', () => {
  it('passes for the default RFI workflow', () => {
    const result = validateGraph(defaultRfiWorkflow(PROJECT))
    expect(result.valid).toBe(true)
  })

  it('passes for the default change-order workflow (warns on conditional branch with no fallback expected? No — it has fallback)', () => {
    const result = validateGraph(defaultChangeOrderWorkflow(PROJECT))
    // change-order route step has a fallback (unconditional), so no NO_FALLBACK_BRANCH
    expect(result.valid).toBe(true)
  })

  it('detects a cycle', () => {
    const def: WorkflowDefinition = {
      id: 'cyc',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'cycle',
      start_step: 'a',
      steps: [
        { id: 'a', name: 'a', transitions: [{ to: 'b' }] },
        { id: 'b', name: 'b', transitions: [{ to: 'a' }] },
      ],
    }
    const result = validateGraph(def)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'CYCLE_DETECTED')).toBe(true)
  })

  it('detects unreachable steps', () => {
    const def: WorkflowDefinition = {
      id: 'unr',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'unreachable',
      start_step: 'a',
      steps: [
        { id: 'a', name: 'a', terminal: true, transitions: [] },
        { id: 'b', name: 'b', terminal: true, transitions: [] },
      ],
    }
    const result = validateGraph(def)
    expect(result.issues.some((i) => i.code === 'UNREACHABLE_STEP' && i.step_id === 'b')).toBe(true)
  })

  it('errors when there is no terminal step', () => {
    const def: WorkflowDefinition = {
      id: 'not',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'no terminal',
      start_step: 'a',
      steps: [{ id: 'a', name: 'a', transitions: [{ to: 'a' }] }],
    }
    const result = validateGraph(def)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'NO_TERMINAL')).toBe(true)
  })

  it('errors when transition target does not exist', () => {
    const def: WorkflowDefinition = {
      id: 'bad',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'bad target',
      start_step: 'a',
      steps: [
        { id: 'a', name: 'a', transitions: [{ to: 'nowhere' }] },
        { id: 'b', name: 'b', terminal: true, transitions: [] },
      ],
    }
    const result = validateGraph(def)
    expect(result.issues.some((i) => i.code === 'BAD_TRANSITION_TARGET')).toBe(true)
  })

  it('errors when start_step is not in steps', () => {
    const def: WorkflowDefinition = {
      id: 'noStart',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'no start',
      start_step: 'doesNotExist',
      steps: [{ id: 'a', name: 'a', terminal: true, transitions: [] }],
    }
    expect(validateGraph(def).valid).toBe(false)
  })

  it('errors on duplicate step ids', () => {
    const def: WorkflowDefinition = {
      id: 'dup',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'dup',
      start_step: 'a',
      steps: [
        { id: 'a', name: 'a', transitions: [{ to: 'b' }] },
        { id: 'a', name: 'a2', transitions: [{ to: 'b' }] },
        { id: 'b', name: 'b', terminal: true, transitions: [] },
      ],
    }
    const result = validateGraph(def)
    expect(result.issues.some((i) => i.code === 'DUPLICATE_STEP')).toBe(true)
  })

  it('warns on conditional steps without an unconditional fallback', () => {
    const def: WorkflowDefinition = {
      id: 'noFallback',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'no fallback',
      start_step: 'a',
      steps: [
        {
          id: 'a',
          name: 'a',
          transitions: [
            { when: 'x > 1', to: 'b' },
            { when: 'x < 0', to: 'c' },
          ],
        },
        { id: 'b', name: 'b', terminal: true, transitions: [] },
        { id: 'c', name: 'c', terminal: true, transitions: [] },
      ],
    }
    const result = validateGraph(def)
    expect(result.issues.some((i) => i.code === 'NO_FALLBACK_BRANCH')).toBe(true)
    // warning, not an error — graph is still valid
    expect(result.valid).toBe(true)
  })

  it('errors on malformed expressions', () => {
    const def: WorkflowDefinition = {
      id: 'badExpr',
      project_id: PROJECT,
      entity_type: 'rfi',
      version: 1,
      name: 'bad expr',
      start_step: 'a',
      steps: [
        { id: 'a', name: 'a', transitions: [{ when: 'x >>>> 1', to: 'b' }, { to: 'b' }] },
        { id: 'b', name: 'b', terminal: true, transitions: [] },
      ],
    }
    const result = validateGraph(def)
    expect(result.issues.some((i) => i.code === 'BAD_EXPRESSION')).toBe(true)
  })
})
