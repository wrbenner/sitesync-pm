// ── useRFILinks ─────────────────────────────────────────────────────────
// Cross-module link CRUD for the rfi_links table.
//
// The Linked Items panel calls these for forward links (RFI → target).
// Reverse-render queries (target's "Linked RFIs" section) hit the same
// table indexed on (target_type, target_id).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'
import { logAuditEntry } from '../../lib/auditLogger'

const from = (table: string) => fromTable(table as never)

export type RFILinkTarget =
  | 'submittal'
  | 'drawing'
  | 'schedule_phase'
  | 'budget_item'
  | 'punch_item'
  | 'daily_log'
  | 'meeting'
  | 'rfi'
  | 'change_order'

export type RFILinkKind =
  | 'blocks'
  | 'blocked_by'
  | 'related'
  | 'derived_from'
  | 'converts_to'

export interface RFILink {
  id: string
  rfi_id: string
  target_type: RFILinkTarget
  target_id: string
  link_kind: RFILinkKind
  created_by: string | null
  created_at: string
}

const QK_BY_RFI = (rfiId: string | undefined) => ['rfi_links', 'by_rfi', rfiId ?? '__none__']
const QK_BY_TARGET = (targetType: RFILinkTarget | undefined, targetId: string | undefined) =>
  ['rfi_links', 'by_target', targetType ?? '__none__', targetId ?? '__none__']

export function useRFILinksByRFI(rfiId: string | undefined) {
  return useQuery({
    queryKey: QK_BY_RFI(rfiId),
    enabled: !!rfiId,
    staleTime: 30_000,
    queryFn: async (): Promise<RFILink[]> => {
      if (!rfiId) return []
      const { data } = await from('rfi_links')
        .select('*')
        .eq('rfi_id' as never, rfiId)
        .order('created_at' as never, { ascending: false })
      return (data ?? []) as unknown as RFILink[]
    },
  })
}

/** Reverse render: which RFIs link to this target entity. */
export function useRFILinksByTarget(targetType: RFILinkTarget | undefined, targetId: string | undefined) {
  return useQuery({
    queryKey: QK_BY_TARGET(targetType, targetId),
    enabled: !!targetType && !!targetId,
    staleTime: 30_000,
    queryFn: async (): Promise<RFILink[]> => {
      if (!targetType || !targetId) return []
      const { data } = await from('rfi_links')
        .select('*')
        .eq('target_type' as never, targetType)
        .eq('target_id' as never, targetId)
        .order('created_at' as never, { ascending: false })
      return (data ?? []) as unknown as RFILink[]
    },
  })
}

export function useAddRFILink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      rfiId: string
      projectId: string
      targetType: RFILinkTarget
      targetId: string
      linkKind?: RFILinkKind
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await from('rfi_links').insert({
        rfi_id: params.rfiId,
        target_type: params.targetType,
        target_id: params.targetId,
        link_kind: params.linkKind ?? 'related',
        created_by: user?.id ?? null,
      } as never)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: { link_added: { target_type: params.targetType, target_id: params.targetId, kind: params.linkKind ?? 'related' } },
        metadata: { kind: 'rfi_link_add' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK_BY_RFI(vars.rfiId) })
      qc.invalidateQueries({ queryKey: QK_BY_TARGET(vars.targetType, vars.targetId) })
    },
  })
}

export function useRemoveRFILink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; rfiId: string; projectId: string; targetType: RFILinkTarget; targetId: string }) => {
      const { error } = await from('rfi_links').delete().eq('id' as never, params.id)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        beforeState: { link_removed: { id: params.id } },
        metadata: { kind: 'rfi_link_remove' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK_BY_RFI(vars.rfiId) })
      qc.invalidateQueries({ queryKey: QK_BY_TARGET(vars.targetType, vars.targetId) })
    },
  })
}
