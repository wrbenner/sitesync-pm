// src/hooks/useActiveOrg.ts — BRT subsystem 1 §4.3
//
// Stable, minimal accessor for the active org id + role. Replaces the
// scattered `useAuthStore().organization?.id ?? ''` pattern that:
//   - silently falls back to '' when no org is selected (and then queries
//     never error — they just return empty results)
//   - bypasses the role check that almost every mutation needs
//
// Use this hook anywhere that needs to know "which org am I scoped to."
// Pair with src/lib/supabase/orgScope.ts for typed query chaining.

import { useMemo } from 'react'
import { useAuthStore } from '../stores/authStore'
import type { OrgRole } from '../types/tenant'
import type { Organization } from '../types/database'

export interface ActiveOrg {
  /** The full org object, or null if no active org. */
  org: Organization | null
  /** Convenience: the org id, or null. Use this in .eq('organization_id', orgId) chains. */
  orgId: string | null
  /** The caller's role in this org, or null. */
  role: OrgRole | null
  /** True if role is owner or admin (the threshold for billing/team/settings actions). */
  isOrgAdmin: boolean
  /** True if role is owner. */
  isOrgOwner: boolean
}

export function useActiveOrg(): ActiveOrg {
  const { organization, currentOrgRole } = useAuthStore()
  return useMemo(() => ({
    org: organization,
    orgId: organization?.id ?? null,
    role: currentOrgRole,
    isOrgAdmin: currentOrgRole === 'owner' || currentOrgRole === 'admin',
    isOrgOwner: currentOrgRole === 'owner',
  }), [organization, currentOrgRole])
}

/**
 * Strict variant: throws if no active org. Use only inside components that
 * are unreachable without an org (e.g. anything behind ProjectGate).
 */
export function useRequiredActiveOrg(): ActiveOrg & { orgId: string; org: Organization } {
  const active = useActiveOrg()
  if (!active.org || !active.orgId) {
    throw new Error('useRequiredActiveOrg: no active organization. Caller must be behind an org gate.')
  }
  return active as ActiveOrg & { orgId: string; org: Organization }
}
