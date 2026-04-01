import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Organization, OrgRole } from '../types/tenant'

interface OrganizationState {
  // The org the user is currently working within
  currentOrg: Organization | null
  // All orgs the user belongs to (loaded on auth)
  organizations: Organization[]
  // Role in the current org
  currentOrgRole: OrgRole | null
  loading: boolean
  error: string | null

  setCurrentOrg: (org: Organization) => void
  setOrganizations: (orgs: Organization[]) => void
  setCurrentOrgRole: (role: OrgRole | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearOrganization: () => void
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set, get) => ({
      currentOrg: null,
      organizations: [],
      currentOrgRole: null,
      loading: false,
      error: null,

      setCurrentOrg: (org) => {
        // If switching orgs, clear the role until it is re-fetched
        const prev = get().currentOrg
        const roleReset = prev?.id !== org.id ? { currentOrgRole: null } : {}
        set({ currentOrg: org, error: null, ...roleReset })
      },

      setOrganizations: (orgs) => {
        set((s) => {
          // Auto select the first org if none is selected yet, or the current
          // org no longer exists in the list (e.g. user was removed)
          const stillValid = s.currentOrg && orgs.some((o) => o.id === s.currentOrg!.id)
          const currentOrg = stillValid ? s.currentOrg : (orgs[0] ?? null)
          return { organizations: orgs, currentOrg }
        })
      },

      setCurrentOrgRole: (role) => set({ currentOrgRole: role }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      clearOrganization: () => set({
        currentOrg: null,
        organizations: [],
        currentOrgRole: null,
        error: null,
      }),
    }),
    {
      name: 'sitesync-org-context',
      // Only persist the selected org ID, not the full list (re-fetched on load)
      partialize: (state) => ({
        currentOrg: state.currentOrg ? { id: state.currentOrg.id } : null,
      }),
      merge: (persisted, current) => {
        // On rehydration we only have the org id. Full org data comes from API.
        // Keep the persisted id so we can restore the selection after fetch.
        const p = persisted as Partial<OrganizationState>
        return {
          ...current,
          currentOrg: p.currentOrg ?? null,
        }
      },
    }
  )
)
