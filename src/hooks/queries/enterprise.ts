import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'



// ── Enterprise ───────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data, error } = await fromTable('integrations').select('*').order('type')
      if (error) throw error
      return data
    },
  })
}

export function useIntegrationSyncLog(integrationId: string | undefined) {
  return useQuery({
    queryKey: ['integration_sync_log', integrationId],
    queryFn: async () => {
      const { data, error } = await fromTable('integration_sync_log')
        .select('*')
        .eq('integration_id' as never, integrationId!)
        .order('completed_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!integrationId,
  })
}

export function useCustomReports(projectId: string | undefined) {
  return useQuery({
    queryKey: ['custom_reports', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('custom_reports').select('*').or(`project_id.eq.${projectId},is_template.eq.true`).order('name')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useSustainabilityMetrics(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sustainability_metrics', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('sustainability_metrics').select('*').eq('project_id' as never, projectId!).order('category')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWasteLogs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['waste_logs', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('waste_logs').select('*').eq('project_id' as never, projectId!).order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWarranties(projectId: string | undefined) {
  return useQuery({
    queryKey: ['warranties', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('warranties').select('*').eq('project_id' as never, projectId!).order('expiration_date')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWarrantyClaims(projectId: string | undefined) {
  return useQuery({
    queryKey: ['warranty_claims', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('warranty_claims').select('*').eq('project_id' as never, projectId!).order('claim_date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
