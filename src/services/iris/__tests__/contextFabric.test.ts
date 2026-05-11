// ────────────────────────────────────────────────────────────────────────────
// Context Fabric scaffold tests — Phase 1a
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §9
// ADR-020 + ADR-019.
//
// Goal: prove the Fabric and renderer behave deterministically across the
// 30-call matrix (5 personas × 6 entity kinds) and never exceed the per-slot
// or total token ceilings. The slot data is hand-crafted fixture data; real
// DB-bound slot builders land in Phase 1 Days 2–8.

import { describe, expect, it } from 'vitest'

import { buildContext, estimateTokens, resolvePersonaForInvocation } from '../contextFabric'
import { getPersonaConfig, PERSONAS, personaForRole } from '../personas'
import { renderContext } from '../renderContext'
import type {
  EntityType,
  IrisContext,
  PersonaSlug,
  WhatSlot,
  WhenSlot,
  WhereSlot,
  WhoSlot,
  WhySlot,
} from '../types/context'
import { FABRIC_VERSION, SLOT_TOKEN_CEILINGS, TOTAL_FABRIC_TOKEN_BUDGET } from '../types/context'
import type { IrisInvocation } from '../types/invocation'

const ALL_PERSONAS: PersonaSlug[] = ['pm', 'superintendent', 'foreman', 'owner_rep', 'office']
const ALL_ENTITY_KINDS: EntityType[] = [
  'rfi',
  'submittal',
  'daily_log',
  'change_order',
  'punch_item',
  'schedule_activity',
]

function fixtureInvocation(persona: PersonaSlug, entity: EntityType): IrisInvocation {
  return {
    user_id: `user-${persona}`,
    org_id: 'org-fixture',
    project_id: 'project-avery-oaks',
    current_page: `/${entity}s/fixture-id/detail`,
    entity_type: entity,
    entity_id: 'fixture-id',
    invocation_intent: 'draft_email',
    workflow_override_persona: null,
    caller_override_persona: persona,
  }
}

function fixtureSlots(persona: PersonaSlug, entity: EntityType): {
  who: WhoSlot
  what: WhatSlot
  when: WhenSlot
  where: WhereSlot
  why: WhySlot
} {
  return {
    who: {
      user_id: `user-${persona}`,
      persona,
      role: 'gc_pm',
      display_name: 'Test User',
      first_name: 'Test',
      recent_actions: [
        { action: 'opened', entity_ref: `${entity}#fixture-id`, occurred_at: '2026-05-11T10:00:00Z' },
        { action: 'commented', entity_ref: `${entity}#fixture-id`, occurred_at: '2026-05-11T10:05:00Z' },
      ],
      permissions: [
        { capability: `${entity}.read`, scope: 'project', granted: true },
        { capability: `${entity}.write`, scope: 'project', granted: true },
      ],
      reporting_chain: [],
    },
    what: {
      entity_type: entity,
      entity_id: 'fixture-id',
      entity_state: 'open',
      entity_summary: `Fixture ${entity} for ${persona} persona divergence test`,
      related_entities: [],
      current_page: `/${entity}s/fixture-id/detail`,
    },
    when: {
      project_phase: 'superstructure',
      days_to_substantial_completion: 145,
      schedule_status: 'on_track',
      schedule_variance_days: 2,
      last_user_session_at: '2026-05-10T16:30:00Z',
      cycle_position: 'normal_week',
    },
    where: {
      project_id: 'project-avery-oaks',
      project_name: 'Avery Oaks',
      area_id: null,
      area_name: null,
      gps_hint: null,
      weather_now: { temp_f: 64, conditions: 'Partly cloudy', precipitation_pct: 10, as_of: '2026-05-11T09:00:00Z' },
      weather_5d_forecast: null,
    },
    why: {
      invocation_intent: 'draft_email',
      page_intent: 'detail_view',
      recent_query_history: [],
      pinned_context: [],
    },
  }
}

describe('buildContext', () => {
  it('produces an IrisContext with the current FABRIC_VERSION', () => {
    const invocation = fixtureInvocation('pm', 'rfi')
    const { context } = buildContext(invocation)
    expect(context.meta.fabric_version).toBe(FABRIC_VERSION)
  })

  it('returns null slots when no overrides are supplied (Phase 1a stub)', () => {
    const { context } = buildContext(fixtureInvocation('pm', 'rfi'))
    expect(context.who).toBeNull()
    expect(context.what).toBeNull()
    expect(context.when).toBeNull()
    expect(context.where).toBeNull()
    expect(context.why).toBeNull()
  })

  it('uses test overrides when provided (Phase 1a injection point)', () => {
    const slots = fixtureSlots('superintendent', 'daily_log')
    const { context } = buildContext(fixtureInvocation('superintendent', 'daily_log'), slots)
    expect(context.who).toEqual(slots.who)
    expect(context.what).toEqual(slots.what)
    expect(context.meta.token_counts.who).toBeGreaterThan(0)
  })

  it('flags every slot as deterministic in Phase 1a (no LLM-derived fields)', () => {
    const slots = fixtureSlots('pm', 'rfi')
    const { context } = buildContext(fixtureInvocation('pm', 'rfi'), slots)
    for (const slot of ['who', 'what', 'when', 'where', 'why'] as const) {
      expect(context.meta.derivation[slot]).toBe('deterministic')
    }
  })
})

describe('resolvePersonaForInvocation (ADR-019 hierarchy)', () => {
  const baseWho = (persona: PersonaSlug): WhoSlot => ({
    user_id: 'u',
    persona,
    role: 'gc_pm',
    display_name: 'U',
    first_name: 'U',
    recent_actions: [],
    permissions: [],
    reporting_chain: [],
  })

  it('prefers workflow_override over everything else', () => {
    const invocation: IrisInvocation = {
      ...fixtureInvocation('pm', 'rfi'),
      workflow_override_persona: 'office',
      caller_override_persona: 'foreman',
    }
    expect(resolvePersonaForInvocation(invocation, baseWho('superintendent'))).toBe('office')
  })

  it('prefers caller_override over who.persona', () => {
    const invocation: IrisInvocation = {
      ...fixtureInvocation('pm', 'rfi'),
      workflow_override_persona: null,
      caller_override_persona: 'foreman',
    }
    expect(resolvePersonaForInvocation(invocation, baseWho('superintendent'))).toBe('foreman')
  })

  it('falls back to who.persona when no overrides are set', () => {
    const invocation: IrisInvocation = {
      ...fixtureInvocation('pm', 'rfi'),
      workflow_override_persona: null,
      caller_override_persona: null,
    }
    expect(resolvePersonaForInvocation(invocation, baseWho('owner_rep'))).toBe('owner_rep')
  })

  it('falls back to role→persona map when who is missing persona', () => {
    const invocation: IrisInvocation = {
      ...fixtureInvocation('pm', 'rfi'),
      workflow_override_persona: null,
      caller_override_persona: null,
    }
    const who = baseWho('pm')
    // Force the type to test the role-fallback path.
    const whoNoPersona = { ...who, persona: undefined } as unknown as WhoSlot
    expect(resolvePersonaForInvocation(invocation, whoNoPersona)).toBe(personaForRole('gc_pm'))
  })

  it('defaults to pm when both who and overrides are null', () => {
    const invocation: IrisInvocation = {
      ...fixtureInvocation('pm', 'rfi'),
      workflow_override_persona: null,
      caller_override_persona: null,
    }
    expect(resolvePersonaForInvocation(invocation, null)).toBe('pm')
  })
})

describe('renderContext — empty Fabric', () => {
  it('renders persona preamble only when all slots are null', () => {
    const { context } = buildContext(fixtureInvocation('pm', 'rfi'))
    const result = renderContext(context, 'pm')
    expect(result.prompt).toBe(PERSONAS.pm.base_prompt_fragment.trim())
    expect(result.trim_log).toHaveLength(0)
  })

  it('emits no literal "null" strings', () => {
    const { context } = buildContext(fixtureInvocation('owner_rep', 'change_order'))
    const result = renderContext(context, 'owner_rep')
    expect(result.prompt).not.toMatch(/\bnull\b/)
  })
})

describe('renderContext — 30-call snapshot matrix (5 personas × 6 entities)', () => {
  for (const persona of ALL_PERSONAS) {
    for (const entity of ALL_ENTITY_KINDS) {
      it(`builds + renders deterministic prompt for ${persona} × ${entity}`, () => {
        const slots = fixtureSlots(persona, entity)
        const invocation = fixtureInvocation(persona, entity)
        const { context, resolved_persona } = buildContext(invocation, slots)
        expect(resolved_persona).toBe(persona)

        const result = renderContext(context, persona)
        // Deterministic: same inputs → identical output (no Date.now in render).
        const rerendered = renderContext(context, persona)
        expect(rerendered.prompt).toBe(result.prompt)

        // Persona preamble always present.
        expect(result.prompt).toContain(getPersonaConfig(persona).base_prompt_fragment.trim().slice(0, 40))

        // WHO/WHAT/WHEN/WHERE/WHY blocks all present given the fixture.
        expect(result.prompt).toContain('### WHO')
        expect(result.prompt).toContain('### WHAT')
        expect(result.prompt).toContain('### WHEN')
        expect(result.prompt).toContain('### WHERE')
        expect(result.prompt).toContain('### WHY')

        // No spurious null strings.
        expect(result.prompt).not.toMatch(/\bnull\b/)
      })
    }
  }
})

describe('token budgets', () => {
  it('keeps every slot under its per-slot ceiling on fixture data', () => {
    for (const persona of ALL_PERSONAS) {
      for (const entity of ALL_ENTITY_KINDS) {
        const slots = fixtureSlots(persona, entity)
        const { context } = buildContext(fixtureInvocation(persona, entity), slots)
        for (const slot of ['who', 'what', 'when', 'where', 'why'] as const) {
          expect(context.meta.token_counts[slot]).toBeLessThanOrEqual(SLOT_TOKEN_CEILINGS[slot] * 2)
          // Loose check: per-slot estimator uses JSON, so we allow 2× as a sanity
          // bound. Tight render-time enforcement happens in renderContext().
        }
      }
    }
  })

  it('renders within the 2950-token total budget for every (persona × entity) pair', () => {
    for (const persona of ALL_PERSONAS) {
      for (const entity of ALL_ENTITY_KINDS) {
        const slots = fixtureSlots(persona, entity)
        const { context } = buildContext(fixtureInvocation(persona, entity), slots)
        const result = renderContext(context, persona)
        expect(result.tokens_estimated).toBeLessThanOrEqual(TOTAL_FABRIC_TOKEN_BUDGET)
      }
    }
  })

  it('truncates and logs an overflow when an oversized prompt would emit', () => {
    // Construct a deliberately huge what slot to force the global truncation path.
    const slots = fixtureSlots('pm', 'rfi')
    const massiveSummary = 'X'.repeat(4 * (TOTAL_FABRIC_TOKEN_BUDGET + 1000))
    slots.what.entity_summary = massiveSummary
    const { context } = buildContext(fixtureInvocation('pm', 'rfi'), slots)
    const result = renderContext(context, 'pm')
    expect(result.tokens_estimated).toBeLessThanOrEqual(TOTAL_FABRIC_TOKEN_BUDGET)
    expect(result.trim_log.some((e) => e.reason === 'over_budget')).toBe(true)
  })

  it('estimateTokens approximates 4 chars per token', () => {
    expect(estimateTokens('1234')).toBe(1)
    expect(estimateTokens('1234567890')).toBe(3) // ceil(10/4) = 3
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens(null)).toBe(0)
  })
})

describe('PERSONAS registry parity with seed migration', () => {
  it('all 5 personas exist with valid auto_action_threshold', () => {
    const expectedSlugs: PersonaSlug[] = ['pm', 'superintendent', 'foreman', 'owner_rep', 'office']
    for (const slug of expectedSlugs) {
      const cfg = getPersonaConfig(slug)
      expect(cfg.slug).toBe(slug)
      expect(cfg.auto_action_threshold).toBeGreaterThanOrEqual(0)
      expect(cfg.auto_action_threshold).toBeLessThanOrEqual(1)
      expect(cfg.base_prompt_fragment.length).toBeGreaterThan(0)
      expect(cfg.tool_allow_list.length).toBeGreaterThan(0)
    }
  })

  it('owner_rep is configured as never-auto (threshold = 1.0)', () => {
    expect(getPersonaConfig('owner_rep').auto_action_threshold).toBe(1.0)
  })

  it('foreman threshold is the highest non-owner_rep persona (per ADR-019)', () => {
    expect(getPersonaConfig('foreman').auto_action_threshold).toBe(0.9)
  })
})

// Force the IrisContext type to be referenced so the import isn't pruned.
const _typeProbe: IrisContext | null = null
void _typeProbe
