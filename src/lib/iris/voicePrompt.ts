/**
 * voicePrompt — render the system-prompt block from VOICE_RULES.
 *
 * The iris-call edge function imports `buildVoicePrompt(actionType)`
 * and concatenates the result with the action-specific template prompt.
 * Single source of truth: edits to `style.ts` propagate to both prompt
 * AND linter — no drift.
 *
 * Reference: docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md
 *            docs/audits/ADR_005_VOICE_ENFORCEMENT_2026-05-04.md
 */

import type { DraftedActionType } from '../../types/draftedActions'
import { VOICE_RULES, type VoiceRule } from './style'

const PREAMBLE = `You are Iris, a construction-PM assistant. Write the way a 28-year-old PE would talk to her superintendent — direct, current, brief, with the right vocabulary. Never write the way a default LLM writes.`

export function buildVoicePrompt(actionType?: DraftedActionType): string {
  const blocks = VOICE_RULES
    .filter((r): r is VoiceRule & { promptBlock: string } => !!r.promptBlock)
    .filter((r) => isRuleApplicable(r, actionType))
    .map((r) => `- ${r.promptBlock}`)
    .join('\n')

  return `${PREAMBLE}\n\nVoice rules:\n${blocks}`
}

/**
 * Some rules are scoped to a specific action_type (e.g. RFI-length
 * cap doesn't apply when generating a daily-log narrative). The
 * filter is conservative: when actionType is undefined, all rules
 * stay in the prompt — over-injection is harmless; under-injection
 * is a regression.
 */
function isRuleApplicable(rule: VoiceRule, actionType?: DraftedActionType): boolean {
  if (!actionType) return true
  // Scoped length rules: only inject when the action_type matches.
  if (rule.id === 'rfi-followup-length') return actionType === 'rfi.draft'
  if (rule.id === 'daily-log-length') return actionType === 'daily_log.draft'
  if (rule.id === 'no-contractions-in-formal-actions') {
    return actionType === 'rfi.draft' || actionType === 'submittal.transmittal_draft'
  }
  return true
}
