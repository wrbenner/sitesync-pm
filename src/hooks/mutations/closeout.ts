import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadProjectFile } from '../../lib/storage'

// Most closeout mutations already live in ../queries/closeout.ts — re-export
// them so consumers can pull everything they need from one mutations module.
export {
  useCreateCloseoutItem,
  useTransitionCloseoutStatus,
  useUpdateCloseoutItem,
  useDeleteCloseoutItem,
  useUploadCloseoutDoc,
  useGenerateCloseoutList,
} from '../queries/closeout'

// ── Toggle complete / incomplete ───────────────────────────
// Training and similar boolean-style items flip between 'approved' and
// 'required'. Completing sets completed_date; reopening clears it.

export function useToggleCloseoutItemComplete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      projectId: _projectId,
      complete,
    }: {
      id: string
      projectId: string
      complete: boolean
    }) => {
      const updates: Record<string, unknown> = {
        status: complete ? 'approved' : 'required',
        completed_date: complete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('closeout_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', vars.projectId] })
    },
  })
}

// ── Upload O&M Manual ──────────────────────────────────────
// Uploads the file to the project-files storage bucket and inserts a
// closeout_items row (category='om_manual') referencing it.

export function useUploadOMManual() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      file,
      subcontractor,
      description,
      trade,
    }: {
      projectId: string
      file: File
      subcontractor: string
      description: string
      trade: string
    }) => {
      const { url, error: upErr } = await uploadProjectFile(projectId, file)
      if (upErr) throw new Error(upErr)

      const { data, error } = await supabase
        .from('closeout_items')
        .insert({
          project_id: projectId,
          category: 'om_manual',
          description,
          trade,
          assigned_to: subcontractor || null,
          document_url: url,
          status: 'submitted',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', vars.projectId] })
    },
  })
}

// ── Final Sign-offs ────────────────────────────────────────
// Substantial Completion and Final Completion are tracked as closeout_items
// with dedicated categories. Toggling a sign-off flips status to 'approved'
// and records the signer in notes. If a signature_request infrastructure
// exists on the project, the caller can pair this mutation with
// `useCreateSignatureRequest`.

export type SignOffKind = 'substantial_completion' | 'final_completion'

export function useRecordSignOff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      kind,
      signerName,
      signerTitle,
      signatureDataUrl,
    }: {
      projectId: string
      kind: SignOffKind
      signerName: string
      signerTitle?: string | null
      signatureDataUrl?: string | null
    }) => {
      // Ensure the closeout_item row exists for this sign-off kind
      const { data: existing } = await supabase
        .from('closeout_items')
        .select('id')
        .eq('project_id', projectId)
        .eq('category', kind)
        .limit(1)

      const label =
        kind === 'substantial_completion'
          ? 'Substantial Completion'
          : 'Final Completion'

      const notesBlob = JSON.stringify({
        signed_by: signerName,
        title: signerTitle ?? null,
        signed_at: new Date().toISOString(),
        signature: signatureDataUrl ?? null,
      })

      const existingRows = (existing as unknown as { id: string }[] | null) ?? []
      let itemId: string | undefined = existingRows[0]?.id
      if (!itemId) {
        const { data: created, error: createErr } = await supabase
          .from('closeout_items')
          .insert({
            project_id: projectId,
            category: kind,
            description: label,
            trade: 'General',
            notes: notesBlob,
            status: 'approved',
            completed_date: new Date().toISOString(),
          })
          .select()
          .single()
        if (createErr) throw createErr
        itemId = (created as unknown as { id: string }).id
      } else {
        const { error: updErr } = await supabase
          .from('closeout_items')
          .update({
            status: 'approved',
            completed_date: new Date().toISOString(),
            notes: notesBlob,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
        if (updErr) throw updErr
      }

      return { itemId, kind }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', vars.projectId] })
    },
  })
}
