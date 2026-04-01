import React, { createContext, useContext, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrganizationStore } from '../stores/organizationStore'
import { getUserOrganizations } from '../api/endpoints/organizations'
import { queryKeys } from '../api/queryKeys'
import type { Organization, OrgRole } from '../types/tenant'
import { supabase } from '../lib/supabase'

interface OrganizationContextValue {
  currentOrg: Organization | null
  organizations: Organization[]
  currentOrgRole: OrgRole | null
  loading: boolean
  switchOrg: (org: Organization) => void
}

const OrganizationContext = createContext<OrganizationContextValue>({
  currentOrg: null,
  organizations: [],
  currentOrgRole: null,
  loading: false,
  switchOrg: () => {},
})

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const {
    currentOrg,
    organizations,
    currentOrgRole,
    loading,
    setCurrentOrg,
    setOrganizations,
    setCurrentOrgRole,
    setLoading,
    clearOrganization,
  } = useOrganizationStore()

  const { data: orgs, isLoading } = useQuery({
    queryKey: queryKeys.organizations.all,
    queryFn: getUserOrganizations,
    staleTime: 5 * 60 * 1000,
  })

  // Sync fetched orgs into the store (handles auto-selection too)
  useEffect(() => {
    if (orgs) setOrganizations(orgs)
  }, [orgs, setOrganizations])

  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading, setLoading])

  // Fetch current user's role in the active org
  useEffect(() => {
    if (!currentOrg) {
      setCurrentOrgRole(null)
      return
    }
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return
      supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', currentOrg.id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setCurrentOrgRole((data?.role as OrgRole) ?? null)
        })
    })
    return () => { cancelled = true }
  }, [currentOrg, setCurrentOrgRole])

  // Clear org context when user signs out
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearOrganization()
    })
    return () => subscription.unsubscribe()
  }, [clearOrganization])

  const switchOrg = useCallback((org: Organization) => {
    setCurrentOrg(org)
  }, [setCurrentOrg])

  return React.createElement(
    OrganizationContext.Provider,
    { value: { currentOrg, organizations, currentOrgRole, loading, switchOrg } },
    children,
  )
}

// Use inside any component to access the active org
export function useOrganization(): OrganizationContextValue {
  return useContext(OrganizationContext)
}
