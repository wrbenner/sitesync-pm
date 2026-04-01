import { supabase } from '../client'
import { PermissionError } from '../../lib/rls'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateOrgId(orgId: string): void {
  if (!orgId || !UUID_REGEX.test(orgId)) {
    throw new Error(`Invalid organization ID: ${orgId}`)
  }
}

// Verify the current auth user is a member of orgId before running fn.
// Throws PermissionError if not authenticated or not an org member.
export async function withOrgAccess<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  validateOrgId(orgId)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new PermissionError('Not authenticated')
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('id, role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) {
    throw new PermissionError(`Access denied: not a member of organization ${orgId}`)
  }

  return fn()
}

// Require admin or owner role within the org
export async function withOrgAdminAccess<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  validateOrgId(orgId)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new PermissionError('Not authenticated')
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data || !['owner', 'admin'].includes((data as any).role)) {
    throw new PermissionError(`Admin access required for organization ${orgId}`)
  }

  return fn()
}
