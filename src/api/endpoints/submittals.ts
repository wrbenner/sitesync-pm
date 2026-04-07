import { supabase, transformSupabaseError, buildPaginatedQuery, supabaseMutation } from '../client'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type {
  SubmittalRow,
  PaginationParams,
  PaginatedResult,
  CreateSubmittalPayload,
  SubmittalRevision,
  CreateSubmittalRevisionPayload,
} from '../../types/api'
import type { Database } from '../../types/database'

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
    client.from('submittals').insert({ ...payload, project_id: projectId } as Database['public']['Tables']['submittals']['Insert']).select().single()
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
    client.from('submittals')
      .update({ ...updates, updated_at: new Date().toISOString() } as Database['public']['Tables']['submittals']['Update'])
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single()
  )
  return mapSubmittal(data)
}

export const getSubmittalRevisions = async (submittalId: string): Promise<SubmittalRevision[]> => {
  const { data, error } = await supabase
    .from('submittal_revisions')
    .select('*')
    .eq('submittal_id', submittalId)
    .order('revision_number', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return data as SubmittalRevision[]
}

export const createSubmittalRevision = async (
  submittalId: string,
  payload: CreateSubmittalRevisionPayload
): Promise<SubmittalRevision> => {
  const { data: existing, error: fetchError } = await supabase
    .from('submittal_revisions')
    .select('revision_number')
    .eq('submittal_id', submittalId)
    .order('revision_number', { ascending: false })
    .limit(1)
  if (fetchError) throw transformSupabaseError(fetchError)

  const nextRevision =
    existing && existing.length > 0
      ? (existing[0] as { revision_number: number }).revision_number + 1
      : 1

  const { data, error } = await supabase
    .from('submittal_revisions')
    .insert({
      submittal_id: submittalId,
      revision_number: nextRevision,
      submitted_by: payload.submitted_by,
      submitted_at: new Date().toISOString(),
      reviewer_id: payload.reviewer_id ?? null,
      reviewer_role: payload.reviewer_role,
      review_status: 'pending',
      review_comments: null,
      reviewed_at: null,
      file_urls: payload.file_urls ?? [],
    })
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as SubmittalRevision
}

export const updateRevisionReview = async (
  revisionId: string,
  status: SubmittalRevision['review_status'],
  comments: string | null = null
): Promise<SubmittalRevision> => {
  const { data, error } = await supabase
    .from('submittal_revisions')
    .update({
      review_status: status,
      review_comments: comments,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', revisionId)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as SubmittalRevision
}

/** Returns the reviewer_role of the latest pending revision, or null if none. */
export function getBallInCourt(revisions: SubmittalRevision[]): 'gc' | 'architect' | 'engineer' | null {
  const latestPending = [...revisions]
    .sort((a, b) => b.revision_number - a.revision_number)
    .find(r => r.review_status === 'pending')
  return latestPending?.reviewer_role ?? null
}
