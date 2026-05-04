import { useQuery, useMutation } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import {  fromTable } from '../lib/supabase'
import { transformSupabaseError } from '../api/client'
import { getEntityHistory } from '../api/endpoints/auditTrail'
import type { AuditLogEntry } from '../api/endpoints/auditTrail'
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

const AUDIT_TRAIL_PAGE_SIZE = 50

export function useAuditTrail(filters?: AuditFilters) {
  const projectId = useProjectId()
  const [page, setPage] = useState(1)
  const [accumulated, setAccumulated] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const { isPending, isError, error } = useQuery({
    queryKey: ['audit_trail', projectId, filters],
    queryFn: async () => {
      let query = fromTable('audit_trail').select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
        .range(0, AUDIT_TRAIL_PAGE_SIZE - 1)

      if (filters?.actorId) query = query.eq('actor_id', filters.actorId)
      if (filters?.entityType) query = query.eq('entity_type', filters.entityType)
      if (filters?.entityId) query = query.eq('entity_id', filters.entityId)
      if (filters?.action) query = query.eq('action', filters.action)
      if (filters?.startDate) query = query.gte('created_at', filters.startDate)
      if (filters?.endDate) query = query.lte('created_at', filters.endDate)

      const { data, error, count } = await query
      if (error) throw transformSupabaseError(error)
      const entries = (data || []) as AuditEntry[]
      setPage(1)
      setAccumulated(entries)
      setTotal(count ?? 0)
      return { entries, total: count ?? 0 }
    },
    enabled: !!projectId,
  })

  const loadMore = useCallback(async () => {
    if (!projectId || loadingMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const from = page * AUDIT_TRAIL_PAGE_SIZE
      const to = nextPage * AUDIT_TRAIL_PAGE_SIZE - 1
      let query = fromTable('audit_trail').select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters?.actorId) query = query.eq('actor_id', filters.actorId)
      if (filters?.entityType) query = query.eq('entity_type', filters.entityType)
      if (filters?.entityId) query = query.eq('entity_id', filters.entityId)
      if (filters?.action) query = query.eq('action', filters.action)
      if (filters?.startDate) query = query.gte('created_at', filters.startDate)
      if (filters?.endDate) query = query.lte('created_at', filters.endDate)

      const { data, error } = await query
      if (error) throw transformSupabaseError(error)
      setAccumulated(prev => [...prev, ...((data || []) as AuditEntry[])])
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }, [projectId, page, loadingMore, filters])

  return {
    data: accumulated,
    total,
    hasMore: accumulated.length < total,
    loadMore,
    loadingMore,
    isPending,
    isError,
    error,
  }
}

const ENTITY_HISTORY_PAGE_SIZE = 100

export function useEntityHistory(entityType: string, entityId: string) {
  const projectId = useProjectId()
  const [page, setPage] = useState(1)
  const [accumulated, setAccumulated] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const { isPending, isError, error } = useQuery({
    queryKey: ['entity_history', projectId, entityType, entityId],
    queryFn: async () => {
      const result = await getEntityHistory(projectId!, entityType, entityId, { page: 1, pageSize: ENTITY_HISTORY_PAGE_SIZE })
      setPage(1)
      setAccumulated(result.entries)
      setTotal(result.total)
      return result
    },
    enabled: !!projectId && !!entityType && !!entityId,
  })

  const loadMore = useCallback(async () => {
    if (!projectId || loadingMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const result = await getEntityHistory(projectId, entityType, entityId, { page: nextPage, pageSize: ENTITY_HISTORY_PAGE_SIZE })
      setAccumulated(prev => [...prev, ...result.entries])
      setTotal(result.total)
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }, [projectId, entityType, entityId, page, loadingMore])

  return {
    entries: accumulated,
    total,
    hasMore: accumulated.length < total,
    loadMore,
    loadingMore,
    isPending,
    isError,
    error,
  }
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

      const { error } = await fromTable('audit_trail').insert({
        project_id: projectId,
        actor_id: user?.id || null,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        entity_title: entityTitle || null,
        old_value: oldValue || null,
        new_value: newValue || null,
        user_agent: navigator.userAgent,
      } as never)
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
