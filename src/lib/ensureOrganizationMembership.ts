import { supabase } from './supabase'
import { useOrganizationStore } from '../stores/organizationStore'
import type { Organization } from '../types/tenant'

function toOrganization(row: {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  plan: string | null
  created_at?: string | null
  updated_at?: string | null
}): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? '',
    logo_url: row.logo_url,
    plan: (row.plan as Organization['plan']) ?? 'starter',
    settings: {},
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  }
}

/**
 * Ensure the user has an active organization and a matching organization_members row.
 *
 * Self-heals users whose onboarding did not create an org or an org membership.
 * Returns the active organization id, or null if we could not establish one.
 */
export async function ensureOrganizationMembership(userId: string): Promise<string | null> {
  const store = useOrganizationStore.getState()
  let activeOrgId = store.currentOrg?.id ?? null

  // 1. If no active org in store, try to find any org the user belongs to.
  if (!activeOrgId) {
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('organization_id, organizations:organizations(*)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (existingMember?.organization_id) {
      activeOrgId = existingMember.organization_id
      const orgRow = (existingMember as { organizations?: Parameters<typeof toOrganization>[0] | null }).organizations
      if (orgRow) store.setCurrentOrg(toOrganization(orgRow))
    }
  }

  // 2. Still no org — create one for this user (first-time onboarding path).
  if (!activeOrgId) {
    const { data: newOrg, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: 'My Organization' })
      .select()
      .single()

    if (orgErr || !newOrg) return null
    activeOrgId = newOrg.id
    store.setCurrentOrg(toOrganization(newOrg))
  }

  // 3. Ensure organization_members row exists (idempotent).
  const { data: memberRow } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', activeOrgId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!memberRow) {
    await supabase.from('organization_members').insert({
      organization_id: activeOrgId,
      user_id: userId,
      role: 'owner',
    })
  }

  return activeOrgId
}
