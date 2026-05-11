// ────────────────────────────────────────────────────────────────────────────
// Iris router — Phase 2e
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Router §)
//
// Routes an IrisInvocation + context to one of the 4 specialists. The router
// uses a cascading strategy per spec:
//
//   1. Deterministic-first — if the (intent, entity_type) tuple maps to a
//      single specialist with high confidence, return it immediately.
//   2. Regex/keyword classifier — when the deterministic map is ambiguous,
//      a keyword scan over the user prompt + page route picks a candidate.
//   3. Haiku LLM fallback — Phase 2e SCAFFOLD; not wired yet. The router
//      surface accepts an injectable async resolver so the LLM path can
//      land in a follow-up PR without touching the router contract.
//   4. unknown_fallback — return the 'unknown' specialist + reason.
//
// Phase 2e ships strategies 1, 2, and 4. Strategy 3 is an injectable
// resolver typed `RouterLlmResolver` whose default implementation is
// the unknown fallback (no LLM call).

import type { PersonaSlug, InvocationIntent, EntityType } from './types/context'
import type { SpecialistName } from './specialists/types'

export interface RouterInput {
  persona: PersonaSlug
  invocation_intent: InvocationIntent
  entity_type: EntityType | null
  /** Free-text user prompt (the thing the user typed or the page intent). */
  user_text?: string
  /** Page route — used as a keyword source when entity_type is null. */
  current_page?: string
}

export type SpecialistOrUnknown = SpecialistName | 'unknown'

export interface RouteDecision {
  specialist: SpecialistOrUnknown
  confidence: number // 0..1
  strategy: 'deterministic' | 'keyword' | 'llm_fallback' | 'unknown'
  reason: string
}

// (intent, entity_type) → specialist. Phase 2e covers the high-confidence
// pairs; ambiguous ones fall through to the keyword classifier.
const DETERMINISTIC_MAP: Record<string, { specialist: SpecialistName; confidence: number }> = {
  // Drafter — the generative scope.
  'draft_email|rfi': { specialist: 'drafter', confidence: 0.95 },
  'draft_email|submittal': { specialist: 'drafter', confidence: 0.95 },
  'draft_email|change_order': { specialist: 'drafter', confidence: 0.9 },
  'draft_email|punch_item': { specialist: 'drafter', confidence: 0.9 },
  'draft_owner_update|null': { specialist: 'drafter', confidence: 0.9 },
  'draft_lien_waiver|null': { specialist: 'drafter', confidence: 0.9 },
  'draft_daily_log|daily_log': { specialist: 'drafter', confidence: 0.95 },
  // Schedule
  'recommend_action|schedule_activity': { specialist: 'schedule', confidence: 0.95 },
  // Money (CO pricing flow)
  'verify_math|change_order': { specialist: 'money', confidence: 0.95 },
  // Code — typically signaled by classify/summarize on a spec/RFI lookup.
  'classify|null': { specialist: 'code', confidence: 0.7 },
  'summarize|null': { specialist: 'code', confidence: 0.6 },
}

interface KeywordHit {
  specialist: SpecialistName
  match: string
}

const KEYWORD_RULES: ReadonlyArray<{ specialist: SpecialistName; patterns: readonly RegExp[] }> = [
  {
    specialist: 'money',
    patterns: [
      /\b(co\s*pricing|change\s*order|pay\s*app|lien\s*waiver|reconcile|dollars?|cents|invoice)\b/i,
      /\$\s*\d/,
    ],
  },
  {
    specialist: 'schedule',
    patterns: [
      /\b(cpm|critical\s*path|lookahead|float|early\s*start|delay|reschedul|pour|tilt|top\s*out)\b/i,
    ],
  },
  {
    specialist: 'code',
    patterns: [
      /\b(ibc|nec|ashrae|code\s*section|egress|fire\s*rating|gfci|stairway|firestop)\b/i,
      /\b\d{3,4}\.\d+\b/, // section-number-shaped tokens
    ],
  },
  {
    specialist: 'drafter',
    patterns: [
      /\b(draft|email|follow[-\s]?up|response|reply|owner\s*update|safety\s*brief)\b/i,
    ],
  },
]

function tryKeywordClassifier(input: RouterInput): KeywordHit | null {
  const haystack = `${input.user_text ?? ''} ${input.current_page ?? ''}`.trim()
  if (!haystack) return null
  for (const rule of KEYWORD_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(haystack)) {
        return { specialist: rule.specialist, match: pat.source }
      }
    }
  }
  return null
}

export type RouterLlmResolver = (input: RouterInput) => Promise<RouteDecision>

const DEFAULT_LLM_RESOLVER: RouterLlmResolver = async (_input) =>
  Promise.resolve({
    specialist: 'unknown',
    confidence: 0,
    strategy: 'unknown',
    reason: 'llm_fallback not configured; deterministic + keyword both missed',
  })

export interface RouteOptions {
  /** Optional Haiku-backed fallback resolver. Defaults to unknown_fallback. */
  llmResolver?: RouterLlmResolver
}

export async function routeInvocation(
  input: RouterInput,
  opts: RouteOptions = {},
): Promise<RouteDecision> {
  // 1. Deterministic map.
  const detKey = `${input.invocation_intent}|${input.entity_type ?? 'null'}`
  const det = DETERMINISTIC_MAP[detKey]
  if (det) {
    return {
      specialist: det.specialist,
      confidence: det.confidence,
      strategy: 'deterministic',
      reason: `(intent, entity_type) = ('${input.invocation_intent}', ${input.entity_type ?? 'null'}) maps to ${det.specialist}`,
    }
  }

  // 2. Keyword classifier.
  const kw = tryKeywordClassifier(input)
  if (kw) {
    return {
      specialist: kw.specialist,
      confidence: 0.6, // keyword hits are softer than deterministic
      strategy: 'keyword',
      reason: `keyword pattern /${kw.match}/ matched on user_text + current_page`,
    }
  }

  // 3. LLM fallback (Phase 2e default = unknown_fallback).
  const llm = opts.llmResolver ?? DEFAULT_LLM_RESOLVER
  return await llm(input)
}

// Synchronous variant used by tests and the Phase 2e router accuracy harness.
// Skips the LLM fallback — returns 'unknown' when both deterministic + keyword
// miss.
export function routeInvocationSync(input: RouterInput): RouteDecision {
  const detKey = `${input.invocation_intent}|${input.entity_type ?? 'null'}`
  const det = DETERMINISTIC_MAP[detKey]
  if (det) {
    return {
      specialist: det.specialist,
      confidence: det.confidence,
      strategy: 'deterministic',
      reason: `(intent, entity_type) = ('${input.invocation_intent}', ${input.entity_type ?? 'null'}) maps to ${det.specialist}`,
    }
  }
  const kw = tryKeywordClassifier(input)
  if (kw) {
    return {
      specialist: kw.specialist,
      confidence: 0.6,
      strategy: 'keyword',
      reason: `keyword pattern /${kw.match}/ matched`,
    }
  }
  return {
    specialist: 'unknown',
    confidence: 0,
    strategy: 'unknown',
    reason: 'no deterministic match; no keyword hit',
  }
}
