import { transformSupabaseError, buildPaginatedQuery, supabaseMutation } from '../client'
import { fromTable } from '../../lib/db/queries'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { RfiRow, PaginationParams, PaginatedResult, CreateRfiPayload } from '../../types/api'

function mapRfi(r: RfiRow) {
  return {
    ...r,
    rfiNumber: r.number ? `RFI-${String(r.number).padStart(3, '0')}` : r.id?.slice(0, 8),
    from: r.created_by || 'Turner Construction',
    to: r.assigned_to || '',
    submitDate: r.created_at?.slice(0, 10) || '',
    dueDate: r.due_date || '',
  }
}

export type MappedRfi = ReturnType<typeof mapRfi>

export const getRfis = async (
  projectId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<MappedRfi>> => {
  if (pagination !== undefined && (pagination.page ?? 1) < 1) {
    throw new Error('pagination.page must be >= 1')
  }
  await assertProjectAccess(projectId)
  try {
    const result = await buildPaginatedQuery<RfiRow, MappedRfi>(
      (from, to) =>
        fromTable('rfis')
          .select('*', { count: 'exact' })
          .eq('project_id' as never, projectId)
          .order('number', { ascending: false })
          .range(from, to) as never,
      pagination,
      mapRfi
    )
    return { ...result, isEmpty: result.data.length === 0 && result.total === 0 }
  } catch (err) {
    const base = transformSupabaseError(err as never)
    base.message = 'Failed to load RFIs. Check your connection and try again.'
    throw base
  }
}
export const getRfiById = async (projectId: string, id: string) => {
  await assertProjectAccess(projectId)
  const { data, error } = await fromTable('rfis').select('*').eq('project_id' as never, projectId).eq('id' as never, id).single()
  if (error) throw transformSupabaseError(error)
  return mapRfi(data as unknown as RfiRow)
}

export const createRfi = async (projectId: string, payload: CreateRfiPayload): Promise<MappedRfi> => {
  validateProjectId(projectId)
  const data = await supabaseMutation<RfiRow>(client =>
    client.from('rfis').insert({ ...payload, project_id: projectId } as never).select().single()
  )
  return mapRfi(data)
}

export const updateRfi = async (
  projectId: string,
  id: string,
  updates: Partial<CreateRfiPayload> & { status?: string }
): Promise<MappedRfi> => {
  validateProjectId(projectId)
  const data = await supabaseMutation<RfiRow>(client =>
    client.from('rfis')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id' as never, id)
      .eq('project_id' as never, projectId)
      .select()
      .single()
  )
  return mapRfi(data)
}
