import { describe, it, expect } from 'vitest'
import {
  defaultRfiWorkflow,
  defaultChangeOrderWorkflow,
  defaultSubmittalWorkflow,
  buildDefaultWorkflow,
} from '../definitions'

const PROJECT = 'p1'

describe('default workflow builders', () => {
  it('builds an RFI workflow with version 1', () => {
    const w = defaultRfiWorkflow(PROJECT)
    expect(w.entity_type).toBe('rfi')
    expect(w.version).toBe(1)
    expect(w.steps.length).toBeGreaterThan(0)
  })

  it('builds a CO workflow with cost-routing', () => {
    const w = defaultChangeOrderWorkflow(PROJECT)
    const route = w.steps.find((s) => s.id === 'route')!
    expect(route.transitions.some((t) => t.when?.includes('cost_impact'))).toBe(true)
  })

  it('builds a submittal workflow with revise/resubmit loop terminating', () => {
    const w = defaultSubmittalWorkflow(PROJECT)
    expect(w.steps.find((s) => s.id === 'approved')?.terminal).toBe(true)
  })

  it('returns null for unsupported entity types', () => {
    expect(buildDefaultWorkflow('inspection', PROJECT)).toBeNull()
  })

  it('returns a definition for supported types', () => {
    expect(buildDefaultWorkflow('rfi', PROJECT)?.entity_type).toBe('rfi')
    expect(buildDefaultWorkflow('change_order', PROJECT)?.entity_type).toBe('change_order')
  })
})
