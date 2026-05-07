import { describe, it, expect, vi, afterEach } from 'vitest'
import { isDevBypassActive } from './devBypass'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isDevBypassActive', () => {
  it('returns false in production', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEV_BYPASS', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isDevBypassActive()).toBe(false)
  })

  it('returns false when DEV is not exactly true', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEV_BYPASS', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isDevBypassActive()).toBe(false)
  })

  it('returns false when VITE_DEV_BYPASS is not "true"', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_DEV_BYPASS', 'false')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isDevBypassActive()).toBe(false)
  })

  it('returns false when VITE_DEV_BYPASS is missing', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_DEV_BYPASS', '')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isDevBypassActive()).toBe(false)
  })

  it('returns false when Supabase URL is configured', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_DEV_BYPASS', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isDevBypassActive()).toBe(false)
  })

  it('returns false when Supabase anon key is configured', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_DEV_BYPASS', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ...')
    expect(isDevBypassActive()).toBe(false)
  })

  it('returns true only when all guard conditions hold simultaneously', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_DEV_BYPASS', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isDevBypassActive()).toBe(true)
  })
})
