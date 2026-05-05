import { describe, it, expect } from 'vitest'
import {
  diffRevisions,
  validateReason,
  buildRevisionRows,
  InvalidRevisionError,
  type DailyLogValueBag,
} from './revisions'

const bag = (over: Partial<DailyLogValueBag> = {}): DailyLogValueBag => ({
  summary: 'pour at C/4',
  weather: 'sunny',
  temperature_high: 78,
  temperature_low: 55,
  workers_onsite: 12,
  total_hours: 96,
  incidents: 0,
  ...over,
})

describe('diffRevisions', () => {
  it('returns no entries when nothing changed', () => {
    expect(diffRevisions(bag(), bag())).toEqual([])
  })

  it('detects a single-field change', () => {
    const out = diffRevisions(bag(), bag({ summary: 'pour at D/4' }))
    expect(out).toHaveLength(1)
    expect(out[0].field).toBe('summary')
    expect(out[0].oldValue).toBe('pour at C/4')
    expect(out[0].newValue).toBe('pour at D/4')
  })

  it('detects multiple field changes', () => {
    const out = diffRevisions(
      bag(),
      bag({ summary: 'new', weather: 'rain', incidents: 1 }),
    )
    const fields = out.map((d) => d.field).sort()
    expect(fields).toEqual(['incidents', 'summary', 'weather'])
  })

  it('treats undefined as null for comparison', () => {
    const before: DailyLogValueBag = { summary: null }
    const after: DailyLogValueBag = {} // summary: undefined
    expect(diffRevisions(before, after)).toEqual([])
  })

  it('flags transitions between null and a value', () => {
    expect(diffRevisions({ workers_onsite: null }, { workers_onsite: 5 })).toHaveLength(1)
    expect(diffRevisions({ workers_onsite: 5 }, { workers_onsite: null })).toHaveLength(1)
  })

  it('only tracks the documented field set', () => {
    const out = diffRevisions(
      { ...bag(), some_unknown: 'x' } as unknown as DailyLogValueBag,
      { ...bag(), some_unknown: 'y' } as unknown as DailyLogValueBag,
    )
    expect(out).toEqual([])
  })
})

describe('validateReason', () => {
  it('accepts a 5+ character reason', () => {
    expect(() => validateReason('typo on slab number')).not.toThrow()
  })

  it('rejects a too-short reason', () => {
    expect(() => validateReason('ok')).toThrow(InvalidRevisionError)
  })

  it('rejects whitespace-only reasons', () => {
    expect(() => validateReason('     ')).toThrow(InvalidRevisionError)
  })

  it('trims before length check', () => {
    expect(() => validateReason('   fixup   ')).not.toThrow()
    expect(() => validateReason('   typo   ')).toThrow(InvalidRevisionError)
  })
})

describe('buildRevisionRows', () => {
  const baseInputs = () => ({
    dailyLogId: 'log-1',
    projectId: 'p-1',
    before: bag(),
    after: bag({ summary: 'updated' }),
    reason: 'typo correction',
    revisedBy: 'user-1',
    prevRevisionHash: '0'.repeat(64),
  })

  it('emits one row per diff entry', async () => {
    const result = await buildRevisionRows(baseInputs())
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].field).toBe('summary')
    expect(result.rows[0].old_value).toBe('pour at C/4')
    expect(result.rows[0].new_value).toBe('updated')
  })

  it('passes through static metadata onto every row', async () => {
    const result = await buildRevisionRows({
      ...baseInputs(),
      after: bag({ summary: 'a', weather: 'b' }),
    })
    for (const r of result.rows) {
      expect(r.daily_log_id).toBe('log-1')
      expect(r.project_id).toBe('p-1')
      expect(r.revised_by).toBe('user-1')
      expect(r.reason).toBe('typo correction')
      expect(typeof r.revised_at).toBe('string')
    }
  })

  it('chains revision_hash → next prev_revision_hash', async () => {
    const result = await buildRevisionRows({
      ...baseInputs(),
      after: bag({ summary: 'a', weather: 'b', incidents: 1 }),
    })
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0].prev_revision_hash).toBe('0'.repeat(64))
    expect(result.rows[1].prev_revision_hash).toBe(result.rows[0].revision_hash)
    expect(result.rows[2].prev_revision_hash).toBe(result.rows[1].revision_hash)
    for (const r of result.rows) {
      expect(r.revision_hash).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('throws InvalidRevisionError on no-op edits', async () => {
    await expect(
      buildRevisionRows({ ...baseInputs(), after: bag() }),
    ).rejects.toThrow(InvalidRevisionError)
  })

  it('throws InvalidRevisionError when reason is too short', async () => {
    await expect(
      buildRevisionRows({ ...baseInputs(), reason: 'no' }),
    ).rejects.toThrow(InvalidRevisionError)
  })

  it('trims reason before persisting', async () => {
    const result = await buildRevisionRows({
      ...baseInputs(),
      reason: '   typo correction   ',
    })
    expect(result.rows[0].reason).toBe('typo correction')
  })
})
