/**
 * voiceLinter tests — per-rule lintCheck behavior + aggregator
 * (lintVoice) end-to-end correctness.
 */
import { describe, it, expect } from 'vitest'
import {
  getLintableRules,
  getRuleById,
  VOICE_RULES,
  type VoiceLintContext,
} from '../style'
import { failedRuleIds, lintVoice } from '../voiceLinter'
import { buildVoicePrompt } from '../voicePrompt'

const RFI_CTX: VoiceLintContext = {
  actionType: 'rfi.draft',
  citations: [],
}
const DAILY_LOG_CTX: VoiceLintContext = {
  actionType: 'daily_log.draft',
  citations: [],
}
const SUBMITTAL_CTX: VoiceLintContext = {
  actionType: 'submittal.transmittal_draft',
  citations: [],
}

describe('VOICE_RULES registry', () => {
  it('every rule has a unique id', () => {
    const ids = VOICE_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('every rule has at least 0 valid example pairs (good is non-empty when present)', () => {
    for (const r of VOICE_RULES) {
      for (const ex of r.examples) {
        expect(ex.good.length).toBeGreaterThan(0)
        expect(ex.bad.length).toBeGreaterThan(0)
      }
    }
  })
  it('every rule has either a promptBlock or a lintCheck (or both)', () => {
    for (const r of VOICE_RULES) {
      expect(r.promptBlock !== undefined || r.lintCheck !== undefined).toBe(true)
    }
  })
})

describe('rule: no-certainly', () => {
  const rule = getRuleById('no-certainly')!
  it('flags a sentence containing "certainly"', () => {
    const r = rule.lintCheck!('Certainly, the architect needs to weigh in.', RFI_CTX)
    expect(r.passed).toBe(false)
    expect(r.suggestedReplacement?.toLowerCase()).not.toContain('certainly')
  })
  it('passes a clean sentence', () => {
    const r = rule.lintCheck!('The architect needs to weigh in.', RFI_CTX)
    expect(r.passed).toBe(true)
  })
  it('case-insensitive: "Certainly" is also flagged', () => {
    const r = rule.lintCheck!('Certainly that works.', RFI_CTX)
    expect(r.passed).toBe(false)
  })
})

describe('rule: no-em-dash', () => {
  const rule = getRuleById('no-em-dash')!
  it('flags em-dash and proposes a clean replacement', () => {
    const r = rule.lintCheck!('Slab pour slipped — we need a new date.', RFI_CTX)
    expect(r.passed).toBe(false)
    expect(r.suggestedReplacement).not.toContain('—')
  })
  it('flags en-dash too', () => {
    const r = rule.lintCheck!('Range 5–10 days.', RFI_CTX)
    expect(r.passed).toBe(false)
  })
  it('passes a hyphen-only sentence', () => {
    const r = rule.lintCheck!('Punch-list items pending.', RFI_CTX)
    expect(r.passed).toBe(true)
  })
})

describe('rule: no-i-hope-this-helps', () => {
  const rule = getRuleById('no-i-hope-this-helps')!
  it('flags "I hope this helps"', () => {
    const r = rule.lintCheck!('Need a response. I hope this helps!', RFI_CTX)
    expect(r.passed).toBe(false)
    expect(r.suggestedReplacement?.toLowerCase()).not.toContain('hope this helps')
  })
  it('flags "let me know if you have any questions"', () => {
    const r = rule.lintCheck!('Need an answer. Let me know if you have any questions.', RFI_CTX)
    expect(r.passed).toBe(false)
  })
  it('flags "happy to help further"', () => {
    const r = rule.lintCheck!('See attached. Happy to help further.', RFI_CTX)
    expect(r.passed).toBe(false)
  })
  it('passes a clean sentence', () => {
    const r = rule.lintCheck!('Need a response by Friday to keep the slab on schedule.', RFI_CTX)
    expect(r.passed).toBe(true)
  })
})

describe('rule: no-great-question', () => {
  const rule = getRuleById('no-great-question')!
  it('flags "Great question!" lead', () => {
    const r = rule.lintCheck!('Great question! The wall finish is unanswered.', RFI_CTX)
    expect(r.passed).toBe(false)
    expect(r.suggestedReplacement?.toLowerCase()).not.toContain('great question')
  })
  it('flags "Absolutely!" lead', () => {
    const r = rule.lintCheck!('Absolutely! Architect needs to weigh in.', RFI_CTX)
    expect(r.passed).toBe(false)
  })
  it('passes when affirmation appears mid-text (only leading position counts)', () => {
    const r = rule.lintCheck!(
      'The architect said this is a great question to escalate.',
      RFI_CTX,
    )
    expect(r.passed).toBe(true)
  })
})

describe('rule: rfi-followup-length', () => {
  const rule = getRuleById('rfi-followup-length')!
  it('flags a > 60-word RFI follow-up', () => {
    const longRfi = 'word '.repeat(70).trim()
    const r = rule.lintCheck!(longRfi, RFI_CTX)
    expect(r.passed).toBe(false)
    expect(r.message).toContain('70')
  })
  it('passes a 60-word RFI follow-up exactly', () => {
    const sixtyWords = 'word '.repeat(60).trim()
    const r = rule.lintCheck!(sixtyWords, RFI_CTX)
    expect(r.passed).toBe(true)
  })
  it('does not apply to non-RFI action types', () => {
    const longText = 'word '.repeat(150).trim()
    const r = rule.lintCheck!(longText, DAILY_LOG_CTX)
    expect(r.passed).toBe(true)
  })
})

describe('rule: daily-log-length', () => {
  const rule = getRuleById('daily-log-length')!
  it('flags a > 200-word daily-log narrative', () => {
    const text = 'word '.repeat(210).trim()
    const r = rule.lintCheck!(text, DAILY_LOG_CTX)
    expect(r.passed).toBe(false)
  })
  it('passes a 200-word daily log exactly', () => {
    const text = 'word '.repeat(200).trim()
    const r = rule.lintCheck!(text, DAILY_LOG_CTX)
    expect(r.passed).toBe(true)
  })
  it('does not apply to RFI follow-ups', () => {
    const text = 'word '.repeat(210).trim()
    const r = rule.lintCheck!(text, RFI_CTX)
    expect(r.passed).toBe(true)
  })
})

describe('rule: no-contractions-in-formal-actions', () => {
  const rule = getRuleById('no-contractions-in-formal-actions')!
  it("flags 'we're' in an RFI follow-up", () => {
    const r = rule.lintCheck!("We're following up on the wall finish.", RFI_CTX)
    expect(r.passed).toBe(false)
  })
  it("flags 'don't' in a submittal transmittal", () => {
    const r = rule.lintCheck!("We don't have an answer yet.", SUBMITTAL_CTX)
    expect(r.passed).toBe(false)
  })
  it('allows contractions in daily logs', () => {
    const r = rule.lintCheck!("Crew didn't pour today; rain.", DAILY_LOG_CTX)
    expect(r.passed).toBe(true)
  })
  it('passes a contraction-free RFI', () => {
    const r = rule.lintCheck!('We are following up.', RFI_CTX)
    expect(r.passed).toBe(true)
  })
})

describe('rule: no-filler-words', () => {
  const rule = getRuleById('no-filler-words')!
  it('flags 2+ filler words (just / actually / basically)', () => {
    const r = rule.lintCheck!('We are just actually waiting on the architect.', RFI_CTX)
    expect(r.passed).toBe(false)
  })
  it('tolerates 1 filler word (conservative)', () => {
    const r = rule.lintCheck!('We are just waiting on the architect.', RFI_CTX)
    expect(r.passed).toBe(true)
  })
})

describe('rule: acronym-casing', () => {
  const rule = getRuleById('acronym-casing')!
  it('flags lowercase rfi and rewrites to RFI', () => {
    const r = rule.lintCheck!('The rfi was filed yesterday.', RFI_CTX)
    expect(r.passed).toBe(false)
    expect(r.suggestedReplacement).toBe('The RFI was filed yesterday.')
  })
  it('flags TitleCase Rfis and rewrites to RFIs', () => {
    const r = rule.lintCheck!('Expect 5 Rfis back this week.', RFI_CTX)
    expect(r.passed).toBe(false)
    expect(r.suggestedReplacement).toBe('Expect 5 RFIs back this week.')
  })
  it('does not touch already-correct uppercase RFI / RFIs', () => {
    const r = rule.lintCheck!('The RFI was filed yesterday; expect 5 RFIs.', RFI_CTX)
    expect(r.passed).toBe(true)
  })
  it('does not touch identifiers like rfi_id or RfiList (substring matches)', () => {
    const r = rule.lintCheck!('Reads from rfi_id; uses RfiList component.', RFI_CTX)
    expect(r.passed).toBe(true)
  })
  it('leaves the word "co" alone (ambiguous with the noun)', () => {
    const r = rule.lintCheck!('They run a small co for steel erection.', RFI_CTX)
    expect(r.passed).toBe(true)
  })
})

describe('lintVoice (aggregator)', () => {
  it('passes a clean RFI follow-up', () => {
    const text = 'Need wall finish at column line 7 confirmed before MEP rough-in. Slab pour is Friday.'
    const r = lintVoice(text, RFI_CTX)
    expect(r.passed).toBe(true)
    expect(r.failedRules).toEqual([])
    expect(r.text).toBe(text)
  })

  it('autofixes "certainly" + politeness coda in one pass', () => {
    const text = 'Certainly, we need a response by Friday. I hope this helps!'
    const r = lintVoice(text, RFI_CTX)
    expect(r.text.toLowerCase()).not.toContain('certainly')
    expect(r.text.toLowerCase()).not.toContain('hope this helps')
    expect(failedRuleIds(r)).toContain('no-certainly')
    expect(failedRuleIds(r)).toContain('no-i-hope-this-helps')
  })

  it('autofixes em-dashes', () => {
    const text = 'Slab pour slipped to Friday — we need a new date.'
    const r = lintVoice(text, RFI_CTX)
    expect(r.text).not.toContain('—')
    expect(failedRuleIds(r)).toContain('no-em-dash')
  })

  it('reports length-rule failures without auto-truncating', () => {
    const text = 'word '.repeat(70).trim()
    const r = lintVoice(text, RFI_CTX)
    // Length rule does not have an autofix — the text stays put, but the failure is reported.
    expect(r.text).toBe(text)
    expect(r.passed).toBe(false)
    expect(failedRuleIds(r)).toContain('rfi-followup-length')
  })

  it('autofix=false reports without modifying text', () => {
    const text = 'Certainly! We are following up.'
    const r = lintVoice(text, RFI_CTX, { autofix: false })
    expect(r.text).toBe(text)
    expect(r.passed).toBe(false)
  })

  it('runs to fixed-point: autofixed text re-passes the linter', () => {
    const text = 'Certainly we are following up — hope this helps.'
    const r = lintVoice(text, RFI_CTX)
    // After autofix, a second lintVoice call should report no banned-phrase
    // failures. (The length rule may still apply if the fix shortened to <60.)
    const second = lintVoice(r.text, RFI_CTX)
    const bannedFailures = second.failedRules.filter((f) =>
      ['no-certainly', 'no-em-dash', 'no-i-hope-this-helps'].includes(f.ruleId),
    )
    expect(bannedFailures).toEqual([])
  })

  it('does not exceed 5 passes (fixed-point safety cap)', () => {
    // Even a pathological input shouldn't run forever.
    const text = 'Certainly — certainly — certainly — I hope this helps! '.repeat(5)
    const r = lintVoice(text, RFI_CTX)
    expect(r.passes).toBeLessThanOrEqual(5)
  })
})

describe('buildVoicePrompt', () => {
  it('renders prompt blocks for the action type', () => {
    const prompt = buildVoicePrompt('rfi.draft')
    expect(prompt).toContain('You are Iris')
    expect(prompt).toContain('"certainly"')
    expect(prompt).toContain('em-dashes')
    expect(prompt).toContain('60 words')
  })

  it('omits length rules that do not apply to the action type', () => {
    const rfiPrompt = buildVoicePrompt('rfi.draft')
    expect(rfiPrompt).not.toContain('200 words')
    const dailyPrompt = buildVoicePrompt('daily_log.draft')
    expect(dailyPrompt).toContain('200 words')
    expect(dailyPrompt).not.toContain('60 words')
  })

  it('omits the contraction rule for daily logs (allowed there)', () => {
    const dailyPrompt = buildVoicePrompt('daily_log.draft')
    expect(dailyPrompt).not.toContain('contractions')
    const rfiPrompt = buildVoicePrompt('rfi.draft')
    expect(rfiPrompt).toContain('contractions')
  })

  it('renders all rules when no actionType given', () => {
    const prompt = buildVoicePrompt()
    expect(prompt).toContain('60 words')
    expect(prompt).toContain('200 words')
  })
})

describe('coverage: every lintable rule has at least one test', () => {
  it('every getLintableRules() id has a describe block above', () => {
    const tested = new Set([
      'no-certainly',
      'no-em-dash',
      'no-i-hope-this-helps',
      'no-great-question',
      'rfi-followup-length',
      'daily-log-length',
      'no-contractions-in-formal-actions',
      'no-filler-words',
      'acronym-casing',
    ])
    for (const r of getLintableRules()) {
      expect(tested.has(r.id), `rule ${r.id} has no test block`).toBe(true)
    }
  })
})
