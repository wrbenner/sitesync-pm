import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import { scoped } from '../../lib/supabase/orgScope'

// ── Organizations ────────────────────────────────────────

export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organizations', orgId],
    queryFn: async () => {
      // Looks up an org by primary key, not by organization_id FK — left as
      // direct .eq() since scoped() is for FK-bearing tables (the scope
      // column is `id` here, and orgId is the row's own id).
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
      const { data, error } = await scoped(
        fromTable('organization_members').select('*'),
        orgId,
      ).order('role')
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}
