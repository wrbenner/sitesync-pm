import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { evaluateMfaRequirement } from './MfaRequiredBanner'

describe('evaluateMfaRequirement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-26T12:00:00Z'))
  })

  afterEach(() => vi.useRealTimers())

  it('marks privileged roles correctly', () => {
    for (const r of ['owner', 'admin', 'project_manager', 'company_admin']) {
      expect(evaluateMfaRequirement(r, false, null).isPrivileged).toBe(true)
    }
  })

  it('does not mark non-privileged roles', () => {
    for (const r of ['viewer', 'subcontractor', 'field_user', 'foreman', 'project_engineer', '']) {
      expect(evaluateMfaRequirement(r, false, null).isPrivileged).toBe(false)
    }
  })

  it('within grace returns isPastGrace=false', () => {
    const future = '2026-05-03T12:00:00Z' // 7 days out
    const r = evaluateMfaRequirement('owner', false, future)
    expect(r.isPastGrace).toBe(false)
    expect(r.graceUntil?.getTime()).toBe(new Date(future).getTime())
  })

  it('past-grace timestamp returns isPastGrace=true', () => {
    const past = '2026-04-19T12:00:00Z'
    const r = evaluateMfaRequirement('admin', false, past)
    expect(r.isPastGrace).toBe(true)
  })

  it('NULL grace is treated as past-grace (existing privileged users with no grace = enforce now)', () => {
    const r = evaluateMfaRequirement('owner', false, null)
    expect(r.isPastGrace).toBe(true)
    expect(r.graceUntil).toBeNull()
  })

  it('exact-equal grace is past-grace (boundary inclusive of now)', () => {
    const r = evaluateMfaRequirement('admin', false, '2026-04-26T12:00:00Z')
    expect(r.isPastGrace).toBe(true)
  })

  it('hasMfa flag flows through unchanged', () => {
    expect(evaluateMfaRequirement('owner', true, null).hasMfa).toBe(true)
    expect(evaluateMfaRequirement('owner', false, null).hasMfa).toBe(false)
  })

  it('undefined / null role is treated as non-privileged', () => {
    expect(evaluateMfaRequirement(undefined, false, null).isPrivileged).toBe(false)
    expect(evaluateMfaRequirement(null, false, null).isPrivileged).toBe(false)
  })
})
