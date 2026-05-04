import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { transformSupabaseError } from '../errors'
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
  /** SHA-256 of the prior chain entry (null for the first row of a chain). */
  previous_hash?: string | null
  /** SHA-256 of this row's canonical payload — the cryptographic seal. */
  entry_hash?: string | null
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

  let query = fromTable('audit_log')
    .select('*', { count: 'exact' })
    .eq('project_id' as never, projectId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (userId) query = query.eq('user_id' as never, userId)
  if (entityType) query = query.eq('entity_type' as never, entityType)
  if (action) query = query.eq('action' as never, action)
  if (fromDate) query = query.gte('created_at' as never, fromDate)
  if (toDate) query = query.lte('created_at' as never, toDate)

  const { data, error, count } = await query

  if (error) throw transformSupabaseError(error)
  return { entries: (data ?? []) as unknown as AuditLogEntry[], total: count ?? 0 }
}

const DEFAULT_ENTITY_HISTORY_PAGE_SIZE = 100

export async function getEntityHistory(
  projectId: string,
  entityType: string,
  entityId: string,
  params: { page?: number; pageSize?: number } = {}
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  validateProjectId(projectId)
  await assertProjectAccess(projectId)

  const page = params.page ?? 1
  const pageSize = params.pageSize ?? DEFAULT_ENTITY_HISTORY_PAGE_SIZE

  const { data, error, count } = await fromTable('audit_log')
    .select('*', { count: 'exact' })
    .eq('project_id' as never, projectId)
    .eq('entity_type' as never, entityType)
    .eq('entity_id' as never, entityId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) throw transformSupabaseError(error)
  return { entries: (data ?? []) as unknown as AuditLogEntry[], total: count ?? 0 }
}
