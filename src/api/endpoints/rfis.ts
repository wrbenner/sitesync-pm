import { supabase, transformSupabaseError, buildPaginatedQuery, supabaseMutation } from '../client'
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
  if (pagination !== undefined && pagination.page < 1) {
    throw new Error('pagination.page must be >= 1')
  }
  await assertProjectAccess(projectId)
  try {
    return await buildPaginatedQuery<RfiRow, MappedRfi>(
      (from, to) =>
        supabase
          .from('rfis')
          .select('*', { count: 'exact' })
          .eq('project_id', projectId)
          .order('number', { ascending: false })
          .range(from, to),
      pagination,
      mapRfi
    )
  } catch (err) {
    throw transformSupabaseError(err)
  }
}
export const getRfiById = async (projectId: string, id: string) => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase.from('rfis').select('*').eq('project_id', projectId).eq('id', id).single()
  if (error) throw transformSupabaseError(error)
  return mapRfi(data)
}

export const createRfi = async (projectId: string, payload: CreateRfiPayload): Promise<MappedRfi> => {
  validateProjectId(projectId)
  const data = await supabaseMutation<RfiRow>(client =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('rfis') as any).insert({ ...payload, project_id: projectId }).select().single()
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('rfis') as any)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single()
  )
  return mapRfi(data)
}
