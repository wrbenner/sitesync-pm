// Phase 6 — story banner builder tests.

import { describe, it, expect } from 'vitest'
import { buildStoryBanner } from '../../../components/submittals/detail/StoryBanner'

const base = {
  status: null,
  current_reviewer_name: null,
  current_reviewer_role: null,
  days_in_court: null,
  required_on_site_date: null,
  closed_at: null,
  iris_preflight_findings_count: 0,
}

describe('buildStoryBanner', () => {
  it('returns null when nothing remarkable', () => {
    const b = buildStoryBanner({ ...base, status: 'unknown' })
    expect(b).toBeNull()
  })

  it('renders success for closed submittals', () => {
    const b = buildStoryBanner({ ...base, status: 'closed', closed_at: '2026-05-01' })
    expect(b?.tone).toBe('success')
    expect(b?.headline).toMatch(/closed/i)
  })

  it('renders critical for returned submittals', () => {
    const b = buildStoryBanner({
      ...base,
      status: 'returned',
      current_reviewer_name: 'Melissa Ellis',
      current_reviewer_role: 'Architect',
    })
    expect(b?.tone).toBe('critical')
    expect(b?.headline).toContain('Melissa Ellis')
    expect(b?.headline).toContain('Architect')
  })

  it('escalates tone with days_in_court', () => {
    const b1 = buildStoryBanner({ ...base, status: 'in_review', current_reviewer_name: 'A', days_in_court: 2 })
    const b2 = buildStoryBanner({ ...base, status: 'in_review', current_reviewer_name: 'A', days_in_court: 5 })
    const b3 = buildStoryBanner({ ...base, status: 'in_review', current_reviewer_name: 'A', days_in_court: 10 })
    expect(b1?.tone).toBe('info')
    expect(b2?.tone).toBe('pending')
    expect(b3?.tone).toBe('critical')
  })

  it('renders sub_uploading state', () => {
    const b = buildStoryBanner({ ...base, status: 'sub_uploading' })
    expect(b?.tone).toBe('pending')
    expect(b?.headline).toMatch(/magic link/i)
  })

  it('renders distribute state', () => {
    const b = buildStoryBanner({ ...base, status: 'distribute' })
    expect(b?.tone).toBe('success')
    expect(b?.headline).toMatch(/distribution/i)
  })

  it('uses iris_narrative when provided (LLM override)', () => {
    const b = buildStoryBanner({
      ...base,
      status: 'in_review',
      current_reviewer_name: 'A',
      iris_narrative: 'Iris flagged a missing AAMA cert.',
    })
    expect(b?.headline).toBe('Iris flagged a missing AAMA cert.')
  })

  it('renders draft state with helpful next-step hint', () => {
    const b = buildStoryBanner({ ...base, status: 'draft' })
    expect(b?.tone).toBe('info')
    expect(b?.headline).toMatch(/draft/i)
  })
})
