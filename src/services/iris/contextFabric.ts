// ────────────────────────────────────────────────────────────────────────────
// contextFabric — Phase 1a scaffold for the single Iris retrieval entrypoint
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §4
// ADR-020: Context Fabric is the single retrieval entrypoint for all Iris calls.
//
// Phase 1a deliverable (Day 1 per spec): scaffold + types + empty slot builders
// that return null, plus a renderer that handles empty slots gracefully. The
// real per-slot DB resolvers land on Phase 1 Days 2–8 (see slot builder TODOs
// below). Phase 1b cuts over the first 3 surfaces (RFI / submittal / daily log).
//
// Test injection: `buildContext` accepts an optional `overrides` map so tests
// can supply pre-built slot data without a Supabase round-trip. Production
// callers pass `overrides: undefined`, and Phase 1a returns `null` slots with
// the renderer dropping them rather than emitting "null" strings.

import { FLAGS } from '../../lib/featureFlags'

import type {
  ContextMeta,
  Derivation,
  IrisContext,
  PersonaSlug,
  ProjectRole,
  SlotName,
  WhatSlot,
  WhenSlot,
  WhereSlot,
  WhoSlot,
  WhySlot,
} from './types/context'
import { FABRIC_VERSION } from './types/context'
import type { IrisInvocation } from './types/invocation'
import { personaForRole } from './personas'

export interface BuildContextOverrides {
  who?: WhoSlot | null
  what?: WhatSlot | null
  when?: WhenSlot | null
  where?: WhereSlot | null
  why?: WhySlot | null
}

export interface BuildContextResult {
  context: IrisContext
  resolved_persona: PersonaSlug
}

// Phase 1a: synchronous, no DB calls. Tests inject `overrides`; production
// callers receive null slots until Phase 1b/1c/1d wire the per-slot resolvers.
export function buildContext(
  invocation: IrisInvocation,
  overrides?: BuildContextOverrides,
): BuildContextResult {
  const builtAt = new Date().toISOString()
  const resolvedPersona = resolvePersonaForInvocation(invocation, overrides?.who)

  const who = overrides?.who ?? null
  const what = overrides?.what ?? null
  const when = overrides?.when ?? null
  const where = overrides?.where ?? null
  const why = overrides?.why ?? null

  const meta: ContextMeta = {
    fabric_version: FABRIC_VERSION,
    built_at: builtAt,
    cache_hit: false,
    token_counts: estimateSlotTokens({ who, what, when, where, why }),
    trim_log: [],
    derivation: {
      // Phase 1a has zero LLM-derived fields (spec §4.5).
      who: 'deterministic' as Derivation,
      what: 'deterministic' as Derivation,
      when: 'deterministic' as Derivation,
      where: 'deterministic' as Derivation,
      why: 'deterministic' as Derivation,
    },
  }

  const context: IrisContext = {
    who,
    what,
    when,
    where,
    why,
    meta,
  }

  return { context, resolved_persona: resolvedPersona }
}

// Resolution preference (Phase 1a slice of ADR-019):
//   1. invocation.workflow_override_persona
//   2. invocation.caller_override_persona  (test/eval only)
//   3. who.persona (caller-resolved per Phase 1d DB row)
//   4. role → default-persona table
//   5. 'pm' fallback
export function resolvePersonaForInvocation(
  invocation: IrisInvocation,
  who: WhoSlot | null | undefined,
): PersonaSlug {
  if (invocation.workflow_override_persona) return invocation.workflow_override_persona
  if (invocation.caller_override_persona) return invocation.caller_override_persona
  if (who?.persona) return who.persona
  if (who?.role) return personaForRole(who.role as ProjectRole)
  return 'pm'
}

// ────────────────────────────────────────────────────────────────────────────
// Token estimation
// ────────────────────────────────────────────────────────────────────────────
// We avoid pulling tiktoken into the bundle for Phase 1a. The estimator
// approximates cl100k_base by 4 chars/token, which is within ±10% of the true
// count for English construction prose — good enough for budget enforcement
// at render time. Phase 1 Day 9 swaps in a real tokenizer if telemetry shows
// the estimator is drifting too far on Foreman voice transcripts.
export function estimateTokens(s: string | null | undefined): number {
  if (!s) return 0
  return Math.ceil(s.length / 4)
}

export function estimateSlotTokens(slots: {
  who: WhoSlot | null
  what: WhatSlot | null
  when: WhenSlot | null
  where: WhereSlot | null
  why: WhySlot | null
}): Record<SlotName, number> {
  return {
    who: slots.who ? estimateTokens(JSON.stringify(slots.who)) : 0,
    what: slots.what ? estimateTokens(JSON.stringify(slots.what)) : 0,
    when: slots.when ? estimateTokens(JSON.stringify(slots.when)) : 0,
    where: slots.where ? estimateTokens(JSON.stringify(slots.where)) : 0,
    why: slots.why ? estimateTokens(JSON.stringify(slots.why)) : 0,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Feature flag wrapper for callers
// ────────────────────────────────────────────────────────────────────────────
// Phase 1b cutover targets check this before deciding whether to route through
// the Fabric or fall back to the legacy `system=` builder. Default off.
export function shouldUseFabric(): boolean {
  return FLAGS.irisUseFabric
}
