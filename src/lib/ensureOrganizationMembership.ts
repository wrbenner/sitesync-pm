
import { fromTable, asRow } from '../lib/db/queries'
import { useAuthStore } from '../stores/authStore'
import type { Organization } from '../types/database'

function toOrganization(row: {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  plan: string | null
  created_at?: string | null
  updated_at?: string | null
  [key: string]: unknown
}): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo_url: row.logo_url,
    plan: row.plan,
    settings: null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    audit_retention_years: null,
    billing_email: null,
    compliance_level: null,
    data_region: null,
    default_project_role: null,
  } as Organization
}

/**
 * Ensure the user has an active organization and a matching organization_members row.
 *
 * Self-heals users whose onboarding did not create an org or an org membership.
 * Returns the active organization id, or null if we could not establish one.
 */
export async function ensureOrganizationMembership(userId: string): Promise<string | null> {
  const store = useAuthStore.getState()
  let activeOrgId = store.organization?.id ?? null

  // 1. If no active org in store, try to find any org the user belongs to.
  if (!activeOrgId) {
    const { data } = await fromTable('organization_members')
      .select('organization_id, organizations:organizations(*)')
      .eq('user_id' as never, userId)
      .limit(1)
      .maybeSingle()
    const existingMember = asRow<{ organization_id: string | null; organizations: Parameters<typeof toOrganization>[0] | null }>(data)

    if (existingMember?.organization_id) {
      activeOrgId = existingMember.organization_id
      const orgRow = existingMember.organizations
      if (orgRow) store.setCurrentOrg(toOrganization(orgRow))
    }
  }

  // 2. Still no org — create one for this user (first-time onboarding path).
  if (!activeOrgId) {
    const { data, error: orgErr } = await fromTable('organizations')
      .insert({ name: 'My Organization' } as never)
      .select()
      .single()
    const newOrg = asRow<Parameters<typeof toOrganization>[0] & { id: string }>(data)

    if (orgErr || !newOrg) return null
    activeOrgId = newOrg.id
    store.setCurrentOrg(toOrganization(newOrg))
  }

  // 3. Ensure organization_members row exists (idempotent).
  const { data: memberData } = await fromTable('organization_members')
    .select('id')
    .eq('organization_id' as never, activeOrgId)
    .eq('user_id' as never, userId)
    .maybeSingle()
  const memberRow = asRow<{ id: string }>(memberData)

  if (!memberRow) {
    await fromTable('organization_members').insert({
      organization_id: activeOrgId,
      user_id: userId,
      role: 'owner',
    } as never)
  }

  return activeOrgId
}
