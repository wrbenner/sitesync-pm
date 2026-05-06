/**
 * Parity smoke for the Deno-side voice linter.
 *
 * The canonical voice rules live in src/lib/iris/style.ts + voiceLinter.ts.
 * The edge-function copy lives in supabase/functions/shared/voiceLinter.ts
 * and is intentionally inlined because Deno can't import from src/.
 *
 * This file's job: catch copy-paste drift. Each test runs the same input
 * through BOTH implementations and asserts they agree on (passed, text,
 * failed_rule_ids). A failure here = the two files diverged; resolve
 * before merging.
 */
import { describe, it, expect } from 'vitest'
import { lintVoice as lintVoiceSrc } from '../../../../src/lib/iris/voiceLinter'
import { lintVoice as lintVoiceDeno } from '../voiceLinter'

interface ParityCase {
  name: string
  text: string
  actionType?: 'rfi.draft' | 'daily_log.draft' | 'submittal.transmittal_draft'
}

const cases: ParityCase[] = [
  { name: 'clean RFI', text: 'Need wall finish at column line 7. Slab Friday.', actionType: 'rfi.draft' },
  { name: 'em-dash', text: 'Slab pour slipped to Friday — we need a date.', actionType: 'rfi.draft' },
  { name: 'certainly', text: 'Certainly, the architect needs to weigh in.', actionType: 'rfi.draft' },
  { name: 'I hope this helps', text: 'Need response. I hope this helps!', actionType: 'rfi.draft' },
  { name: 'great question lead', text: 'Great question! Wall finish unanswered.', actionType: 'rfi.draft' },
  { name: 'contractions in RFI', text: "We're following up on the wall finish.", actionType: 'rfi.draft' },
  { name: 'contractions in daily log', text: "Crew didn't pour today; rain.", actionType: 'daily_log.draft' },
  { name: 'multiple filler words', text: 'We are just actually waiting on the architect.', actionType: 'rfi.draft' },
  { name: 'long RFI', text: 'word '.repeat(70).trim(), actionType: 'rfi.draft' },
  { name: 'long daily log', text: 'word '.repeat(210).trim(), actionType: 'daily_log.draft' },
  { name: 'no actionType (universal rules only)', text: 'Certainly we need a response.' },
]

describe('voice linter parity (src/ vs supabase/functions/shared/)', () => {
  for (const c of cases) {
    it(`agrees on: ${c.name}`, () => {
      const ctxSrc = c.actionType
        ? { actionType: c.actionType, citations: [] }
        : { citations: [] }
      const ctxDeno = c.actionType ? { actionType: c.actionType } : {}
      const src = lintVoiceSrc(c.text, ctxSrc)
      const deno = lintVoiceDeno(c.text, ctxDeno)

      expect(deno.passed).toBe(src.passed)
      expect(deno.text).toBe(src.text)
      const srcRules = src.failedRules.map((f) => f.ruleId).sort()
      const denoRules = deno.failedRules.map((f) => f.ruleId).sort()
      expect(denoRules).toEqual(srcRules)
    })
  }
})
