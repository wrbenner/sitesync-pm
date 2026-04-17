import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Workforce ────────────────────────────────────────────

export function useWorkforceMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['workforce_members', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('workforce_members').select('*').eq('project_id', projectId!).order('name')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useTimeEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['time_entries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('time_entries').select('*').eq('project_id', projectId!).order('date', { ascending: false }).limit(100)
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
