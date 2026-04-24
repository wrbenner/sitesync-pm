import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import {
  financialPeriodsKey,
  activePeriodKey,
  type FinancialPeriod,
} from '../queries/financial-periods'

/**
 * Close (or flip to pending_close) a financial period.
 *
 * Plain useMutation rather than useAuditedMutation because the audit
 * trail for close/reopen lives in the row itself (closed_at/closed_by/
 * reopened_at/reopened_by/notes) — the mutation persists those directly
 * instead of double-bookkeeping through the generic audit table.
 */
export interface ClosePeriodInput {
  id: string
  projectId: string
  status: 'pending_close' | 'closed'
  notes?: string | null
}

export function useClosePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClosePeriodInput) => {
      const { data: session } = await supabase.auth.getSession()
      const userId = session?.session?.user?.id ?? null
      const updates: Record<string, unknown> = {
        status: input.status,
        notes: input.notes ?? null,
      }
      if (input.status === 'closed') {
        updates.closed_at = new Date().toISOString()
        updates.closed_by = userId
      }
      const { data, error } = await supabase
        .from('financial_periods')
        .update(updates)
        .eq('id', input.id)
        .eq('project_id', input.projectId)
        .select()
        .single()
      if (error) throw error
      return data as FinancialPeriod
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: financialPeriodsKey(vars.projectId) })
      qc.invalidateQueries({ queryKey: activePeriodKey(vars.projectId) })
      toast.success(vars.status === 'closed' ? 'Period closed' : 'Period marked pending close')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to close period'),
  })
}

export interface ReopenPeriodInput {
  id: string
  projectId: string
  notes: string
}

export function useReopenPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ReopenPeriodInput) => {
      if (!input.notes.trim()) {
        throw new Error('Reopen reason is required for audit trail')
      }
      const { data: session } = await supabase.auth.getSession()
      const userId = session?.session?.user?.id ?? null
      const { data, error } = await supabase
        .from('financial_periods')
        .update({
          status: 'reopened',
          reopened_at: new Date().toISOString(),
          reopened_by: userId,
          notes: input.notes,
        })
        .eq('id', input.id)
        .eq('project_id', input.projectId)
        .select()
        .single()
      if (error) throw error
      return data as FinancialPeriod
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: financialPeriodsKey(vars.projectId) })
      qc.invalidateQueries({ queryKey: activePeriodKey(vars.projectId) })
      toast.success('Period reopened')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reopen period'),
  })
}

export interface CreatePeriodInput {
  projectId: string
  /** First of month, YYYY-MM-DD. */
  periodMonth: string
}

/**
 * Create a new monthly period row in 'open' state. The UI calls this
 * implicitly the first time the user clicks Close on a month that
 * hasn't been tracked yet.
 */
export function useCreatePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePeriodInput) => {
      const { data, error } = await supabase
        .from('financial_periods')
        .insert({
          project_id: input.projectId,
          period_month: input.periodMonth,
          status: 'open',
        })
        .select()
        .single()
      if (error) throw error
      return data as FinancialPeriod
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: financialPeriodsKey(vars.projectId) })
      qc.invalidateQueries({ queryKey: activePeriodKey(vars.projectId) })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create period'),
  })
}
