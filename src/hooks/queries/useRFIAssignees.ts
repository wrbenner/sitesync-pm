// ── useRFIAssignees ─────────────────────────────────────────────────────
// Read + add + remove + mark-responded for the new `rfi_assignees` table
// (P1b deliverable #3).
//
// Behavior:
//   • One row per assigned user. `responded_at`/`response_id` track who
//     has cleared their checkbox.
//   • `rfis.ball_in_court` is auto-recomputed by trigger to be the
//     earliest-created unresponded assignee.
//   • Each mutation writes a per-row audit_log entry.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { logAuditEntry } from '../../lib/auditLogger'

// rfi_assignees was added by 20260507000001_rfi_p1b_workflow_depth.sql.
// Until db-types regenerates, collapse the table-name union via `as never`
// (same pattern as src/hooks/mutations/rfis.ts).
const from = (table: string) => fromTable(table as never)

export interface RFIAssignee {
  id: string
  rfi_id: string
  user_id: string
  role: string | null
  responded_at: string | null
  response_id: string | null
  created_by: string | null
  created_at: string
}

const queryKey = (rfiId: string | undefined) => ['rfi_assignees', rfiId]

export function useRFIAssignees(rfiId: string | undefined) {
  return useQuery({
    queryKey: queryKey(rfiId),
    queryFn: async () => {
      if (!rfiId) return []
      const { data, error } = await from('rfi_assignees')
        .select('*')
        .eq('rfi_id' as never, rfiId)
        .order('created_at' as never, { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as RFIAssignee[]
    },
    enabled: !!rfiId,
  })
}

export function useAddRFIAssignee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { rfiId: string; projectId: string; userId: string; role?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await from('rfi_assignees')
        .insert({
          rfi_id: params.rfiId,
          user_id: params.userId,
          role: params.role ?? null,
          created_by: user?.id ?? null,
        } as never)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: { assignee_added: params.userId },
        metadata: { kind: 'assignee_add' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId) })
      queryClient.invalidateQueries({ queryKey: ['rfis', 'detail', vars.rfiId] })
      queryClient.invalidateQueries({ queryKey: ['rfis', vars.projectId] })
    },
  })
}

export function useRemoveRFIAssignee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { rfiId: string; projectId: string; userId: string }) => {
      const { error } = await from('rfi_assignees')
        .delete()
        .eq('rfi_id' as never, params.rfiId)
        .eq('user_id' as never, params.userId)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        beforeState: { assignee_removed: params.userId },
        metadata: { kind: 'assignee_remove' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId) })
      queryClient.invalidateQueries({ queryKey: ['rfis', 'detail', vars.rfiId] })
      queryClient.invalidateQueries({ queryKey: ['rfis', vars.projectId] })
    },
  })
}

export function useToggleRFIAssigneeResponded() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      assigneeId: string
      rfiId: string
      projectId: string
      responded: boolean
      responseId?: string | null
    }) => {
      const patch = params.responded
        ? { responded_at: new Date().toISOString(), response_id: params.responseId ?? null }
        : { responded_at: null, response_id: null }
      const { error } = await from('rfi_assignees')
        .update(patch as never)
        .eq('id' as never, params.assigneeId)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: { assignee_responded: params.responded, assignee_id: params.assigneeId },
        metadata: { kind: 'assignee_response_toggle' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId) })
      queryClient.invalidateQueries({ queryKey: ['rfis', 'detail', vars.rfiId] })
      queryClient.invalidateQueries({ queryKey: ['rfis', vars.projectId] })
    },
  })
}
