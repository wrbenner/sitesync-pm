import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Organizations ────────────────────────────────────────

export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organizations', orgId],
    queryFn: async () => {
      const { data, error } = await fromTable('organizations').select('*').eq('id' as never, orgId!).single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}

export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization_members', orgId],
    queryFn: async () => {
      const { data, error } = await fromTable('organization_members').select('*').eq('organization_id' as never, orgId!).order('role')
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}
