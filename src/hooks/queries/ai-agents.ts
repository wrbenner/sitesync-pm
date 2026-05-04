import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── AI Agents ────────────────────────────────────────────

export function useAIAgents(projectId: string | undefined) {
  return useQuery({
    queryKey: ['ai_agents', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('ai_agents').select('*').eq('project_id' as never, projectId!).order('agent_type')
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
      let q = fromTable('ai_agent_actions').select('*').eq('project_id' as never, projectId!).order('created_at', { ascending: false })
      if (status) q = q.eq('status' as never, status)
      const { data, error } = await q.limit(50)
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
