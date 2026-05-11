// ────────────────────────────────────────────────────────────────────────────
// Drafter specialist tests — Phase 2a (ADR-018 conformance + gating)
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md
// ADR-018 boundary contract.
//
// Phase 2a ships the deterministic-check gate + the SpecialistDecl shape.
// The 50-fixture golden set is Walker-authored across Phase 2 Days 31–37
// per the spec; the 12 tests here cover the contract surface invariants +
// representative gate decisions.

import { describe, expect, it } from 'vitest'

import {
  DRAFTER_DECL,
  drafterDeterministicCheck,
  drafterShouldRun,
  type DrafterInput,
} from '../drafter'
import { BASE_AUDIT_FIELDS } from '../types'
import { buildContext } from '../../contextFabric'
import type { IrisDraftType, StreamItem } from '../../../../types/stream'
import type { ProjectContextSnapshot } from '../../types'

function fixtureItem(overrides: Partial<StreamItem> = {}): StreamItem {
  return {
    id: 'rfi-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    type: 'rfi',
    title: 'Fixture RFI title',
    overdue: true,
    dueDate: '2026-05-10',
    ...overrides,
  } as unknown as StreamItem
}

function fixtureCtx(overrides: Partial<ProjectContextSnapshot> = {}): ProjectContextSnapshot {
  return {
    projectId: 'project-avery-oaks',
    projectName: 'Avery Oaks',
    userName: 'Walker Benner',
    userFirstName: 'Walker',
    recipientName: 'Casey Architect',
    ...overrides,
  }
}

function fixtureInput(
  draftType: IrisDraftType,
  itemOverrides?: Partial<StreamItem>,
  ctxOverrides?: Partial<ProjectContextSnapshot>,
): DrafterInput {
  return {
    item: fixtureItem(itemOverrides),
    project_context: fixtureCtx(ctxOverrides),
    draft_type: draftType,
    persona: 'pm',
  }
}

function emptyContext() {
  const { context } = buildContext({
    user_id: 'u',
    org_id: 'org',
    project_id: 'project-avery-oaks',
    current_page: '/rfis/x/detail',
    entity_type: 'rfi',
    entity_id: 'x',
    invocation_intent: 'draft_email',
  })
  return context
}

describe('DRAFTER_DECL — ADR-018 boundary conformance', () => {
  it('declares the canonical specialist shape', () => {
    expect(DRAFTER_DECL.name).toBe('drafter')
    expect(DRAFTER_DECL.llmScope).toBe('generative')
    expect(DRAFTER_DECL.modelTier).toBe('sonnet')
    expect(DRAFTER_DECL.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(DRAFTER_DECL.promptVersion.length).toBeGreaterThan(0)
  })

  it('has an empty writeScope (drafter is read-only — executors commit)', () => {
    expect(DRAFTER_DECL.writeScope).toEqual([])
  })

  it('declares every base audit field plus draft_type, persona, truncated', () => {
    const declared = new Set(DRAFTER_DECL.auditFields)
    for (const base of BASE_AUDIT_FIELDS) {
      expect(declared.has(base)).toBe(true)
    }
    expect(declared.has('draft_type')).toBe(true)
    expect(declared.has('persona')).toBe(true)
    expect(declared.has('truncated')).toBe(true)
  })

  it('latency budget P50 < P95 and both are positive', () => {
    expect(DRAFTER_DECL.latencyBudgetMs.p50).toBeGreaterThan(0)
    expect(DRAFTER_DECL.latencyBudgetMs.p95).toBeGreaterThan(DRAFTER_DECL.latencyBudgetMs.p50)
  })

  it('tool allow-list contains only cite_* tools (8 citation kinds + photo)', () => {
    for (const tool of DRAFTER_DECL.toolAllowList) {
      expect(tool.startsWith('cite_')).toBe(true)
    }
  })
})

describe('drafterDeterministicCheck — gate decisions', () => {
  const ctx = emptyContext()

  it('passes a healthy follow-up email input', () => {
    const result = drafterDeterministicCheck(fixtureInput('follow_up_email'), ctx)
    expect(result.ok).toBe(true)
    expect(result.blockers).toBeUndefined()
  })

  it('blocks when item.id is missing', () => {
    const input = fixtureInput('follow_up_email', { id: '' } as unknown as Partial<StreamItem>)
    const result = drafterDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b) => b.includes('item.id'))).toBe(true)
  })

  it('blocks when item.title is missing or whitespace', () => {
    const input = fixtureInput('follow_up_email', { title: '   ' })
    const result = drafterDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b) => b.includes('item.title'))).toBe(true)
  })

  it('blocks when project_context.projectId is missing', () => {
    const input = fixtureInput('follow_up_email', undefined, { projectId: null })
    const result = drafterDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b) => b.includes('projectId'))).toBe(true)
  })

  it('emits a warning (not a blocker) when both recipientName and assignedTo are missing', () => {
    const input = fixtureInput(
      'follow_up_email',
      { assignedTo: undefined } as unknown as Partial<StreamItem>,
      { recipientName: undefined },
    )
    const result = drafterDeterministicCheck(input, ctx)
    expect(result.ok).toBe(true)
    expect(result.warnings?.some((w) => w.includes('recipient'))).toBe(true)
  })

  it('blocks owner_update when reportingPeriodDays is missing or <= 0', () => {
    const input = fixtureInput('owner_update')
    const result = drafterDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b) => b.includes('reportingPeriodDays'))).toBe(true)
  })

  it('passes owner_update when reportingPeriodDays > 0', () => {
    const input = fixtureInput('owner_update', undefined, { reportingPeriodDays: 7 })
    const result = drafterDeterministicCheck(input, ctx)
    expect(result.ok).toBe(true)
  })

  it('passes daily_log without warnings or blockers (Phase 4 will add gates)', () => {
    const input = fixtureInput('daily_log')
    const result = drafterDeterministicCheck(input, ctx)
    expect(result.ok).toBe(true)
    expect(result.warnings).toBeUndefined()
  })

  it('drafterShouldRun returns the same result as drafterDeterministicCheck', () => {
    const input = fixtureInput('follow_up_email')
    const a = drafterDeterministicCheck(input, ctx)
    const b = drafterShouldRun(input, ctx)
    expect(b).toEqual(a)
  })

  it('returns multiple blockers when multiple required fields are missing', () => {
    const input = fixtureInput(
      'follow_up_email',
      { id: '', title: '' } as unknown as Partial<StreamItem>,
      { projectId: null },
    )
    const result = drafterDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.length).toBeGreaterThanOrEqual(3)
  })
})
