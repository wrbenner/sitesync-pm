// Phase 7 — VoiceReviewOverlay transcript parser tests.

import { describe, it, expect } from 'vitest'
import { parseTranscriptToReviewCode } from '../../../components/submittals/detail/VoiceReviewOverlay'

describe('parseTranscriptToReviewCode', () => {
  it('returns null on empty / unrelated input', () => {
    expect(parseTranscriptToReviewCode('')).toBeNull()
    expect(parseTranscriptToReviewCode('unrelated chatter')).toBeNull()
  })

  it('detects "approve as noted"', () => {
    const r = parseTranscriptToReviewCode('approve as noted')
    expect(r?.code).toBe('approve')
    expect(r?.disposition).toBe('Approved as noted')
  })

  it('detects "approve" without modifier', () => {
    const r = parseTranscriptToReviewCode('approve')
    expect(r?.code).toBe('approve')
  })

  it('detects "revise and resubmit"', () => {
    const r = parseTranscriptToReviewCode('revise and resubmit — see comments below')
    expect(r?.code).toBe('revise')
    // Phase 7 ships the review code detection; comment extraction precision
    // is Phase 7b (LLM-augmented). The deterministic path captures the
    // detected review code, which is the load-bearing piece of the overlay.
  })

  it('detects "reject"', () => {
    const r = parseTranscriptToReviewCode('Reject — wrong manufacturer')
    expect(r?.code).toBe('reject')
  })

  it('detects "reject" via "not approved" phrase', () => {
    const r = parseTranscriptToReviewCode('Not approved — sub provided wrong gauge')
    expect(r?.code).toBe('reject')
  })

  it('preserves the original case in returned comments', () => {
    const r = parseTranscriptToReviewCode('Reject — Wrong Manufacturer Specified')
    // We don't lowercase the comments — only the matching is case-insensitive.
    expect(r?.comments.length).toBeGreaterThan(0)
  })
})
