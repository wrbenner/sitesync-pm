import { supabase } from '../../lib/supabase'
import { transformSupabaseError } from '../client'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'

export interface AuditLogEntry {
  id: string
  project_id: string | null
  organization_id: string | null
  user_id: string | null
  user_email: string | null
  user_name: string | null
  entity_type: string
  entity_id: string
  action: 'create' | 'update' | 'delete' | 'status_change' | 'approve' | 'reject' | 'submit' | 'close'
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  changed_fields: string[] | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AuditLogFilters {
  userId?: string
  entityType?: string
  action?: AuditLogEntry['action']
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 50

export async function getAuditLog(
  projectId: string,
  filters: AuditLogFilters = {}
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  validateProjectId(projectId)
  await assertProjectAccess(projectId)

  const {
    userId,
    entityType,
    action,
    fromDate,
    toDate,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = filters

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (userId) query = query.eq('user_id', userId)
  if (entityType) query = query.eq('entity_type', entityType)
  if (action) query = query.eq('action', action)
  if (fromDate) query = query.gte('created_at', fromDate)
  if (toDate) query = query.lte('created_at', toDate)

  const { data, error, count } = await query

  if (error) throw transformSupabaseError(error)
  return { entries: (data ?? []) as AuditLogEntry[], total: count ?? 0 }
}

export async function getEntityHistory(
  projectId: string,
  entityType: string,
  entityId: string
): Promise<AuditLogEntry[]> {
  validateProjectId(projectId)
  await assertProjectAccess(projectId)

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)
  return (data ?? []) as AuditLogEntry[]
}
