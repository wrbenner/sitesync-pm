import { transformSupabaseError, buildPaginatedQuery, supabaseMutation } from '../client'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import { submittalService } from '../../services/submittalService'
import type {
  SubmittalRow,
  PaginationParams,
  PaginatedResult,
  CreateSubmittalPayload,
  SubmittalRevision,
  CreateSubmittalRevisionPayload,
} from '../../types/api'
import type { Database } from '../../types/database'
import type {
  SubmittalFilter,
  BulkUpdateInput,
  SubmittalDisposition,
} from '../../types/submittal'

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
      fromTable('submittals')
        .select('*', { count: 'exact' })
        .eq('project_id' as never, projectId)
        .order('number', { ascending: false })
        .range(from, to),
    pagination,
    mapSubmittal
  )
}
export const getSubmittalById = async (projectId: string, id: string) => {
  await assertProjectAccess(projectId)
  const { data, error } = await fromTable('submittals').select('*').eq('project_id' as never, projectId).eq('id' as never, id).single()
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
      .eq('id' as never, id)
      .eq('project_id' as never, projectId)
      .select()
      .single()
  )
  return mapSubmittal(data)
}

export const getSubmittalRevisions = async (submittalId: string): Promise<SubmittalRevision[]> => {
  const { data, error } = await fromTable('submittal_revisions')
    .select('*')
    .eq('submittal_id' as never, submittalId)
    .order('revision_number', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return data as unknown as SubmittalRevision[]
}

export const createSubmittalRevision = async (
  submittalId: string,
  payload: CreateSubmittalRevisionPayload
): Promise<SubmittalRevision> => {
  const { data: existing, error: fetchError } = await fromTable('submittal_revisions')
    .select('revision_number')
    .eq('submittal_id' as never, submittalId)
    .order('revision_number', { ascending: false })
    .limit(1)
  if (fetchError) throw transformSupabaseError(fetchError)

  const nextRevision =
    existing && existing.length > 0
      ? (existing[0] as { revision_number: number }).revision_number + 1
      : 1

  const { data, error } = await fromTable('submittal_revisions')
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
    } as never)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as unknown as SubmittalRevision
}

export const updateRevisionReview = async (
  revisionId: string,
  status: SubmittalRevision['review_status'],
  comments: string | null = null
): Promise<SubmittalRevision> => {
  const { data, error } = await fromTable('submittal_revisions')
    .update({
      review_status: status,
      review_comments: comments,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq('id' as never, revisionId)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as unknown as SubmittalRevision
}

/** Returns the reviewer_role of the latest pending revision, or null if none. */
export function getBallInCourt(revisions: SubmittalRevision[]): 'gc' | 'architect' | 'engineer' | null {
  const latestPending = [...revisions]
    .sort((a, b) => b.revision_number - a.revision_number)
    .find(r => r.review_status === 'pending')
  return latestPending?.reviewer_role ?? null
}

// ── D38: bulk + filter + search + spec-import + closeout ─────────────────────
// Each endpoint is a thin wrapper that delegates to submittalService (RPC-
// backed) or composes a typed Supabase query. assertProjectAccess gates
// every read; mutations rely on RLS for the final wall.

export const bulkUpdateSubmittals = async (
  projectId: string,
  input: BulkUpdateInput,
): Promise<{ count: number }> => {
  await assertProjectAccess(projectId)
  const result = await submittalService.bulkUpdate(input.ids, input.updates)
  if (result.error) throw new Error(result.error.message)
  return result.data ?? { count: 0 }
}

/**
 * Filter + search across submittals_log_mv. Server-side filters; client gets
 * the denormalised log shape (sub_name, current_reviewer_name,
 * days_in_court, risk_band).
 */
export const filterSubmittals = async (
  projectId: string,
  filter: SubmittalFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<Record<string, unknown>>> => {
  await assertProjectAccess(projectId)
  return buildPaginatedQuery<Record<string, unknown>, Record<string, unknown>>(
    (from, to) => {
      let q = fromTable('submittals_log_mv')
        .select('*', { count: 'exact' })
        .eq('project_id' as never, projectId)
      if (filter.status?.length) q = q.in('status' as never, filter.status)
      if (filter.kind?.length) q = q.in('kind' as never, filter.kind)
      if (filter.csi_section?.length) q = q.in('csi_section' as never, filter.csi_section)
      if (filter.responsible_sub_id?.length)
        q = q.in('responsible_sub_id' as never, filter.responsible_sub_id)
      if (filter.current_reviewer_id?.length)
        q = q.in('current_reviewer_id' as never, filter.current_reviewer_id)
      if (filter.is_critical_path !== undefined)
        q = q.eq('is_critical_path' as never, filter.is_critical_path)
      if (filter.is_overdue) q = q.eq('risk_band' as never, 'overdue')
      if (filter.required_on_site_within_days !== undefined) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() + filter.required_on_site_within_days)
        q = q.lte('required_on_site_date' as never, cutoff.toISOString().slice(0, 10))
      }
      if (filter.has_iris_preflight_finding === true)
        q = q.not('iris_preflight_findings' as never, 'is', null)
      if (filter.has_iris_preflight_finding === false)
        q = q.is('iris_preflight_findings' as never, null)
      return q.order('number', { ascending: false }).range(from, to)
    },
    pagination,
  )
}

export const searchSubmittals = async (
  projectId: string,
  query: string,
  pagination?: PaginationParams,
): Promise<PaginatedResult<Record<string, unknown>>> => {
  await assertProjectAccess(projectId)
  const q = query.trim()
  if (!q) return filterSubmittals(projectId, {}, pagination)
  return buildPaginatedQuery<Record<string, unknown>, Record<string, unknown>>(
    (from, to) =>
      fromTable('submittals_log_mv')
        .select('*', { count: 'exact' })
        .eq('project_id' as never, projectId)
        .or(`title.ilike.%${q}%,csi_section.ilike.%${q}%,number.ilike.%${q}%,sub_name.ilike.%${q}%`)
        .order('number', { ascending: false })
        .range(from, to),
    pagination,
  )
}

/**
 * Records the disposition of a single reviewer row. Wraps the D37 RPC.
 */
export const recordDisposition = async (
  reviewerId: string,
  disposition: SubmittalDisposition,
  comment?: string,
  stampUrl?: string,
): Promise<void> => {
  const result = await submittalService.recordDisposition(reviewerId, disposition, comment, stampUrl)
  if (result.error) throw new Error(result.error.message)
}

export const distributeSubmittal = async (
  submittalId: string,
  toUserIds: string[],
): Promise<void> => {
  const result = await submittalService.distribute(submittalId, toUserIds)
  if (result.error) throw new Error(result.error.message)
}

export const closeSubmittal = async (
  submittalId: string,
  reason?: string,
): Promise<void> => {
  const result = await submittalService.close(submittalId, reason)
  if (result.error) throw new Error(result.error.message)
}

/**
 * Stage a spec-book PDF for the spec-import flow (P1-D43+). The endpoint is
 * a thin wrapper around storage upload — the server-side chunking + Iris
 * extraction lives in a separate edge function not included in this PR.
 */
export const stageSpecImport = async (
  projectId: string,
  file: File,
): Promise<{ storage_path: string }> => {
  validateProjectId(projectId)
  const storagePath = `${projectId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('submittal-specs').upload(storagePath, file)
  if (error) throw new Error(error.message)
  return { storage_path: storagePath }
}

/**
 * Generate the closeout binder index (P4 surface). Returns the list of
 * submittals tagged for closeout grouped by CSI division. The actual PDF +
 * COBie ZIP generation lives in a separate edge function (P4-D66).
 */
export const generateCloseoutIndex = async (
  projectId: string,
): Promise<Array<{ csi_division: string | null; items: Record<string, unknown>[] }>> => {
  await assertProjectAccess(projectId)
  const { data, error } = await fromTable('submittals_log_mv')
    .select('*')
    .eq('project_id' as never, projectId)
    .in('kind' as never, ['warranty', 'closeout', 'maintenance'])
  if (error) throw transformSupabaseError(error)

  const groups = new Map<string, Record<string, unknown>[]>()
  for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const div = (row.csi_division as string | null) ?? '00'
    const list = groups.get(div) ?? []
    list.push(row)
    groups.set(div, list)
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([csi_division, items]) => ({ csi_division, items }))
}
