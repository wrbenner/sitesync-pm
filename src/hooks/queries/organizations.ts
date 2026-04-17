import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Organizations ────────────────────────────────────────

export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organizations', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId!).single()
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
      const { data, error } = await supabase.from('organization_members').select('*').eq('organization_id', orgId!).order('role')
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}
