/**
 * Budget Snapshot Service
 *
 * Persists budget snapshots to Supabase for period-over-period comparison.
 * No mock data. All operations hit the real database.
 */

import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'

export interface BudgetSnapshotRow {
  id: string
  project_id: string
  name: string
  snapshot_date: string
  total_budget: number
  total_spent: number
  total_committed: number
  division_data: { division: string; budget: number; spent: number; committed: number }[]
  created_by: string | null
  created_at: string
}

export interface CreateSnapshotInput {
  projectId: string
  name: string
  totalBudget: number
  totalSpent: number
  totalCommitted: number
  divisionData: { division: string; budget: number; spent: number; committed: number }[]
}

export const budgetSnapshotService = {
  async loadSnapshots(projectId: string): Promise<BudgetSnapshotRow[]> {
    const { data, error } = await fromTable('budget_snapshots')
      .select('*')
      .eq('project_id' as never, projectId)
      .order('snapshot_date', { ascending: false })

    if (error) throw error

    return (data ?? []).map(row => ({
      ...row,
      division_data: Array.isArray(row.division_data) ? row.division_data : [],
    })) as BudgetSnapshotRow[]
  },

  async saveSnapshot(input: CreateSnapshotInput): Promise<BudgetSnapshotRow> {
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user?.id ?? null

    const { data, error } = await fromTable('budget_snapshots')
      .insert({
        project_id: input.projectId,
        name: input.name,
        total_budget: input.totalBudget,
        total_spent: input.totalSpent,
        total_committed: input.totalCommitted,
        division_data: input.divisionData,
        created_by: userId,
      } as never)
      .select()
      .single()

    if (error) throw error

    return data as unknown as BudgetSnapshotRow
  },

  async deleteSnapshot(id: string): Promise<void> {
    const { error } = await fromTable('budget_snapshots')
      .delete()
      .eq('id' as never, id)

    if (error) throw error
  },
}
