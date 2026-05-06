import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import type { AgentDomain, AgentTask, AgentTaskStatus } from '../queries/agent-tasks'

// ── Inputs ────────────────────────────────────────────────────────

export interface CreateAgentTaskInput {
  project_id: string
  user_id: string
  conversation_id?: string | null
  agent_domain: AgentDomain
  tool_name?: string | null
  tool_input?: Record<string, unknown> | null
  tool_output?: Record<string, unknown> | null
  status?: AgentTaskStatus
  approval_required?: boolean
  error_message?: string | null
  started_at?: string | null
  completed_at?: string | null
}

// ── Create ────────────────────────────────────────────────────────
// Used for every Iris turn. Non-blocking by design: the chat UI must
// not wait on this and must swallow the error path silently (aside
// from console.debug). We still expose the promise for callers that
// want to await it.
export function useCreateAgentTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateAgentTaskInput): Promise<AgentTask> => {
      const { data, error } = await fromTable('agent_tasks')
        .insert({
          project_id: input.project_id,
          user_id: input.user_id,
          conversation_id: input.conversation_id ?? null,
          agent_domain: input.agent_domain,
          tool_name: input.tool_name ?? null,
          tool_input: input.tool_input ?? null,
          tool_output: input.tool_output ?? null,
          status: input.status ?? 'succeeded',
          approval_required: input.approval_required ?? false,
          error_message: input.error_message ?? null,
          started_at: input.started_at ?? null,
          completed_at: input.completed_at ?? null,
        } as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as AgentTask
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['agent_tasks', task.project_id] })
      if (task.approval_required && task.status === 'pending_approval') {
        queryClient.invalidateQueries({ queryKey: ['agent_tasks', 'pending_approval', task.project_id] })
      }
    },
  })
}

// ── Approve ───────────────────────────────────────────────────────
// Runs the task's stored mutation through agent-orchestrator's
// executeAction path. On success, marks the row succeeded and stamps
// approved_by / approved_at. On failure, marks it failed with the
// error message.
export function useApproveAgentTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { task: AgentTask; approverId: string }) => {
      const { task, approverId } = params
      if (!task.tool_name) {
        throw new Error('Task has no tool_name to execute')
      }

      const startedAt = new Date().toISOString()
      await fromTable('agent_tasks')
        .update({ status: 'running', started_at: startedAt } as never)
        .eq('id' as never, task.id)

      let orchestratorResult: Record<string, unknown> | null = null
      let execError: Error | null = null
      try {
        const { data, error } = await supabase.functions.invoke('agent-orchestrator', {
          body: {
            executeAction: {
              actionId: task.id,
              tool: task.tool_name,
              input: task.tool_input ?? {},
              domain: task.agent_domain,
            },
            projectContext: { projectId: task.project_id },
          },
        })
        if (error) throw new Error(error.message)
        orchestratorResult = (data as unknown as Record<string, unknown> | null) ?? null
      } catch (e) {
        execError = e instanceof Error ? e : new Error(String(e))
      }

      const completedAt = new Date().toISOString()
      const updates = execError
        ? {
            status: 'failed',
            error_message: execError.message,
            completed_at: completedAt,
          }
        : {
            status: 'succeeded',
            tool_output: orchestratorResult,
            approved_by: approverId,
            approved_at: completedAt,
            completed_at: completedAt,
          }
      const { error: updateError } = await fromTable('agent_tasks')
        .update(updates as never)
        .eq('id' as never, task.id)
      if (updateError) throw updateError
      if (execError) throw execError
      return orchestratorResult
    },
    onSuccess: (_data, { task }) => {
      toast.success('Action approved and executed')
      queryClient.invalidateQueries({ queryKey: ['agent_tasks', task.project_id] })
      queryClient.invalidateQueries({ queryKey: ['agent_tasks', 'pending_approval', task.project_id] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to execute approved action')
    },
  })
}

// ── Reject ────────────────────────────────────────────────────────
// Moves a pending-approval task to cancelled. Recorded for audit; does
// not touch the orchestrator.
export function useRejectAgentTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (task: AgentTask) => {
      const { error } = await fromTable('agent_tasks')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() } as never)
        .eq('id' as never, task.id)
      if (error) throw error
      return task
    },
    onSuccess: (task) => {
      toast.success('Action dismissed')
      queryClient.invalidateQueries({ queryKey: ['agent_tasks', task.project_id] })
      queryClient.invalidateQueries({ queryKey: ['agent_tasks', 'pending_approval', task.project_id] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to dismiss action')
    },
  })
}
