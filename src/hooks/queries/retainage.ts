import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

// Columns match supabase/migrations/20260424000015_retainage_entries.sql
export interface RetainageEntry {
  id: string
  project_id: string
  contract_id: string
  pay_app_id: string | null
  percent_held: number | null
  amount_held: number
  released_amount: number
  released_at: string | null
  released_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const retainageKeys = {
  all: ['retainage_entries'] as const,
  byProject: (projectId: string | undefined) =>
    ['retainage_entries', projectId ?? null] as const,
  byContract: (contractId: string | undefined) =>
    ['retainage_entries', 'contract', contractId ?? null] as const,
  byPayApp: (payAppId: string | undefined) =>
    ['retainage_entries', 'pay_app', payAppId ?? null] as const,
}

export function useRetainageEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: retainageKeys.byProject(projectId),
    queryFn: async (): Promise<RetainageEntry[]> => {
      const { data, error } = await fromTable('retainage_entries')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as RetainageEntry[]
    },
    enabled: !!projectId,
  })
}

export function useRetainageEntriesByContract(contractId: string | undefined) {
  return useQuery({
    queryKey: retainageKeys.byContract(contractId),
    queryFn: async (): Promise<RetainageEntry[]> => {
      const { data, error } = await fromTable('retainage_entries')
        .select('*')
        .eq('contract_id' as never, contractId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as RetainageEntry[]
    },
    enabled: !!contractId,
  })
}

export function useRetainageEntriesByPayApp(payAppId: string | undefined) {
  return useQuery({
    queryKey: retainageKeys.byPayApp(payAppId),
    queryFn: async (): Promise<RetainageEntry[]> => {
      const { data, error } = await fromTable('retainage_entries')
        .select('*')
        .eq('pay_app_id' as never, payAppId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as RetainageEntry[]
    },
    enabled: !!payAppId,
  })
}

/**
 * Aggregate { held, released, outstanding } per contract from a flat list.
 * Kept here (not in the page) so both the retainage tab and the applications
 * list can compute the same summary without duplicating logic.
 */
export function summarizeRetainage(entries: RetainageEntry[]) {
  const byContract = new Map<string, { held: number; released: number; outstanding: number }>()
  let totalHeld = 0
  let totalReleased = 0
  for (const e of entries) {
    const prev = byContract.get(e.contract_id) ?? { held: 0, released: 0, outstanding: 0 }
    const held = prev.held + (e.amount_held ?? 0)
    const released = prev.released + (e.released_amount ?? 0)
    byContract.set(e.contract_id, {
      held,
      released,
      outstanding: held - released,
    })
    totalHeld += e.amount_held ?? 0
    totalReleased += e.released_amount ?? 0
  }
  return {
    byContract,
    totals: {
      held: totalHeld,
      released: totalReleased,
      outstanding: totalHeld - totalReleased,
    },
  }
}

/**
 * Aggregate { held, released } per pay_app_id — used by the Applications tab
 * to show cumulative retainage held for each pay app.
 */
export function summarizeRetainageByPayApp(entries: RetainageEntry[]) {
  const byPayApp = new Map<string, { held: number; released: number }>()
  for (const e of entries) {
    if (!e.pay_app_id) continue
    const prev = byPayApp.get(e.pay_app_id) ?? { held: 0, released: 0 }
    byPayApp.set(e.pay_app_id, {
      held: prev.held + (e.amount_held ?? 0),
      released: prev.released + (e.released_amount ?? 0),
    })
  }
  return byPayApp
}
