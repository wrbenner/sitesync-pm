import React, { createContext, useContext, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { getUserOrganizations } from '../api/endpoints/organizations'
import { queryKeys } from '../api/queryKeys'
import type { OrgRole } from '../types/tenant'
import type { Organization } from '../types/database'
import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'

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
    organization: currentOrg,
    organizations,
    currentOrgRole,
    setCurrentOrg,
    setOrganizations,
    setCurrentOrgRole,
    clearOrganization,
  } = useAuthStore()

  // OrganizationProvider drives its own loading flag from React Query;
  // authStore.loading covers auth itself and is not exposed here.
  const { data: orgs, isLoading: loading } = useQuery({
    queryKey: queryKeys.organizations.all,
    queryFn: getUserOrganizations,
    staleTime: 5 * 60 * 1000,
  })

  // Sync fetched orgs into the store (handles auto-selection too)
  useEffect(() => {
    if (orgs) setOrganizations(orgs as never)
  }, [orgs, setOrganizations])

  // Fetch current user's role in the active org
  useEffect(() => {
    if (!currentOrg) {
      setCurrentOrgRole(null)
      return
    }
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return
      fromTable('organization_members')
        .select('role')
        .eq('organization_id' as never, currentOrg.id)
        .eq('user_id' as never, user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setCurrentOrgRole((data?.role as OrgRole) ?? null)
        })
    })
    return () => { cancelled = true }
  }, [currentOrg, setCurrentOrgRole])

  // Clear org context when user signs out (authStore.signOut already clears
  // organizations/currentOrgRole, but this keeps the context in sync too)
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
