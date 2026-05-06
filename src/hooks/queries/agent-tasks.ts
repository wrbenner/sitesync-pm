import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

// ── Types ─────────────────────────────────────────────────────────

export type AgentDomain =
  | 'schedule'
  | 'cost'
  | 'safety'
  | 'quality'
  | 'compliance'
  | 'document'
  | 'general'

export type AgentTaskStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'pending_approval'

export interface AgentTask {
  id: string
  project_id: string
  conversation_id: string | null
  user_id: string
  agent_domain: AgentDomain
  tool_name: string | null
  tool_input: Record<string, unknown> | null
  tool_output: Record<string, unknown> | null
  status: AgentTaskStatus
  error_message: string | null
  approval_required: boolean
  approved_by: string | null
  approved_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AgentTaskFilters {
  domain?: AgentDomain | 'all'
  status?: AgentTaskStatus | 'all'
}

// ── Queries ───────────────────────────────────────────────────────

// Last N tasks for the current user in a project, optionally filtered.
// Defaults to 50 per spec.
export function useAgentTasks(
  projectId: string | null | undefined,
  userId: string | null | undefined,
  filters: AgentTaskFilters = {},
  limit = 50,
) {
  const { domain = 'all', status = 'all' } = filters
  return useQuery({
    queryKey: ['agent_tasks', projectId, userId, domain, status, limit],
    queryFn: async (): Promise<AgentTask[]> => {
      if (!projectId || !userId) return []
      let q = fromTable('agent_tasks')
        .select('*')
        .eq('project_id' as never, projectId)
        .eq('user_id' as never, userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (domain !== 'all') q = q.eq('agent_domain' as never, domain)
      if (status !== 'all') q = q.eq('status' as never, status)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as AgentTask[]
    },
    enabled: !!projectId && !!userId,
  })
}

// All pending-approval tasks for the project (visible to any project
// member per the select policy). Used by the side-panel queue.
export function usePendingApprovalTasks(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['agent_tasks', 'pending_approval', projectId],
    queryFn: async (): Promise<AgentTask[]> => {
      if (!projectId) return []
      const { data, error } = await fromTable('agent_tasks')
        .select('*')
        .eq('project_id' as never, projectId)
        .eq('approval_required' as never, true)
        .eq('status' as never, 'pending_approval')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as AgentTask[]
    },
    enabled: !!projectId,
    // Short poll so newly-surfaced approvals show up without manual refresh.
    refetchInterval: 15_000,
  })
}
