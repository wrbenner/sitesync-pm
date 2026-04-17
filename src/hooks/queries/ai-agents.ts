import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── AI Agents ────────────────────────────────────────────

export function useAIAgents(projectId: string | undefined) {
  return useQuery({
    queryKey: ['ai_agents', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_agents').select('*').eq('project_id', projectId!).order('agent_type')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useAIAgentActions(projectId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['ai_agent_actions', projectId, status],
    queryFn: async () => {
      let q = supabase.from('ai_agent_actions').select('*').eq('project_id', projectId!).order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q.limit(50)
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
