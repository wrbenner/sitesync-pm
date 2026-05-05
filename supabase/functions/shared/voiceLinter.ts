// supabase/functions/shared/voiceLinter.ts
//
// Deno-side mirror of `src/lib/iris/voiceLinter.ts` + the rule registry
// from `src/lib/iris/style.ts`. Edge functions can't import from src/,
// so this file is the canonical edge-function copy.
//
// IMPORTANT — KEEPING IN SYNC:
//   The two files are intentional duplicates. When you change a rule
//   here, change it in src/lib/iris/style.ts. The unit tests cover the
//   src/-side; this file is unit-tested via the iris-call integration
//   smoke. The drift-detection telemetry is `iris_voice_diffs.failed_rule_ids`
//   — if a rule fires here and not there (or vice versa) the dashboard
//   will surface the asymmetry.
//
// REFERENCES:
//   docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md
//   docs/audits/ADR_005_VOICE_ENFORCEMENT_2026-05-04.md
//   src/lib/iris/style.ts — canonical rule definitions
//   src/lib/iris/voiceLinter.ts — canonical linter
//
// SCOPE:
//   This module exposes only what iris-call needs: lintVoice() + the
//   array shape for iris_voice_diffs.failed_rule_ids. The src/-side
//   exports more (per-rule queries, registry helpers); we don't need
//   them here.

/** Subset of DraftedActionType used by the linter — keep in sync with src/types/draftedActions.ts */
export type DraftedActionTypeLite =
  | 'rfi.draft'
  | 'daily_log.draft'
  | 'pay_app.draft'
  | 'punch_item.draft'
  | 'schedule.resequence'
  | 'submittal.transmittal_draft'

export interface VoiceLintContext {
  actionType?: DraftedActionTypeLite
}

interface VoiceLintResult {
  passed: boolean
  message?: string
  suggestedReplacement?: string
}

interface VoiceRule {
  id: string
  category: 'banned_phrase' | 'required_structure' | 'register' | 'length' | 'vernacular'
  lintCheck: (text: string, context: VoiceLintContext) => VoiceLintResult
}

// ── Rule definitions (mirrors src/lib/iris/style.ts) ────────────────

const noCertainly: VoiceRule = {
  id: 'no-certainly',
  category: 'banned_phrase',
  lintCheck: (text) => {
    if (!/\bcertainly\b/i.test(text)) return { passed: true }
    return {
      passed: false,
      message: '"certainly" is banned',
      suggestedReplacement: text
        .replace(/\s*\bcertainly\s*,?\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }
  },
}

const noEmDash: VoiceRule = {
  id: 'no-em-dash',
  category: 'banned_phrase',
  lintCheck: (text) => {
    if (!/[—–]/.test(text)) return { passed: true }
    return {
      passed: false,
      message: 'em-dash or en-dash present',
      suggestedReplacement: text.replace(/—/g, '. ').replace(/–/g, '-'),
    }
  },
}

const noPolitenessCoda: VoiceRule = {
  id: 'no-i-hope-this-helps',
  category: 'banned_phrase',
  lintCheck: (text) => {
    const banned =
      /\b(I hope this (helps|is helpful)|let me know if (you have|there are) (any |further )?(questions|concerns)|happy to (help|assist)|please (don'?t )?hesitate)\b[^.!?]*[.!?]?/gi
    if (!banned.test(text)) return { passed: true }
    return {
      passed: false,
      message: 'LLM politeness coda present',
      suggestedReplacement: text.replace(banned, '').replace(/\s{2,}/g, ' ').trim(),
    }
  },
}

const noGreatQuestion: VoiceRule = {
  id: 'no-great-question',
  category: 'banned_phrase',
  lintCheck: (text) => {
    const lead = /^\s*(great question[!.]?|absolutely[!.]?|of course[!.]?|that'?s a (great|good) question[!.]?)\s*/i
    if (!lead.test(text)) return { passed: true }
    return {
      passed: false,
      message: 'LLM affirmation lead detected',
      suggestedReplacement: text.replace(lead, ''),
    }
  },
}

const rfiFollowupLength: VoiceRule = {
  id: 'rfi-followup-length',
  category: 'length',
  lintCheck: (text, ctx) => {
    if (ctx.actionType !== 'rfi.draft') return { passed: true }
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
    if (words <= 60) return { passed: true }
    return { passed: false, message: `RFI follow-up is ${words} words; cap is 60` }
  },
}

const dailyLogLength: VoiceRule = {
  id: 'daily-log-length',
  category: 'length',
  lintCheck: (text, ctx) => {
    if (ctx.actionType !== 'daily_log.draft') return { passed: true }
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
    if (words <= 200) return { passed: true }
    return { passed: false, message: `Daily log narrative is ${words} words; cap is 200` }
  },
}

const noContractions: VoiceRule = {
  id: 'no-contractions-in-formal-actions',
  category: 'register',
  lintCheck: (text, ctx) => {
    if (ctx.actionType !== 'rfi.draft' && ctx.actionType !== 'submittal.transmittal_draft') {
      return { passed: true }
    }
    const contraction = /\b(\w+)['']\b(t|s|re|ve|ll|d)\b/i
    if (!contraction.test(text)) return { passed: true }
    return { passed: false, message: 'contraction in formal context' }
  },
}

const noFiller: VoiceRule = {
  id: 'no-filler-words',
  category: 'register',
  lintCheck: (text) => {
    const filler = /\b(just|actually|basically)\b/gi
    const matches = text.match(filler) ?? []
    if (matches.length < 2) return { passed: true }
    return {
      passed: false,
      message: `${matches.length} filler word${matches.length === 1 ? '' : 's'} (just / actually / basically)`,
    }
  },
}

const RULES: VoiceRule[] = [
  noCertainly,
  noEmDash,
  noPolitenessCoda,
  noGreatQuestion,
  rfiFollowupLength,
  dailyLogLength,
  noContractions,
  noFiller,
]

const MAX_PASSES = 5

export interface LinterResult {
  passed: boolean
  text: string
  failedRules: Array<{ ruleId: string; message: string }>
  passes: number
}

export function lintVoice(
  text: string,
  context: VoiceLintContext = {},
  opts: { autofix?: boolean } = {},
): LinterResult {
  const autofix = opts.autofix ?? true
  let working = text
  const failures: Array<{ ruleId: string; message: string }> = []
  let pass = 0
  let didFix = true

  while (didFix && pass < MAX_PASSES) {
    pass++
    didFix = false
    for (const rule of RULES) {
      const result = rule.lintCheck(working, context)
      if (result.passed) continue
      if (!failures.some((f) => f.ruleId === rule.id)) {
        failures.push({ ruleId: rule.id, message: result.message ?? '' })
      }
      if (autofix && result.suggestedReplacement !== undefined && result.suggestedReplacement !== working) {
        working = result.suggestedReplacement
        didFix = true
      }
    }
  }

  // Final-pass verification — did autofix actually resolve everything?
  const finalFailed = RULES.map((r) => r.lintCheck(working, context)).filter((r) => !r.passed)

  return {
    passed: finalFailed.length === 0,
    text: working,
    failedRules: failures,
    passes: pass,
  }
}

export function failedRuleIds(result: LinterResult): string[] {
  return result.failedRules.map((f) => f.ruleId)
}
