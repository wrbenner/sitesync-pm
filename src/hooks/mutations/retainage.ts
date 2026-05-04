import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { fromTable } from '../../lib/db/queries'
import { retainageKeys, type RetainageEntry } from '../queries/retainage'

export interface CreateRetainageInput {
  project_id: string
  contract_id: string
  pay_app_id?: string | null
  percent_held?: number | null
  amount_held: number
  notes?: string | null
}

export interface ReleaseRetainageInput {
  id: string
  project_id: string
  release_amount: number
  released_by?: string | null
  notes?: string | null
}

export function useCreateRetainageEntry() {
  const qc = useQueryClient()
  return useMutation<RetainageEntry, Error, CreateRetainageInput>({
    mutationFn: async (input) => {
      if (!(input.amount_held > 0)) {
        throw new Error('Amount held must be greater than 0')
      }
      const payload = {
        project_id: input.project_id,
        contract_id: input.contract_id,
        pay_app_id: input.pay_app_id ?? null,
        percent_held: input.percent_held ?? null,
        amount_held: input.amount_held,
        released_amount: 0,
        notes: input.notes ?? null,
      }
      const { data, error } = await fromTable('retainage_entries')
        .insert(payload as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as RetainageEntry
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: retainageKeys.byProject(data.project_id) })
      qc.invalidateQueries({ queryKey: retainageKeys.byContract(data.contract_id) })
      if (data.pay_app_id) {
        qc.invalidateQueries({ queryKey: retainageKeys.byPayApp(data.pay_app_id) })
      }
      toast.success('Retainage entry added')
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to add retainage entry')
    },
  })
}

/**
 * Release retainage (partial or full).
 *
 * Partial: `release_amount` < remaining outstanding — increments
 * `released_amount` but leaves `released_at` null so the entry stays open.
 *
 * Full: `release_amount` equals (or exceeds) remaining outstanding — sets
 * `released_amount` to the total `amount_held` and stamps `released_at` +
 * `released_by`.
 *
 * Role gating: the RLS policy restricts UPDATE to owner/admin/project_manager,
 * so a non-privileged caller will hit a Postgres permission error that
 * surfaces via the `onError` toast. Callers should still hide the UI for
 * ineligible roles (see OwnerPortal/PermissionGate pattern).
 */
export function useReleaseRetainageEntry() {
  const qc = useQueryClient()
  return useMutation<RetainageEntry, Error, ReleaseRetainageInput>({
    mutationFn: async (input) => {
      if (!(input.release_amount > 0)) {
        throw new Error('Release amount must be greater than 0')
      }

      const { data: existing, error: readErr } = await fromTable('retainage_entries')
        .select('amount_held, released_amount, released_at')
        .eq('id' as never, input.id)
        .single()
      if (readErr) throw readErr

      const amountHeld = Number(existing.amount_held ?? 0)
      const alreadyReleased = Number(existing.released_amount ?? 0)
      const outstanding = amountHeld - alreadyReleased
      if (outstanding <= 0) {
        throw new Error('No outstanding retainage to release on this entry')
      }
      const requested = Math.min(input.release_amount, outstanding)
      const newReleased = alreadyReleased + requested
      const isFull = newReleased >= amountHeld - 0.005 // tolerance for numeric(14,2)

      const updates: Record<string, unknown> = {
        released_amount: newReleased,
      }
      if (isFull) {
        updates.released_at = new Date().toISOString()
        if (input.released_by) updates.released_by = input.released_by
      }
      if (input.notes != null) updates.notes = input.notes

      const { data, error } = await fromTable('retainage_entries')
        .update(updates as never)
        .eq('id' as never, input.id)
        .eq('project_id' as never, input.project_id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as RetainageEntry
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: retainageKeys.byProject(variables.project_id) })
      qc.invalidateQueries({ queryKey: retainageKeys.byContract(data.contract_id) })
      if (data.pay_app_id) {
        qc.invalidateQueries({ queryKey: retainageKeys.byPayApp(data.pay_app_id) })
      }
      toast.success(
        data.released_at ? 'Retainage fully released' : 'Retainage partially released',
      )
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to release retainage')
    },
  })
}

export function useDeleteRetainageEntry() {
  const qc = useQueryClient()
  return useMutation<{ id: string; projectId: string }, Error, { id: string; projectId: string }>({
    mutationFn: async (params) => {
      const { error } = await fromTable('retainage_entries')
        .delete()
        .eq('id' as never, params.id)
      if (error) throw error
      return params
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: retainageKeys.byProject(result.projectId) })
      toast.success('Retainage entry deleted')
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete retainage entry')
    },
  })
}
