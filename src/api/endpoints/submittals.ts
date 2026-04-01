import { supabase, transformSupabaseError, buildPaginatedQuery, supabaseMutation } from '../client'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { SubmittalRow, PaginationParams, PaginatedResult, CreateSubmittalPayload } from '../../types/api'

function mapSubmittal(s: SubmittalRow) {
  return {
    ...s,
    submittalNumber: s.number ? `SUB-${String(s.number).padStart(3, '0')}` : s.id?.slice(0, 8),
    from: s.subcontractor || s.created_by || 'Contractor',
    dueDate: s.due_date || '',
  }
}

export type MappedSubmittal = ReturnType<typeof mapSubmittal>

export const getSubmittals = async (
  projectId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<MappedSubmittal>> => {
  await assertProjectAccess(projectId)
  return buildPaginatedQuery<SubmittalRow, MappedSubmittal>(
    (from, to) =>
      supabase
        .from('submittals')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .order('number', { ascending: false })
        .range(from, to),
    pagination,
    mapSubmittal
  )
}
export const getSubmittalById = async (projectId: string, id: string) => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase.from('submittals').select('*').eq('project_id', projectId).eq('id', id).single()
  if (error) throw transformSupabaseError(error)
  return mapSubmittal(data)
}

export const createSubmittal = async (projectId: string, payload: CreateSubmittalPayload): Promise<MappedSubmittal> => {
  validateProjectId(projectId)
  const data = await supabaseMutation<SubmittalRow>(client =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('submittals') as any).insert({ ...payload, project_id: projectId }).select().single()
  )
  return mapSubmittal(data)
}

export const updateSubmittal = async (
  projectId: string,
  id: string,
  updates: Partial<CreateSubmittalPayload> & { status?: string }
): Promise<MappedSubmittal> => {
  validateProjectId(projectId)
  const data = await supabaseMutation<SubmittalRow>(client =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('submittals') as any)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single()
  )
  return mapSubmittal(data)
}
