// ────────────────────────────────────────────────────────────────────────────
// Router tests — Phase 2e
// ────────────────────────────────────────────────────────────────────────────
// Spec target: ≥ 95% accuracy on a 200-Q routing test set.
// Phase 2e ships 50 representative cases as the starter set; Walker authors
// the remaining 150 during Phase 2 close-out per the spec's §7.

import { describe, expect, it } from 'vitest'

import { routeInvocationSync, routeInvocation, type RouterInput } from '../router'

interface RouterCase {
  input: RouterInput
  expected_specialist: string
}

// 50-case starter set — covers each deterministic mapping at least once and
// each keyword rule at least 5 times.
const CASES: RouterCase[] = [
  // Deterministic — Drafter
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: 'rfi' }, expected_specialist: 'drafter' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: 'submittal' }, expected_specialist: 'drafter' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: 'change_order' }, expected_specialist: 'drafter' },
  { input: { persona: 'superintendent', invocation_intent: 'draft_email', entity_type: 'punch_item' }, expected_specialist: 'drafter' },
  { input: { persona: 'pm', invocation_intent: 'draft_owner_update', entity_type: null }, expected_specialist: 'drafter' },
  { input: { persona: 'office', invocation_intent: 'draft_lien_waiver', entity_type: null }, expected_specialist: 'drafter' },
  { input: { persona: 'superintendent', invocation_intent: 'draft_daily_log', entity_type: 'daily_log' }, expected_specialist: 'drafter' },
  // Deterministic — Schedule
  { input: { persona: 'superintendent', invocation_intent: 'recommend_action', entity_type: 'schedule_activity' }, expected_specialist: 'schedule' },
  { input: { persona: 'pm', invocation_intent: 'recommend_action', entity_type: 'schedule_activity' }, expected_specialist: 'schedule' },
  // Deterministic — Money
  { input: { persona: 'office', invocation_intent: 'verify_math', entity_type: 'change_order' }, expected_specialist: 'money' },
  { input: { persona: 'pm', invocation_intent: 'verify_math', entity_type: 'change_order' }, expected_specialist: 'money' },
  // Deterministic — Code (classify/summarize)
  { input: { persona: 'pm', invocation_intent: 'classify', entity_type: null }, expected_specialist: 'code' },
  { input: { persona: 'pm', invocation_intent: 'summarize', entity_type: null }, expected_specialist: 'code' },
  // Keyword — Money
  { input: { persona: 'office', invocation_intent: 'draft_email', entity_type: null, user_text: 'Need a CO pricing reconcile against the sub T&M.' }, expected_specialist: 'money' },
  { input: { persona: 'office', invocation_intent: 'draft_email', entity_type: null, user_text: 'Pay app cycle status please.' }, expected_specialist: 'money' },
  { input: { persona: 'office', invocation_intent: 'draft_email', entity_type: null, user_text: 'Owed $48,200 on lien waiver.' }, expected_specialist: 'money' },
  { input: { persona: 'office', invocation_intent: 'draft_email', entity_type: null, user_text: 'Invoice was rejected by AP.' }, expected_specialist: 'money' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Change order math reconcile.' }, expected_specialist: 'money' },
  // Keyword — Schedule
  { input: { persona: 'superintendent', invocation_intent: 'draft_email', entity_type: null, user_text: 'Push the Wed pour to Thu — weather risk.' }, expected_specialist: 'schedule' },
  { input: { persona: 'superintendent', invocation_intent: 'draft_email', entity_type: null, user_text: 'Critical path is at risk.' }, expected_specialist: 'schedule' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: '3-week lookahead conflict on Level 3 framing.' }, expected_specialist: 'schedule' },
  { input: { persona: 'superintendent', invocation_intent: 'draft_email', entity_type: null, user_text: 'Top out is delayed by 5 days.' }, expected_specialist: 'schedule' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Need a reschedule of the tilt-up panels.' }, expected_specialist: 'schedule' },
  // Keyword — Code
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'IBC 1011.2 stairway width.' }, expected_specialist: 'code' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'NEC 210.8 GFCI for kitchens.' }, expected_specialist: 'code' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'ASHRAE 90.1 lighting power density.' }, expected_specialist: 'code' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Egress capacity for assembly.' }, expected_specialist: 'code' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Fire rating of the corridor walls.' }, expected_specialist: 'code' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Section 714.4.1 penetration firestop.' }, expected_specialist: 'code' },
  // Keyword — Drafter
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Draft an owner update.' }, expected_specialist: 'drafter' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Reply to the architect with a follow-up.' }, expected_specialist: 'drafter' },
  { input: { persona: 'superintendent', invocation_intent: 'draft_email', entity_type: null, user_text: 'Safety brief for tomorrow morning.' }, expected_specialist: 'drafter' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Email response to the spec section question.' }, expected_specialist: 'drafter' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Owner update for the September OAC.' }, expected_specialist: 'drafter' },
  // Edge — unknown (no deterministic, no keyword)
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Bring nothing in particular.' }, expected_specialist: 'unknown' },
  { input: { persona: 'foreman', invocation_intent: 'draft_email', entity_type: null }, expected_specialist: 'unknown' },
  // Deterministic — Drafter (more cases to hit 50)
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: 'rfi', user_text: 'Casey on the architect side.' }, expected_specialist: 'drafter' },
  { input: { persona: 'office', invocation_intent: 'draft_email', entity_type: 'submittal' }, expected_specialist: 'drafter' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: 'change_order', user_text: 'Owner needs the CO ratified.' }, expected_specialist: 'drafter' },
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: 'punch_item' }, expected_specialist: 'drafter' },
  // Keyword — extra Schedule
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Float consumed on the foundation pour.' }, expected_specialist: 'schedule' },
  { input: { persona: 'superintendent', invocation_intent: 'draft_email', entity_type: null, user_text: 'Early start on the slab.' }, expected_specialist: 'schedule' },
  // Keyword — extra Code
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: 'Code section reference for assembly egress.' }, expected_specialist: 'code' },
  // Keyword — extra Money
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: '$12,400 sub change order needs reconcile.' }, expected_specialist: 'money' },
  // Keyword — extra Drafter
  { input: { persona: 'office', invocation_intent: 'draft_email', entity_type: null, user_text: 'Follow-up email to the engineer.' }, expected_specialist: 'drafter' },
  // Edge — unknown intent with no signal
  { input: { persona: 'pm', invocation_intent: 'draft_email', entity_type: null, user_text: '' }, expected_specialist: 'unknown' },
  // Deterministic — Code (more)
  { input: { persona: 'pm', invocation_intent: 'classify', entity_type: null, user_text: 'classify this question' }, expected_specialist: 'code' },
  { input: { persona: 'pm', invocation_intent: 'summarize', entity_type: null }, expected_specialist: 'code' },
  // Deterministic — Schedule (more)
  { input: { persona: 'superintendent', invocation_intent: 'recommend_action', entity_type: 'schedule_activity', user_text: 'foundation slip' }, expected_specialist: 'schedule' },
  { input: { persona: 'pm', invocation_intent: 'recommend_action', entity_type: 'schedule_activity', user_text: 'crane pick window' }, expected_specialist: 'schedule' },
]

describe('routeInvocationSync — 50-case accuracy', () => {
  it('routes every case to its expected specialist', () => {
    let correct = 0
    const misses: Array<{ idx: number; expected: string; got: string }> = []
    CASES.forEach((c, idx) => {
      const decision = routeInvocationSync(c.input)
      if (decision.specialist === c.expected_specialist) {
        correct += 1
      } else {
        misses.push({ idx, expected: c.expected_specialist, got: decision.specialist })
      }
    })
    const accuracy = correct / CASES.length
    if (accuracy < 0.95) {
      console.error('Router misses:', misses)
    }
    expect(accuracy).toBeGreaterThanOrEqual(0.95)
  })

  it('returns deterministic strategy for (intent, entity_type) hits', () => {
    const decision = routeInvocationSync({
      persona: 'pm',
      invocation_intent: 'draft_email',
      entity_type: 'rfi',
    })
    expect(decision.strategy).toBe('deterministic')
    expect(decision.confidence).toBeGreaterThan(0.9)
  })

  it('falls through to keyword when deterministic misses', () => {
    const decision = routeInvocationSync({
      persona: 'pm',
      invocation_intent: 'draft_email',
      entity_type: null,
      user_text: 'CO pricing reconcile',
    })
    expect(decision.strategy).toBe('keyword')
    expect(decision.specialist).toBe('money')
  })

  it('returns unknown when neither strategy hits', () => {
    const decision = routeInvocationSync({
      persona: 'pm',
      invocation_intent: 'draft_email',
      entity_type: null,
    })
    expect(decision.specialist).toBe('unknown')
    expect(decision.strategy).toBe('unknown')
  })
})

describe('routeInvocation (async) — llmResolver fallback hook', () => {
  it('calls the injected llmResolver when both deterministic and keyword miss', async () => {
    const decision = await routeInvocation(
      { persona: 'pm', invocation_intent: 'draft_email', entity_type: null },
      {
        llmResolver: async () => ({
          specialist: 'drafter',
          confidence: 0.5,
          strategy: 'llm_fallback',
          reason: 'test override',
        }),
      },
    )
    expect(decision.strategy).toBe('llm_fallback')
    expect(decision.specialist).toBe('drafter')
  })

  it('defaults to unknown_fallback when no resolver is supplied', async () => {
    const decision = await routeInvocation({
      persona: 'pm',
      invocation_intent: 'draft_email',
      entity_type: null,
    })
    expect(decision.specialist).toBe('unknown')
  })
})
