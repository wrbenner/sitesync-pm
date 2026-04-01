import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { transformSupabaseError } from '../api/client'
import { useProjectId } from './useProjectId'
import { useAuth } from './useAuth'

export interface AuditEntry {
  id: string
  project_id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_title: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

interface AuditFilters {
  actorId?: string
  entityType?: string
  entityId?: string
  action?: string
  startDate?: string
  endDate?: string
}

export function useAuditTrail(filters?: AuditFilters) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['audit_trail', projectId, filters],
    queryFn: async () => {
      let query = (supabase.from('audit_trail' as any).select('*') as any)
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })

      if (filters?.actorId) query = query.eq('actor_id', filters.actorId)
      if (filters?.entityType) query = query.eq('entity_type', filters.entityType)
      if (filters?.entityId) query = query.eq('entity_id', filters.entityId)
      if (filters?.action) query = query.eq('action', filters.action)
      if (filters?.startDate) query = query.gte('created_at', filters.startDate)
      if (filters?.endDate) query = query.lte('created_at', filters.endDate)

      query = query.limit(200)
      const { data, error } = await query
      if (error) throw transformSupabaseError(error)
      return (data || []) as AuditEntry[]
    },
    enabled: !!projectId,
  })
}

export function useWriteAudit() {
  const projectId = useProjectId()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      action, entityType, entityId, entityTitle, oldValue, newValue,
    }: {
      action: string
      entityType: string
      entityId?: string
      entityTitle?: string
      oldValue?: Record<string, unknown>
      newValue?: Record<string, unknown>
    }) => {
      if (!projectId) return

      const { error } = await (supabase.from('audit_trail' as any) as any).insert({
        project_id: projectId,
        actor_id: user?.id || null,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        entity_title: entityTitle || null,
        old_value: oldValue || null,
        new_value: newValue || null,
        user_agent: navigator.userAgent,
      })
      if (error) throw transformSupabaseError(error)
    },
  })
}

// Export audit trail to CSV
export function exportAuditTrailCSV(entries: AuditEntry[]): string {
  const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity', 'Actor ID', 'Old Value', 'New Value']
  const rows = entries.map(e => [
    new Date(e.created_at).toISOString(),
    e.action,
    e.entity_type,
    e.entity_title || e.entity_id || '',
    e.actor_id || '',
    e.old_value ? JSON.stringify(e.old_value) : '',
    e.new_value ? JSON.stringify(e.new_value) : '',
  ])

  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  return csv
}
