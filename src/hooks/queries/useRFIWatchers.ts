// ── useRFIWatchers ──────────────────────────────────────────────────────
// Read + write hooks for the rfi_watchers table. Decoupled from the
// RFI mutation so the watcher chip editor can fan-out per-watcher
// audit_log rows (Chain Audit Prep Check 5: never one row for a batch).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { invalidateEntity } from '../../api/invalidation'
import { logAuditEntry } from '../../lib/auditLogger'
import posthog from '../../lib/analytics'

export function useRFIWatchers(rfiId: string | null | undefined) {
  return useQuery({
    queryKey: ['rfi_watchers', rfiId ?? '__none__'],
    enabled: !!rfiId,
    staleTime: 30_000,
    queryFn: async (): Promise<string[]> => {
      if (!rfiId) return []
      const { data } = await fromTable('rfi_watchers')
        .select('user_id')
        .eq('rfi_id', rfiId)
      return ((data ?? []) as Array<{ user_id: string | null }>)
        .map((r) => r.user_id)
        .filter((u): u is string => !!u)
    },
  })
}

export function useAddRFIWatcher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { rfiId: string; userId: string; projectId: string }) => {
      const { error } = await fromTable('rfi_watchers').insert({
        rfi_id: params.rfiId,
        user_id: params.userId,
      } as never)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: { watcher_added: params.userId },
        metadata: { kind: 'rfi_watcher_add' },
      })
      return params
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: ['rfi_watchers', params.rfiId] })
      invalidateEntity('rfi', params.projectId)
      posthog.capture('rfi_watcher_added', { rfi_id: params.rfiId })
    },
  })
}

export function useRemoveRFIWatcher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { rfiId: string; userId: string; projectId: string }) => {
      const { error } = await fromTable('rfi_watchers')
        .delete()
        .eq('rfi_id', params.rfiId)
        .eq('user_id', params.userId)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        beforeState: { watcher: params.userId },
        afterState: { watcher_removed: params.userId },
        metadata: { kind: 'rfi_watcher_remove' },
      })
      return params
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: ['rfi_watchers', params.rfiId] })
      invalidateEntity('rfi', params.projectId)
      posthog.capture('rfi_watcher_removed', { rfi_id: params.rfiId })
    },
  })
}
