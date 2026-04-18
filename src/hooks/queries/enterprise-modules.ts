import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuditedMutation } from '../mutations/createAuditedMutation'
import { contractSchema } from '../../components/forms/schemas'

// ── Contracts ─────────────────────────────────────────────
// useContracts is re-exported from financials.ts — do not redeclare here.

export function useCreateContract() {
  return useAuditedMutation<Record<string, unknown>, unknown>({
    permission: 'project.settings',
    schema: contractSchema.partial().required({ title: true, counterparty_name: true }),
    action: 'create',
    entityType: 'contract',
    getEntityTitle: (p) => (p.title as string) || undefined,
    getAfterState: (p) => p,
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from('contracts').insert(payload).select().single()
      if (error) throw error
      return data
    },
    invalidateKeys: (p) => [['contracts', p.project_id as string]],
    analyticsEvent: 'contract_created',
    errorMessage: 'Failed to create contract',
  })
}

export function useUpdateContract() {
  return useAuditedMutation<{ id: string; projectId: string; updates: Record<string, unknown> }, unknown>({
    permission: 'project.settings',
    schema: contractSchema.partial(),
    schemaKey: 'updates',
    action: 'update',
    entityType: 'contract',
    getEntityId: (p) => p.id,
    getAfterState: (p) => p.updates,
    mutationFn: async (params) => {
      const { data, error } = await supabase
        .from('contracts')
        .update(params.updates)
        .eq('id', params.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    invalidateKeys: (p) => [['contracts', p.projectId]],
    analyticsEvent: 'contract_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update contract',
  })
}

export function useDeleteContract() {
  return useAuditedMutation<{ id: string; projectId: string }, { id: string; projectId: string }>({
    permission: 'project.settings',
    action: 'delete',
    entityType: 'contract',
    getEntityId: (p) => p.id,
    mutationFn: async (params) => {
      const { error } = await supabase.from('contracts').delete().eq('id', params.id)
      if (error) throw error
      return { id: params.id, projectId: params.projectId }
    },
    invalidateKeys: (p) => [['contracts', p.projectId]],
    analyticsEvent: 'contract_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete contract',
  })
}

// ── Transmittals ──────────────────────────────────────────

export function useTransmittals(projectId: string | undefined) {
  return useQuery({
    queryKey: ['transmittals', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transmittals')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useCreateTransmittal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.from('transmittals').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['transmittals', (vars as Record<string, unknown>).project_id] })
    },
  })
}

// ── Closeout Items ────────────────────────────────────────

export function useCloseoutItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['closeout_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closeout_items')
        .select('*')
        .eq('project_id', projectId!)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useCreateCloseoutItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.from('closeout_items').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', (vars as Record<string, unknown>).project_id] })
    },
  })
}

export function useUpdateCloseoutStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('closeout_items')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['closeout_items'] })
    },
  })
}

// ── Pre-Task Plans ────────────────────────────────────────

export function usePreTaskPlans(projectId: string | undefined) {
  return useQuery({
    queryKey: ['pre_task_plans', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pre_task_plans')
        .select('*')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useCreatePreTaskPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.from('pre_task_plans').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pre_task_plans', (vars as Record<string, unknown>).project_id] })
    },
  })
}

// ── Specifications ────────────────────────────────────────

export function useSpecifications(projectId: string | undefined) {
  return useQuery({
    queryKey: ['specifications', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specifications')
        .select('*')
        .eq('project_id', projectId!)
        .order('section_number')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useCreateSpecification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.from('specifications').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['specifications', (vars as Record<string, unknown>).project_id] })
    },
  })
}
