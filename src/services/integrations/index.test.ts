import { describe, it, expect } from 'vitest'
import { getProvider, getProviderTypes } from './index'

describe('integrations registry — getProviderTypes', () => {
  it('returns the canonical 11 integrations', () => {
    const types = getProviderTypes()
    expect(types).toContain('procore_import')
    expect(types).toContain('ms_project')
    expect(types).toContain('quickbooks')
    expect(types).toContain('email_resend')
    expect(types).toContain('slack')
    expect(types).toContain('teams')
    expect(types).toContain('google_drive')
    expect(types).toContain('sharepoint')
    expect(types).toContain('primavera_p6')
    expect(types).toContain('autodesk_bim360')
    expect(types).toContain('sage')
    // Pin the count so adding/removing a provider trips this test
    expect(types).toHaveLength(11)
  })

  it('every provider key is unique', () => {
    const types = getProviderTypes()
    expect(new Set(types).size).toBe(types.length)
  })
})

describe('integrations registry — getProvider', () => {
  it('returns the provider object for a registered type', () => {
    const p = getProvider('procore_import')
    expect(p).not.toBeNull()
    expect(typeof p?.type).toBe('string')
  })

  it('returns null for an unknown type (safe fallthrough, not throw)', () => {
    expect(getProvider('not-a-real-integration')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getProvider('')).toBeNull()
  })

  it('every type returned by getProviderTypes resolves through getProvider', () => {
    for (const t of getProviderTypes()) {
      expect(getProvider(t)).not.toBeNull()
    }
  })

  it('provider lookup is case-sensitive (no normalization side effects)', () => {
    expect(getProvider('Procore_Import')).toBeNull()
    expect(getProvider('PROCORE_IMPORT')).toBeNull()
  })

  it('the registry key matches the provider.type for every entry (registry/meta consistency)', () => {
    for (const t of getProviderTypes()) {
      const p = getProvider(t)!
      expect(p.type).toBe(t)
    }
  })
})
