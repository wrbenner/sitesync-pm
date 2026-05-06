// ── useRFIResponses ─────────────────────────────────────────────────────
// Query + mutate hooks for rfi_responses with the P1b additions:
//   • Edit (≤ 24-hr window for own response, unrestricted for admin).
//     Edits trigger the DB-side `fn_rfi_responses_capture_version` trigger
//     which snapshots the OLD body into `rfi_responses_versions`.
//   • Soft-delete via `deleted_at`. RLS hides deleted rows except for
//     the author and project admin/owner.
//   • Toggle `is_official` (PermissionGate `rfis.edit`).
//   • Composer hands `response_type`, `is_internal`, and a parsed
//     `mentioned_user_ids[]` from the @-mention scan.
//
// All mutations write per-row audit_log entries.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { logAuditEntry } from '../../lib/auditLogger'

// rfi_responses_versions was added by 20260507000001_rfi_p1b_workflow_depth.sql.
// Until db-types regenerates, collapse the table-name union via `as never`
// (same pattern as src/hooks/mutations/rfis.ts).
const from = (table: string) => fromTable(table as never)

export type RFIResponseType =
  | 'answered'
  | 'approved_as_noted'
  | 'revise_and_resubmit'
  | 'returned_for_clarification'
  | 'answered_with_cost_impact'
  | 'no_comment'
  | 'forwarded'

export const RESPONSE_TYPES: { value: RFIResponseType; label: string; color: string }[] = [
  { value: 'answered', label: 'Answered', color: '#2D8A6E' },
  { value: 'approved_as_noted', label: 'Approved as Noted', color: '#0E7C66' },
  { value: 'revise_and_resubmit', label: 'Revise & Resubmit', color: '#C4850C' },
  { value: 'returned_for_clarification', label: 'Returned for Clarification', color: '#B8472E' },
  { value: 'answered_with_cost_impact', label: 'Answered (Cost Impact)', color: '#C93B3B' },
  { value: 'no_comment', label: 'No Comment', color: '#8C857E' },
  { value: 'forwarded', label: 'Forwarded', color: '#4F46E5' },
]

export interface RFIResponseRow {
  id: string
  rfi_id: string
  author_id: string | null
  content: string
  attachments: unknown
  response_type: RFIResponseType | null
  is_official: boolean | null
  is_internal: boolean | null
  deleted_at: string | null
  edited_at: string | null
  mentioned_user_ids: string[] | null
  created_at: string | null
}

const queryKey = (rfiId: string | undefined) => ['rfi_responses', rfiId]

/**
 * Edit window for own responses: 24 h from creation. Admin can edit
 * beyond. Surface this as a derived flag on the row so the UI can hide
 * the kebab when the window has closed for non-admin authors.
 */
export const RESPONSE_EDIT_WINDOW_HOURS = 24

export function isWithinEditWindow(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return false
  return Date.now() - created < RESPONSE_EDIT_WINDOW_HOURS * 60 * 60 * 1000
}

export function useRFIResponsesList(rfiId: string | undefined) {
  return useQuery({
    queryKey: queryKey(rfiId),
    queryFn: async () => {
      if (!rfiId) return []
      const { data, error } = await from('rfi_responses')
        .select('*')
        .eq('rfi_id' as never, rfiId)
        .order('created_at' as never, { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as RFIResponseRow[]
    },
    enabled: !!rfiId,
  })
}

interface CreateResponseParams {
  rfiId: string
  projectId: string
  content: string
  responseType?: RFIResponseType
  isOfficial?: boolean
  isInternal?: boolean
  mentionedUserIds?: string[]
}

export function useCreateRFIResponseFull() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: CreateResponseParams) => {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        rfi_id: params.rfiId,
        author_id: user?.id ?? null,
        content: params.content,
        response_type: params.responseType ?? 'answered',
        is_official: params.isOfficial ?? false,
        is_internal: params.isInternal ?? false,
        mentioned_user_ids: params.mentionedUserIds ?? [],
      }
      const { data, error } = await from('rfi_responses')
        .insert(payload as never)
        .select()
        .single()
      if (error) throw error
      const inserted = data as unknown as RFIResponseRow
      // RFI-level audit row (the rfi_responses INSERT also fires a DB
      // audit trigger; this client-side row enriches metadata).
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: { response_id: inserted.id, type: payload.response_type, internal: payload.is_internal },
        metadata: { kind: 'response_create', mention_count: payload.mentioned_user_ids.length },
      })
      return inserted
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId) })
      queryClient.invalidateQueries({ queryKey: ['rfis', 'detail', vars.rfiId] })
    },
  })
}

interface EditResponseParams {
  responseId: string
  rfiId: string
  projectId: string
  content?: string
  responseType?: RFIResponseType
  isOfficial?: boolean
  isInternal?: boolean
}

export function useEditRFIResponse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: EditResponseParams) => {
      const patch: Record<string, unknown> = {}
      if (params.content != null) patch.content = params.content
      if (params.responseType != null) patch.response_type = params.responseType
      if (params.isOfficial != null) patch.is_official = params.isOfficial
      if (params.isInternal != null) patch.is_internal = params.isInternal
      const { error } = await from('rfi_responses')
        .update(patch as never)
        .eq('id' as never, params.responseId)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: { response_id: params.responseId, ...patch },
        metadata: { kind: 'response_edit' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId) })
      queryClient.invalidateQueries({ queryKey: ['rfis', 'detail', vars.rfiId] })
    },
  })
}

interface DeleteResponseParams {
  responseId: string
  rfiId: string
  projectId: string
}

export function useSoftDeleteRFIResponse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: DeleteResponseParams) => {
      const { error } = await from('rfi_responses')
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq('id' as never, params.responseId)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'delete',
        beforeState: { response_id: params.responseId },
        metadata: { kind: 'response_soft_delete' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId) })
      queryClient.invalidateQueries({ queryKey: ['rfis', 'detail', vars.rfiId] })
    },
  })
}

export function useRFIResponseVersions(responseId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_response_versions', responseId],
    queryFn: async () => {
      if (!responseId) return []
      const { data, error } = await from('rfi_responses_versions')
        .select('*')
        .eq('response_id' as never, responseId)
        .order('edited_at' as never, { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Array<{
        id: string
        response_id: string
        body: string
        edited_by: string | null
        edited_at: string
      }>
    },
    enabled: !!responseId,
  })
}
