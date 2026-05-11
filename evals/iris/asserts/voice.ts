/**
 * evals/iris/asserts/voice.ts
 *
 * Voice assertion for the Iris eval pipeline. Re-uses the canonical
 * `lintVoice()` from `src/lib/iris/voiceLinter.ts` so the eval grades
 * against the same rules production uses — no shadow rule drift.
 *
 * Result semantics:
 *   - Empty `expected.voiceRuleIds` (strict mode): every lintable rule
 *     must pass. Used for hand-edit corpus rows (the PM-corrected text
 *     should be clean).
 *   - Non-empty `expected.voiceRuleIds`: the listed rules must pass.
 *     Other failures are surfaced as `unexpected` warnings but don't
 *     fail the row. This lets synthetic rows target a specific rule
 *     without forcing every row to pass every rule.
 *
 * Reference: docs/audits/IRIS_EVAL_PIPELINE_SPEC_2026-05-08.md § Asserts
 */

import { lintVoice } from '../../../src/lib/iris/voiceLinter'
import type { EvalCorpusRow, IrisProviderOutput } from '../types'

export interface VoiceAssertResult {
  passed: boolean
  expectedRulesFailed: string[]
  unexpectedRulesFailed: string[]
  reason: string
}

export function assertVoice(
  row: EvalCorpusRow,
  out: IrisProviderOutput,
): VoiceAssertResult {
  const lint = lintVoice(out.output, {
    actionType: row.actionType,
    citations: out.citations,
  }, { autofix: false })

  const failedIds = lint.failedRules.map((f) => f.ruleId)
  const expected = new Set(row.expected.voiceRuleIds)
  const isStrict = expected.size === 0

  const expectedRulesFailed = isStrict
    ? failedIds
    : failedIds.filter((id) => expected.has(id))
  const unexpectedRulesFailed = isStrict
    ? []
    : failedIds.filter((id) => !expected.has(id))

  const passed = expectedRulesFailed.length === 0
  const reason = passed
    ? unexpectedRulesFailed.length > 0
      ? `passed (with ${unexpectedRulesFailed.length} unexpected: ${unexpectedRulesFailed.join(', ')})`
      : 'passed'
    : `voice rules failed: ${expectedRulesFailed.join(', ')}`

  return { passed, expectedRulesFailed, unexpectedRulesFailed, reason }
}
