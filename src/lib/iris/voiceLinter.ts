/**
 * voiceLinter — post-process every iris-call output through the rule
 * registry in `style.ts`. Returns the (possibly auto-fixed) text + a
 * list of failed rule ids for telemetry.
 *
 * The linter runs to fixed-point: if a rule's autofix produces text
 * that fails another rule, we run again. Capped at 5 passes so a
 * pathological pair of rules can't infinite-loop.
 *
 * Reference: docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md § Phase 4
 */

import {
  getLintableRules,
  type VoiceLintContext,
  type VoiceLintResult,
  type VoiceRule,
} from './style'

const MAX_PASSES = 5

export interface LinterFailure {
  ruleId: string
  message: string
}

export interface LinterResult {
  /** True when no rule fired (or autofix resolved every fired rule). */
  passed: boolean
  /** The final text — original when passed, autofixed otherwise. */
  text: string
  /**
   * Rules that fired during the run, in order. A rule that fires +
   * autofixes still appears here so telemetry can attribute the fix.
   */
  failedRules: LinterFailure[]
  /** Number of passes the run took (1 if no fix needed; capped at 5). */
  passes: number
}

export interface LintOptions {
  /** When false, the linter only reports — never modifies the text. */
  autofix?: boolean
}

export function lintVoice(
  text: string,
  context: VoiceLintContext,
  opts: LintOptions = {},
): LinterResult {
  const autofix = opts.autofix ?? true
  const lintable = getLintableRules()

  let working = text
  const failures: LinterFailure[] = []
  let pass = 0
  let didFix = true

  while (didFix && pass < MAX_PASSES) {
    pass++
    didFix = false
    for (const rule of lintable) {
      const result = rule.lintCheck!(working, context) as VoiceLintResult
      if (result.passed) continue

      // Record once per (rule, pass) — duplicates across passes are
      // suppressed so telemetry doesn't double-count an autofix that
      // partially resolved a rule.
      if (!failures.some((f) => f.ruleId === rule.id)) {
        failures.push({ ruleId: rule.id, message: result.message ?? '' })
      }

      if (autofix && result.suggestedReplacement !== undefined && result.suggestedReplacement !== working) {
        working = result.suggestedReplacement
        didFix = true
      }
    }
  }

  // Final-pass verification: did autofix actually resolve everything?
  // If not, `passed` reflects current state, not initial state.
  const finalFailed = lintable
    .map((r): { rule: VoiceRule; result: VoiceLintResult } => ({
      rule: r,
      result: r.lintCheck!(working, context) as VoiceLintResult,
    }))
    .filter(({ result }) => !result.passed)

  return {
    passed: finalFailed.length === 0,
    text: working,
    failedRules: failures,
    passes: pass,
  }
}

/**
 * Reduce a LinterResult to the array shape used by the iris_voice_diffs
 * `failed_rule_ids` column.
 */
export function failedRuleIds(result: LinterResult): string[] {
  return result.failedRules.map((f) => f.ruleId)
}
