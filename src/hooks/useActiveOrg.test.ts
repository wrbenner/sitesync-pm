// src/hooks/useActiveOrg.test.ts — BRT sub-1 §4.3
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useActiveOrg, useRequiredActiveOrg } from './useActiveOrg'
import { useAuthStore } from '../stores/authStore'
import type { Organization } from '../types/database'

const fakeOrg: Organization = {
  id: 'org-1',
  name: 'Acme Builders',
  slug: 'acme',
  logo_url: null,
  plan: 'pro',
  settings: null,
  created_at: null,
  updated_at: null,
  audit_retention_years: null,
  billing_email: null,
  compliance_level: null,
  data_region: null,
  default_project_role: null,
} as Organization

beforeEach(() => {
  useAuthStore.setState({
    organization: null,
    currentOrgRole: null,
  })
})

describe('useActiveOrg', () => {
  it('returns null state when no active org', () => {
    const { result } = renderHook(() => useActiveOrg())
    expect(result.current.org).toBe(null)
    expect(result.current.orgId).toBe(null)
    expect(result.current.role).toBe(null)
    expect(result.current.isOrgAdmin).toBe(false)
    expect(result.current.isOrgOwner).toBe(false)
  })

  it('returns org + admin flags when owner', () => {
    useAuthStore.setState({ organization: fakeOrg, currentOrgRole: 'owner' })
    const { result } = renderHook(() => useActiveOrg())
    expect(result.current.orgId).toBe('org-1')
    expect(result.current.isOrgAdmin).toBe(true)
    expect(result.current.isOrgOwner).toBe(true)
  })

  it('returns admin true for admin role but owner false', () => {
    useAuthStore.setState({ organization: fakeOrg, currentOrgRole: 'admin' })
    const { result } = renderHook(() => useActiveOrg())
    expect(result.current.isOrgAdmin).toBe(true)
    expect(result.current.isOrgOwner).toBe(false)
  })

  it('returns admin false for member role', () => {
    useAuthStore.setState({ organization: fakeOrg, currentOrgRole: 'member' })
    const { result } = renderHook(() => useActiveOrg())
    expect(result.current.isOrgAdmin).toBe(false)
    expect(result.current.isOrgOwner).toBe(false)
  })
})

describe('useRequiredActiveOrg', () => {
  it('throws when no active org', () => {
    expect(() => renderHook(() => useRequiredActiveOrg())).toThrow(/no active organization/)
  })

  it('returns narrowed type when org present', () => {
    useAuthStore.setState({ organization: fakeOrg, currentOrgRole: 'owner' })
    const { result } = renderHook(() => useRequiredActiveOrg())
    expect(result.current.orgId).toBe('org-1')
    expect(result.current.org.name).toBe('Acme Builders')
  })
})
