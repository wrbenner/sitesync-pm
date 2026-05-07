// ── useIrisRFIDraftV2 ───────────────────────────────────────────────────
// Hook layer for the multi-pass Iris draft pipeline (P2b #1).
//   • createDraft() — invokes the ai-rfi-draft-v2 edge function and
//     returns the inserted draft id.
//   • useIrisDraftV2(draftId) — read the draft row including citations,
//     confidence_by_field, and the pass_log for telemetry.
//   • acceptDraft / discardDraft mutations.
//
// Audit_log writes happen on accept (with model_fingerprint, prompt_hash,
// confidence_score) so the IRIS_TELEMETRY_SPEC contract is honored.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { logAuditEntry } from '../../lib/auditLogger'
import type { IrisConfidenceBand } from '../../lib/iris/confidence'

const from = (table: string) => fromTable(table as never)

export interface IrisRFIDraftV2 {
  id: string
  project_id: string
  rfi_id: string | null
  status: 'pending' | 'accepted' | 'modified' | 'discarded' | 'expired'
  draft_kind: string
  suggested_title: string | null
  suggested_body: string | null
  suggested_ball_in_court: string | null
  suggested_due_date: string | null
  suggested_priority: string | null
  suggested_drawing_ids: string[]
  suggested_spec_sections: string[]
  suggested_schedule_days: number | null
  suggested_cost_cents_min: number | null
  suggested_cost_cents_max: number | null
  citations: unknown[]
  confidence_by_field: Record<string, number>
  confidence_score: number | null
  confidence_band: IrisConfidenceBand | null
  model_fingerprint: string | null
  prompt_hash: string | null
  pass_log: unknown[]
  first_token_ms: number | null
  total_ms: number | null
  created_at: string
}

export function useIrisRFIDraftV2(draftId: string | null | undefined) {
  return useQuery({
    queryKey: ['ai_rfi_drafts', draftId ?? '__none__'],
    enabled: !!draftId,
    queryFn: async (): Promise<IrisRFIDraftV2 | null> => {
      if (!draftId) return null
      const { data } = await from('ai_rfi_drafts').select('*').eq('id' as never, draftId).maybeSingle()
      return (data ?? null) as unknown as IrisRFIDraftV2 | null
    },
  })
}

export function useCreateIrisRFIDraftV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      projectId: string
      description: string
      drawingId?: string | null
      photoBase64?: string | null
    }): Promise<{ draftId: string; firstTokenMs: number | null; totalMs: number | null; confidenceBand: IrisConfidenceBand }> => {
      const { data, error } = await supabase.functions.invoke('ai-rfi-draft-v2', {
        body: {
          project_id: params.projectId,
          description: params.description,
          drawing_id: params.drawingId ?? null,
          photo_base64: params.photoBase64 ?? null,
        },
      })
      if (error) throw error
      const payload = data as {
        draft_id?: string
        first_token_ms?: number | null
        total_ms?: number | null
        confidence_band?: IrisConfidenceBand
      } | null
      if (!payload?.draft_id) throw new Error('Iris draft returned no id')
      return {
        draftId: payload.draft_id,
        firstTokenMs: payload.first_token_ms ?? null,
        totalMs: payload.total_ms ?? null,
        confidenceBand: payload.confidence_band ?? 'low',
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ai_rfi_drafts', 'project', vars.projectId] })
    },
  })
}

export function useAcceptIrisRFIDraftV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { draft: IrisRFIDraftV2; projectId: string; rfiId?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await from('ai_rfi_drafts')
        .update({
          status: 'accepted',
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          rfi_id: params.rfiId ?? params.draft.rfi_id,
        } as never)
        .eq('id' as never, params.draft.id)
      if (error) throw error
      // Per IRIS_TELEMETRY_SPEC: log model fingerprint + prompt hash +
      // confidence on every Iris-driven mutation.
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId ?? params.draft.id,
        action: 'update',
        afterState: {
          iris_draft_id: params.draft.id,
          confidence_score: params.draft.confidence_score,
          confidence_band: params.draft.confidence_band,
        },
        metadata: {
          kind: 'iris_draft_accept',
          model_fingerprint: params.draft.model_fingerprint,
          prompt_hash: params.draft.prompt_hash,
          first_token_ms: params.draft.first_token_ms,
          total_ms: params.draft.total_ms,
        },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ai_rfi_drafts', vars.draft.id] })
    },
  })
}

export function useDiscardIrisRFIDraftV2() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { draft: IrisRFIDraftV2; projectId: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await from('ai_rfi_drafts')
        .update({
          status: 'discarded',
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq('id' as never, params.draft.id)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.draft.id,
        action: 'delete',
        beforeState: { iris_draft_id: params.draft.id },
        metadata: {
          kind: 'iris_draft_discard',
          model_fingerprint: params.draft.model_fingerprint,
          prompt_hash: params.draft.prompt_hash,
        },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ai_rfi_drafts', vars.draft.id] })
    },
  })
}
