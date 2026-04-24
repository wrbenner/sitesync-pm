import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type FinancialPeriodStatus = 'open' | 'pending_close' | 'closed' | 'reopened'

export interface FinancialPeriod {
  id: string
  project_id: string
  /** First of month, ISO date (YYYY-MM-DD). */
  period_month: string
  status: FinancialPeriodStatus
  closed_at: string | null
  closed_by: string | null
  reopened_at: string | null
  reopened_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const financialPeriodsKey = (projectId: string | undefined) =>
  ['financial_periods', projectId] as const

export const activePeriodKey = (projectId: string | undefined) =>
  ['financial_periods', projectId, 'active'] as const

/**
 * All financial periods for a project, newest month first.
 * Pages render monthly status badges from this list.
 */
export function useFinancialPeriods(projectId: string | undefined) {
  return useQuery<FinancialPeriod[]>({
    queryKey: financialPeriodsKey(projectId),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_periods')
        .select('*')
        .eq('project_id', projectId!)
        .order('period_month', { ascending: false })
      if (error) throw error
      return (data ?? []) as FinancialPeriod[]
    },
  })
}

/**
 * The period that covers "today" for this project.
 *
 * Returns the row for the current month if one exists, otherwise null.
 * Downstream pages (change-orders, pay-apps) import this to render a
 * banner when the active period's status is 'closed' — writes to those
 * entities would be stale against a closed month.
 *
 * Intentionally exported so /change-orders and /pay-apps can consume
 * without modifying this file or the pages themselves.
 */
export function useActivePeriod(projectId: string | undefined) {
  return useQuery<FinancialPeriod | null>({
    queryKey: activePeriodKey(projectId),
    enabled: !!projectId,
    queryFn: async () => {
      const firstOfThisMonth = firstOfMonth(new Date()).toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('financial_periods')
        .select('*')
        .eq('project_id', projectId!)
        .eq('period_month', firstOfThisMonth)
        .maybeSingle()
      if (error) throw error
      return (data as FinancialPeriod | null) ?? null
    },
  })
}

/** Strip a Date down to the first of its month at UTC midnight. */
export function firstOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}
