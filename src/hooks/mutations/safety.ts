import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'



import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Safety ───────────────────────────────────────────────

export function useCreateCorrectiveAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('corrective_actions').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['corrective_actions', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['safety_overview', result.projectId] }) // FIX #7: cross-invalidate
      queryClient.invalidateQueries({ queryKey: ['project_snapshots', result.projectId] })
      posthog.capture('corrective_action_created', { project_id: result.projectId })
    },
    onError: createOnError('create_corrective_action'),
  })
}

export function useUpdateCorrectiveAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates, projectId }: { id: string; updates: Record<string, unknown>; projectId: string }) => {
      const { error } = await from('corrective_actions').update(updates).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['corrective_actions', result.projectId] })
      posthog.capture('corrective_action_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_corrective_action'),
  })
}

export function useCreateSafetyInspection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('safety_inspections').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['safety_inspections', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['safety_overview', result.projectId] }) // FIX #7
      queryClient.invalidateQueries({ queryKey: ['corrective_actions', result.projectId] })
      posthog.capture('safety_inspection_created', { project_id: result.projectId })
    },
    onError: createOnError('create_safety_inspection'),
  })
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('incidents').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['safety_overview', result.projectId] }) // FIX #7
      queryClient.invalidateQueries({ queryKey: ['daily_logs', result.projectId] }) // Incidents affect daily logs
      queryClient.invalidateQueries({ queryKey: ['project_snapshots', result.projectId] })
      posthog.capture('incident_reported', { project_id: result.projectId })
    },
    onError: createOnError('create_incident'),
  })
}
