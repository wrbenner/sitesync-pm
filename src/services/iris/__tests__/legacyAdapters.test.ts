// ────────────────────────────────────────────────────────────────────────────
// legacyAdapters tests — Phase 1b cutover parity + Fabric routing
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §5.2
//
// What we assert:
//   - The adapter produces a non-empty Fabric-rendered system prompt for the
//     3 cutover surfaces (RFI follow-up, submittal review, daily log).
//   - The persona resolves correctly per ADR-019 (workflow > caller > role).
//   - The invocation_intent maps each legacy draft type to a Fabric intent.
//   - Token budget is respected for representative inputs across all 6 types.
//   - No "null" string leaks for slots we couldn't populate from existing data.

import { describe, expect, it } from 'vitest'

import { adaptStreamItemToFabric } from '../legacyAdapters'
import type { IrisDraftType, StreamItem } from '../../../types/stream'
import type { ProjectContextSnapshot } from '../types'
import { TOTAL_FABRIC_TOKEN_BUDGET } from '../types/context'

function makeStreamItem(prefix: string, draftType: IrisDraftType): StreamItem {
  return {
    id: `${prefix}-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`,
    type: prefix === 'rfi' ? 'rfi' : prefix === 'submittal' ? 'submittal' : 'rfi',
    title: `Fixture ${prefix} for adapter test`,
    irisEnhancement: {
      draftAvailable: true,
      draftType,
      confidence: 0.85,
      summary: 'fixture summary',
    },
    overdue: true,
    dueDate: '2026-05-10',
  } as unknown as StreamItem
}

function makeProjectContext(): ProjectContextSnapshot {
  return {
    projectId: 'project-avery-oaks',
    projectName: 'Avery Oaks',
    userName: 'Walker Benner',
    userFirstName: 'Walker',
  }
}

const CUTOVER_SURFACES: Array<{ prefix: string; draftType: IrisDraftType }> = [
  { prefix: 'rfi', draftType: 'follow_up_email' },
  { prefix: 'submittal', draftType: 'submittal_review' },
  { prefix: 'dailyLog', draftType: 'daily_log' },
]

describe('adaptStreamItemToFabric — Phase 1b cutover surfaces', () => {
  it.each(CUTOVER_SURFACES)(
    'produces a non-empty Fabric system prompt for %s',
    ({ prefix, draftType }) => {
      const item = makeStreamItem(prefix, draftType)
      const ctx = makeProjectContext()
      const adapted = adaptStreamItemToFabric(item, ctx, draftType, {
        userId: 'user-1',
        userRole: 'gc_pm',
        orgId: 'org-1',
      })
      expect(adapted.systemPrompt.length).toBeGreaterThan(100)
      expect(adapted.systemPrompt).not.toMatch(/\bnull\b/)
      expect(adapted.persona).toBe('pm')
      expect(adapted.promptTokens).toBeLessThanOrEqual(TOTAL_FABRIC_TOKEN_BUDGET)
    },
  )

  it('respects ADR-019 hierarchy — workflow override wins', () => {
    const item = makeStreamItem('rfi', 'follow_up_email')
    const ctx = makeProjectContext()
    const adapted = adaptStreamItemToFabric(item, ctx, 'follow_up_email', {
      userId: 'user-1',
      userRole: 'gc_pm',
      orgId: 'org-1',
      workflowOverride: 'office',
    })
    expect(adapted.persona).toBe('office')
    expect(adapted.systemPrompt).toContain('back office')
  })

  it('respects ADR-019 hierarchy — caller override wins over role default', () => {
    const item = makeStreamItem('rfi', 'follow_up_email')
    const ctx = makeProjectContext()
    const adapted = adaptStreamItemToFabric(item, ctx, 'follow_up_email', {
      userId: 'user-1',
      userRole: 'gc_pm',
      orgId: 'org-1',
      personaOverride: 'superintendent',
    })
    expect(adapted.persona).toBe('superintendent')
    expect(adapted.systemPrompt).toContain('hard hat')
  })

  it('falls back to role→persona map when no override is provided', () => {
    const item = makeStreamItem('rfi', 'follow_up_email')
    const ctx = makeProjectContext()
    const adapted = adaptStreamItemToFabric(item, ctx, 'follow_up_email', {
      userId: 'user-1',
      userRole: 'gc_super',
      orgId: 'org-1',
    })
    expect(adapted.persona).toBe('superintendent')
  })

  it('maps each legacy draftType to a Fabric invocation_intent', () => {
    const cases: Array<{ draftType: IrisDraftType; expect: string }> = [
      { draftType: 'follow_up_email', expect: 'draft_email' },
      { draftType: 'rfi_response', expect: 'draft_email' },
      { draftType: 'submittal_review', expect: 'draft_email' },
      { draftType: 'daily_log', expect: 'draft_daily_log' },
      { draftType: 'schedule_suggestion', expect: 'recommend_action' },
      { draftType: 'owner_update', expect: 'draft_owner_update' },
    ]
    for (const c of cases) {
      const item = makeStreamItem('rfi', c.draftType)
      const adapted = adaptStreamItemToFabric(item, makeProjectContext(), c.draftType, {
        userId: 'u',
        userRole: 'gc_pm',
        orgId: 'org',
      })
      expect(adapted.invocation.invocation_intent).toBe(c.expect)
    }
  })

  it('emits WHO/WHAT/WHERE/WHY blocks when caller data is populated', () => {
    const item = makeStreamItem('rfi', 'follow_up_email')
    const ctx = makeProjectContext()
    const adapted = adaptStreamItemToFabric(item, ctx, 'follow_up_email', {
      userId: 'user-1',
      userRole: 'gc_pm',
      orgId: 'org-1',
    })
    expect(adapted.systemPrompt).toContain('### WHO')
    expect(adapted.systemPrompt).toContain('### WHAT')
    expect(adapted.systemPrompt).toContain('### WHERE')
    expect(adapted.systemPrompt).toContain('### WHY')
    // WHEN slot is null in Phase 1b (Day 6 wires it up).
    expect(adapted.systemPrompt).not.toContain('### WHEN')
  })

  it('omits the WHERE block entirely when projectId is absent', () => {
    const item = makeStreamItem('rfi', 'follow_up_email')
    const ctx: ProjectContextSnapshot = { projectId: null, projectName: null, userName: 'X' }
    const adapted = adaptStreamItemToFabric(item, ctx, 'follow_up_email', {
      userId: 'u',
      userRole: 'gc_pm',
      orgId: 'org',
    })
    expect(adapted.systemPrompt).not.toContain('### WHERE')
    expect(adapted.systemPrompt).not.toMatch(/\bnull\b/)
  })

  it('includes weather data in WHERE when project context carries weather', () => {
    const item = makeStreamItem('dailyLog', 'daily_log')
    const ctx: ProjectContextSnapshot = {
      ...makeProjectContext(),
      weather: { summary: 'Heavy rain', tempF: 58 },
    }
    const adapted = adaptStreamItemToFabric(item, ctx, 'daily_log', {
      userId: 'u',
      userRole: 'gc_super',
      orgId: 'org',
    })
    expect(adapted.systemPrompt).toContain('Heavy rain')
    expect(adapted.systemPrompt).toContain('58°F')
  })
})

describe('adaptStreamItemToFabric — invariants across all 6 draft types', () => {
  const ALL_DRAFT_TYPES: IrisDraftType[] = [
    'follow_up_email',
    'daily_log',
    'rfi_response',
    'submittal_review',
    'schedule_suggestion',
    'owner_update',
  ]

  it.each(ALL_DRAFT_TYPES)(
    'never emits "null" strings for draftType %s',
    (draftType) => {
      const item = makeStreamItem('rfi', draftType)
      const adapted = adaptStreamItemToFabric(item, makeProjectContext(), draftType, {
        userId: 'u',
        userRole: 'gc_pm',
        orgId: 'org',
      })
      expect(adapted.systemPrompt).not.toMatch(/\bnull\b/)
    },
  )

  it.each(ALL_DRAFT_TYPES)(
    'stays within total token budget for draftType %s',
    (draftType) => {
      const item = makeStreamItem('rfi', draftType)
      const adapted = adaptStreamItemToFabric(item, makeProjectContext(), draftType, {
        userId: 'u',
        userRole: 'gc_pm',
        orgId: 'org',
      })
      expect(adapted.promptTokens).toBeLessThanOrEqual(TOTAL_FABRIC_TOKEN_BUDGET)
      expect(adapted.truncated).toBe(false)
    },
  )

  it.each(ALL_DRAFT_TYPES)(
    'produces a deterministic prompt for draftType %s (same input → same output)',
    (draftType) => {
      const item = makeStreamItem('rfi', draftType)
      const ctx = makeProjectContext()
      const opts = { userId: 'u', userRole: 'gc_pm' as const, orgId: 'org' }
      const a = adaptStreamItemToFabric(item, ctx, draftType, opts)
      const b = adaptStreamItemToFabric(item, ctx, draftType, opts)
      expect(b.systemPrompt).toBe(a.systemPrompt)
    },
  )
})
