import { describe, it, expect, beforeEach } from 'vitest'
import { useOrganizationStore } from './organizationStore'
import type { Organization } from '../types/tenant'

function org(id: string, overrides: Partial<Organization> = {}): Organization {
  return {
    id,
    name: `Org ${id}`,
    slug: `org-${id}`,
    logo_url: null,
    plan: 'professional',
    settings: {},
    ...overrides,
  }
}

beforeEach(() => {
  useOrganizationStore.setState({
    currentOrg: null,
    organizations: [],
    currentOrgRole: null,
    loading: false,
    error: null,
  })
})

describe('organizationStore — initial state', () => {
  it('starts with no org context', () => {
    const s = useOrganizationStore.getState()
    expect(s.currentOrg).toBeNull()
    expect(s.organizations).toEqual([])
    expect(s.currentOrgRole).toBeNull()
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
  })
})

describe('organizationStore — setCurrentOrg', () => {
  it('sets the org and clears any prior error', () => {
    useOrganizationStore.setState({ error: 'previous' })
    useOrganizationStore.getState().setCurrentOrg(org('a'))
    const s = useOrganizationStore.getState()
    expect(s.currentOrg?.id).toBe('a')
    expect(s.error).toBeNull()
  })

  it('preserves currentOrgRole when re-setting the same org', () => {
    useOrganizationStore.setState({ currentOrg: org('a'), currentOrgRole: 'admin' })
    useOrganizationStore.getState().setCurrentOrg(org('a'))
    expect(useOrganizationStore.getState().currentOrgRole).toBe('admin')
  })

  it('clears currentOrgRole when switching to a different org', () => {
    useOrganizationStore.setState({ currentOrg: org('a'), currentOrgRole: 'admin' })
    useOrganizationStore.getState().setCurrentOrg(org('b'))
    expect(useOrganizationStore.getState().currentOrgRole).toBeNull()
    expect(useOrganizationStore.getState().currentOrg?.id).toBe('b')
  })
})

describe('organizationStore — setOrganizations', () => {
  it('auto-selects the first org when none is current', () => {
    useOrganizationStore.getState().setOrganizations([org('a'), org('b')])
    expect(useOrganizationStore.getState().currentOrg?.id).toBe('a')
  })

  it('keeps the current org if it still appears in the list', () => {
    useOrganizationStore.setState({ currentOrg: org('b') })
    useOrganizationStore.getState().setOrganizations([org('a'), org('b'), org('c')])
    expect(useOrganizationStore.getState().currentOrg?.id).toBe('b')
  })

  it('falls back to the first org when the current one was removed (user kicked)', () => {
    useOrganizationStore.setState({ currentOrg: org('removed') })
    useOrganizationStore.getState().setOrganizations([org('a'), org('b')])
    expect(useOrganizationStore.getState().currentOrg?.id).toBe('a')
  })

  it('sets currentOrg to null when the list is empty and current is missing', () => {
    useOrganizationStore.setState({ currentOrg: org('removed') })
    useOrganizationStore.getState().setOrganizations([])
    expect(useOrganizationStore.getState().currentOrg).toBeNull()
  })

  it('writes the supplied list to organizations[]', () => {
    useOrganizationStore.getState().setOrganizations([org('a'), org('b')])
    expect(useOrganizationStore.getState().organizations).toHaveLength(2)
  })
})

describe('organizationStore — simple setters', () => {
  it('setCurrentOrgRole writes through', () => {
    useOrganizationStore.getState().setCurrentOrgRole('member')
    expect(useOrganizationStore.getState().currentOrgRole).toBe('member')
  })

  it('setCurrentOrgRole accepts null to clear', () => {
    useOrganizationStore.setState({ currentOrgRole: 'admin' })
    useOrganizationStore.getState().setCurrentOrgRole(null)
    expect(useOrganizationStore.getState().currentOrgRole).toBeNull()
  })

  it('setLoading writes the boolean', () => {
    useOrganizationStore.getState().setLoading(true)
    expect(useOrganizationStore.getState().loading).toBe(true)
  })

  it('setError writes a string and accepts null', () => {
    useOrganizationStore.getState().setError('boom')
    expect(useOrganizationStore.getState().error).toBe('boom')
    useOrganizationStore.getState().setError(null)
    expect(useOrganizationStore.getState().error).toBeNull()
  })
})

describe('organizationStore — clearOrganization', () => {
  it('resets all org-scoped state', () => {
    useOrganizationStore.setState({
      currentOrg: org('a'),
      organizations: [org('a'), org('b')],
      currentOrgRole: 'owner',
      error: 'something',
    })
    useOrganizationStore.getState().clearOrganization()
    const s = useOrganizationStore.getState()
    expect(s.currentOrg).toBeNull()
    expect(s.organizations).toEqual([])
    expect(s.currentOrgRole).toBeNull()
    expect(s.error).toBeNull()
  })
})
