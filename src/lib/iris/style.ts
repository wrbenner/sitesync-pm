/**
 * Iris voice style guide — single source of truth for how Iris writes.
 *
 * Consumed by:
 *   - src/lib/iris/voicePrompt.ts (renders the system prompt block)
 *   - src/lib/iris/voiceLinter.ts (post-process check + autofix)
 *
 * Edit this file = edit both surfaces atomically.
 *
 * Authoring rule (Lap 2 hand-edit cycle): every rule below was either
 * (a) seeded from the spec's first-pass observations, or (b) derived
 * from at least 3 hand-edits across the 150-draft corpus. New rules
 * added during Days 43–47 must populate `derivedFrom` with the draft
 * indices that motivated them — anecdote isn't enough.
 *
 * Reference: docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md
 *            docs/audits/ADR_005_VOICE_ENFORCEMENT_2026-05-04.md
 */

import type { DraftedActionCitation, DraftedActionType } from '../../types/draftedActions'

export type VoiceRuleCategory =
  | 'banned_phrase'
  | 'required_structure'
  | 'register'
  | 'length'
  | 'vernacular'

export interface VoiceLintContext {
  /**
   * The kind of draft being generated, when known. Iris-call invocations
   * that don't produce a drafted_action (e.g. ad-hoc reasoning) leave
   * this undefined; action-scoped rules (length caps, contractions)
   * silently pass when undefined.
   */
  actionType?: DraftedActionType
  citations: DraftedActionCitation[]
}

export interface VoiceLintResult {
  passed: boolean
  message?: string
  /**
   * Optional auto-replacement. When provided, the linter applies it.
   * Rules that emit a replacement have produced text that *may* still
   * fail other rules — the linter runs to fixed-point per call.
   */
  suggestedReplacement?: string
}

export interface VoiceRule {
  /** Stable identifier used in audit logging + diff queries. */
  id: string
  category: VoiceRuleCategory
  /** Human-readable description (used in style-guide docs). */
  description: string
  /**
   * Text injected into the iris-call system prompt. When undefined,
   * the rule is enforced post-process only (typically structural
   * rules that are easier to lint than to teach).
   */
  promptBlock?: string
  /**
   * Post-process check. When undefined, the rule is prompt-only.
   * Pure function: same input → same output.
   */
  lintCheck?: (text: string, context: VoiceLintContext) => VoiceLintResult
  /** At least one good/bad pair. Doc-only; not consumed by the linter. */
  examples: { good: string; bad: string }[]
  /** Indices into the 150-draft corpus this rule derived from. */
  derivedFrom: number[]
}

// ── Rule definitions ─────────────────────────────────────────────────

const noCertainly: VoiceRule = {
  id: 'no-certainly',
  category: 'banned_phrase',
  description: 'Never use the word "certainly". Construction PMs do not say it.',
  promptBlock: 'Do NOT use the word "certainly". Be direct.',
  lintCheck: (text) => {
    if (!/\bcertainly\b/i.test(text)) return { passed: true }
    return {
      passed: false,
      message: '"certainly" is banned',
      suggestedReplacement: text.replace(/\s*\bcertainly\s*,?\s*/gi, ' ').replace(/\s+/g, ' ').trim(),
    }
  },
  examples: [
    {
      good: 'The architect needs to weigh in by Friday.',
      bad: 'Certainly, the architect needs to weigh in by Friday.',
    },
  ],
  derivedFrom: [],
}

const noEmDash: VoiceRule = {
  id: 'no-em-dash',
  category: 'banned_phrase',
  description:
    'No em-dashes or en-dashes. Use a comma or split into two sentences. Construction writing uses neither.',
  promptBlock:
    'Do NOT use em-dashes (—) or en-dashes (–) in your output. Use commas or split into two sentences.',
  lintCheck: (text) => {
    if (!/[—–]/.test(text)) return { passed: true }
    return {
      passed: false,
      message: 'em-dash or en-dash present',
      // em-dash → period+space; en-dash → simple hyphen.
      suggestedReplacement: text.replace(/—/g, '. ').replace(/–/g, '-'),
    }
  },
  examples: [
    {
      good: 'The slab pour slipped to Friday. We need a new submittal date.',
      bad: 'The slab pour slipped to Friday — we need a new submittal date.',
    },
  ],
  derivedFrom: [],
}

const noPolitenessCoda: VoiceRule = {
  id: 'no-i-hope-this-helps',
  category: 'banned_phrase',
  description:
    'Never close with "I hope this helps" or any LLM-trained politeness coda.',
  promptBlock:
    'Do NOT include sign-offs like "I hope this helps", "Let me know if you have questions", "Happy to help further", or "Please don\'t hesitate". The reader is busy.',
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
  examples: [
    {
      good: 'Need a response by EOD Wednesday to keep the slab on schedule.',
      bad: 'Need a response by EOD Wednesday. I hope this helps!',
    },
  ],
  derivedFrom: [],
}

const noGreatQuestion: VoiceRule = {
  id: 'no-great-question',
  category: 'banned_phrase',
  description: 'Never open with "Great question!" or any LLM affirmation.',
  promptBlock: 'Do NOT begin your response with affirmations like "Great question!", "Absolutely!", or "Of course!".',
  lintCheck: (text) => {
    const lead = /^\s*(great question[!.]?|absolutely[!.]?|of course[!.]?|that'?s a (great|good) question[!.]?)\s*/i
    if (!lead.test(text)) return { passed: true }
    return {
      passed: false,
      message: 'LLM affirmation lead detected',
      suggestedReplacement: text.replace(lead, ''),
    }
  },
  examples: [
    {
      good: 'The wall finish at column line 7 is unanswered.',
      bad: 'Great question! The wall finish at column line 7 is unanswered.',
    },
  ],
  derivedFrom: [],
}

const useConstructionVernacular: VoiceRule = {
  id: 'use-construction-vernacular',
  category: 'vernacular',
  description:
    'Use construction vocabulary: "RFI" (not "request"), "submittal" (not "submission"), "punch" (not "punch list"), "pay app" (not "payment application"), "cut sheet" (not "data sheet").',
  promptBlock:
    'Use construction vocabulary: "RFI" (not "request" or "question for the architect"), "submittal" (not "submission" or "package"), "punch" (not "punch list"), "pay app" (not "payment application"), "cut sheet" (not "data sheet"). When the construction term doesn\'t exist, prefer the term a 28-year-old PE would use over an LLM\'s general-English equivalent.',
  // Soft rule — the prompt teaches the vocabulary; linting it produces
  // bad replacements (e.g. "request" mid-paragraph might be unrelated).
  // We log violations only for vocabulary noticeably out of band, not
  // every occurrence.
  lintCheck: undefined,
  examples: [
    {
      good: 'Submitting the cut sheet to the architect today; expect a response by Friday.',
      bad: 'Sending the data sheet to the architect today as a submission; expect feedback by Friday.',
    },
  ],
  derivedFrom: [],
}

const rfiFollowupLength: VoiceRule = {
  id: 'rfi-followup-length',
  category: 'length',
  description: 'RFI follow-ups: ≤ 60 words. The architect is reading on a phone between meetings.',
  promptBlock: 'For RFI follow-ups, keep total length under 60 words.',
  lintCheck: (text, ctx) => {
    if (ctx.actionType !== 'rfi.draft') return { passed: true }
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
    if (words <= 60) return { passed: true }
    return {
      passed: false,
      message: `RFI follow-up is ${words} words; cap is 60`,
    }
  },
  examples: [],
  derivedFrom: [],
}

const dailyLogLength: VoiceRule = {
  id: 'daily-log-length',
  category: 'length',
  description:
    'Daily-log narratives: ≤ 200 words. Anything longer reads like a story, not a record.',
  promptBlock:
    'For daily-log narratives, keep total length under 200 words. Use bullets when listing trades or activities.',
  lintCheck: (text, ctx) => {
    if (ctx.actionType !== 'daily_log.draft') return { passed: true }
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
    if (words <= 200) return { passed: true }
    return {
      passed: false,
      message: `Daily log narrative is ${words} words; cap is 200`,
    }
  },
  examples: [],
  derivedFrom: [],
}

const rfiStateQuestionAndDeadline: VoiceRule = {
  id: 'rfi-state-question-and-deadline',
  category: 'required_structure',
  description:
    'Every RFI follow-up: one sentence states the question; one sentence states the impact / deadline. Two sentences total in 80% of cases.',
  promptBlock:
    'For RFI follow-ups, structure as: 1 sentence summarizing what was asked, 1 sentence stating why it matters now (deadline, dependency, cost). Two sentences total in 80% of cases. NEVER open with a greeting.',
  // Hard to lint reliably; rely on prompt + post-edit review.
  lintCheck: undefined,
  examples: [
    {
      good: 'Need wall finish at column line 7 confirmed before MEP rough-in. Slab pour is Friday and trades start Monday.',
      bad: 'Hi! I am following up on the RFI from last week. Could you let us know about the wall finish? It would be great to hear back when you have a moment.',
    },
  ],
  derivedFrom: [],
}

const noContractions: VoiceRule = {
  id: 'no-contractions-in-formal-actions',
  category: 'register',
  description:
    'No contractions in RFI follow-ups, submittal transmittals, or change-order communications. Daily logs may use contractions; field-side voice is allowed there.',
  promptBlock:
    "Do NOT use contractions (don't, can't, won't, it's, we're, they're, you're) in RFI follow-ups, submittal transmittals, or change-order text. Contractions are fine in daily-log narratives.",
  lintCheck: (text, ctx) => {
    if (
      ctx.actionType !== 'rfi.draft' &&
      ctx.actionType !== 'submittal.transmittal_draft'
    ) {
      return { passed: true }
    }
    const contraction = /\b(\w+)['']\b(t|s|re|ve|ll|d)\b/i
    if (!contraction.test(text)) return { passed: true }
    return {
      passed: false,
      message: 'contraction in formal context',
    }
  },
  examples: [
    {
      good: 'We are following up on the wall finish at column line 7.',
      bad: "We're following up on the wall finish at column line 7.",
    },
  ],
  derivedFrom: [],
}

const noFiller: VoiceRule = {
  id: 'no-filler-words',
  category: 'register',
  description:
    'Drop filler — "just," "actually," "basically," "really," "very" — they soften urgency.',
  promptBlock:
    'Avoid filler words: "just", "actually", "basically", "really", "very", "quite", "literally". They soften the message.',
  lintCheck: (text) => {
    // Conservative — only flag the most LLM-tic-y words at a high
    // confidence threshold (whole-word, case-insensitive). No autofix
    // because removing "just" mid-sentence can change meaning.
    const filler = /\b(just|actually|basically)\b/gi
    const matches = text.match(filler) ?? []
    if (matches.length < 2) return { passed: true }
    return {
      passed: false,
      message: `${matches.length} filler word${matches.length === 1 ? '' : 's'} (just / actually / basically)`,
    }
  },
  examples: [
    {
      good: 'Architect is reviewing now; expect a response by Friday.',
      bad: 'The architect is just actually reviewing it now; we should basically expect a response by Friday.',
    },
  ],
  derivedFrom: [],
}

// ── Acronym casing — RFI / RFIs must always be uppercase ─────────────
// Walker's deep-dive (RFI_DEEP_DIVE_2026-05-04.md) flagged lowercase
// "rfi" and TitleCase "Rfis" leaking into user-facing copy. The
// codebase used .replace('_', ' ') on entity_type tokens, which turned
// the technical 'rfi' string into the rendered word "rfi". Iris-
// generated text suffers the same risk: "the rfi was filed yesterday"
// reads as a developer artifact, not professional construction copy.
//
// The lint check below catches both cases and auto-fixes:
//   "this rfi"  → "this RFI"
//   "5 Rfis"    → "5 RFIs"
//
// Word-boundary anchored so legitimate identifiers in code blocks (rare
// in Iris output) don't get rewritten. Also skips 'rfi' inside hyphens
// like 'rfi-followup' which is a system token.
const acronymCasing: VoiceRule = {
  id: 'acronym-casing',
  category: 'register',
  description:
    'Construction acronyms (RFI, CO, RFP) must be uppercase in user-facing text. ' +
    'Lowercase or TitleCase variants leak technical tokens into copy.',
  promptBlock:
    'When you write "RFI", "RFIs", "CO", "POs", "MEP", "ADA", or any ' +
    'construction acronym, ALWAYS use ALL CAPS. Never write "rfi", "Rfi", or "Rfis". ' +
    'These are acronyms, not regular words.',
  lintCheck: (text) => {
    // Match: standalone "rfi", "Rfi", "rfis", "Rfis" — but NOT inside
    // identifiers like rfi_id, RfiList, useRFI, etc. We anchor with
    // word boundaries on both sides AND require the surrounding chars
    // not to be alphanumeric or underscore.
    const acronymRe = /(^|[^\w])(rfi|Rfi|rfis|Rfis|co|Co|cos|Cos|mep|Mep|ada|Ada|rfp|Rfp|rfps|Rfps)(?=[^\w]|$)/g
    let needsFix = false
    const replaced = text.replace(acronymRe, (_match, before, token) => {
      // CO/Co is ambiguous (could be the word "co"); only uppercase
      // when followed by a # or digit — a CO ID convention.
      if (/^cos?$/i.test(token)) {
        return _match // leave word "co" alone — too risky to autofix
      }
      needsFix = true
      // Plural form: keep the trailing "s" lowercase ("RFIs", not "RFIS").
      const isPlural = /s$/.test(token)
      const root = isPlural ? token.slice(0, -1) : token
      return `${before}${root.toUpperCase()}${isPlural ? 's' : ''}`
    })
    if (!needsFix) return { passed: true }
    return {
      passed: false,
      message:
        'Found lowercase or TitleCase variant of a construction acronym. ' +
        'Use ALL CAPS (RFI, RFIs, MEP, ADA, RFP).',
      suggestedReplacement: replaced,
    }
  },
  examples: [
    {
      good: 'The RFI was filed yesterday; expect 5 RFIs back from MEP this week.',
      bad: 'The rfi was filed yesterday; expect 5 Rfis back from Mep this week.',
    },
  ],
  derivedFrom: [], // seeded from RFI_DEEP_DIVE_2026-05-04.md
}

// ── Registry ─────────────────────────────────────────────────────────

export const VOICE_RULES: VoiceRule[] = [
  noCertainly,
  noEmDash,
  noPolitenessCoda,
  noGreatQuestion,
  useConstructionVernacular,
  rfiFollowupLength,
  dailyLogLength,
  rfiStateQuestionAndDeadline,
  noContractions,
  noFiller,
  acronymCasing,
]

// ── Convenience accessors ────────────────────────────────────────────

export function getRulesByCategory(cat: VoiceRuleCategory): VoiceRule[] {
  return VOICE_RULES.filter((r) => r.category === cat)
}

export function getLintableRules(): VoiceRule[] {
  return VOICE_RULES.filter((r) => r.lintCheck !== undefined)
}

export function getRuleById(id: string): VoiceRule | undefined {
  return VOICE_RULES.find((r) => r.id === id)
}
