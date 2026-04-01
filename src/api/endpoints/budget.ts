import { supabase, transformSupabaseError } from '../client'
import type { ChangeOrderType, ChangeOrderState, ReasonCode } from '../../machines/changeOrderMachine'
import { validateProjectId } from '../middleware/projectScope'
import type { BudgetItemRow, ChangeOrderRow } from '../../types/api'
import { computeProjectFinancials, computeDivisionFinancials } from '../../lib/financialEngine'
import type { ProjectFinancials, DivisionFinancials } from '../../types/financial'

export interface MappedDivision {
  id: string
  name: string
  budget: number
  spent: number
  committed: number
  progress: number
  cost_code: string | null
}

export interface MappedChangeOrder {
  id: string
  coNumber: string
  title: string
  description: string
  amount: number
  estimated_cost: number
  submitted_cost: number
  approved_cost: number
  status: ChangeOrderState
  type: ChangeOrderType
  reason_code: ReasonCode | null
  schedule_impact_days: number
  cost_code: string | null
  budget_line_item_id: string | null
  parent_co_id: string | null
  promoted_from_id: string | null
  submitted_by: string | null
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_comments: string | null
  approved_by: string | null
  approved_at: string | null
  approval_comments: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_comments: string | null
  promoted_at: string | null
  requested_by: string | null
  requested_date: string | null
  created_at: string | null
  number: number
}

export const getCostData = async (projectId: string) => {
  validateProjectId(projectId)
  const [budgetRes, coRes] = await Promise.all([
    supabase.from('budget_items').select('*').eq('project_id', projectId).order('division'),
    supabase.from('change_orders').select('*').eq('project_id', projectId).order('number', { ascending: false }),
  ])
  if (budgetRes.error) throw transformSupabaseError(budgetRes.error)
  if (coRes.error) throw transformSupabaseError(coRes.error)

  const divisions: MappedDivision[] = (budgetRes.data || []).map((b: BudgetItemRow) => ({
    id: b.id,
    name: b.division,
    budget: b.original_amount || 0,
    spent: b.actual_amount || 0,
    committed: b.committed_amount || 0,
    progress: b.percent_complete || 0,
    cost_code: b.cost_code || null,
  }))

  const changeOrders: MappedChangeOrder[] = (coRes.data || []).map((co: ChangeOrderRow) => {
    const type: ChangeOrderType = (co.type as ChangeOrderType) || 'co'
    const prefix = type.toUpperCase()
    return {
      id: co.id,
      coNumber: co.number ? `${prefix}-${String(co.number).padStart(3, '0')}` : co.id.slice(0, 6),
      title: co.title || co.description || '',
      description: co.description || '',
      amount: co.amount || 0,
      estimated_cost: co.amount || 0,
      submitted_cost: co.amount || 0,
      approved_cost: 0,
      status: (co.status as ChangeOrderState) || 'draft',
      type,
      reason_code: (co.reason as ReasonCode) || null,
      schedule_impact_days: 0,
      cost_code: co.cost_code || null,
      budget_line_item_id: null,
      parent_co_id: co.parent_co_id || null,
      promoted_from_id: null,
      submitted_by: null,
      submitted_at: null,
      reviewed_by: null,
      reviewed_at: null,
      review_comments: null,
      approved_by: null,
      approved_at: co.approved_date || null,
      approval_comments: null,
      rejected_by: null,
      rejected_at: null,
      rejection_comments: null,
      promoted_at: null,
      requested_by: co.requested_by || null,
      requested_date: co.requested_date || null,
      created_at: co.created_at || null,
      number: co.number || 0,
    }
  })

  return { divisions, changeOrders }
}

export async function getProjectFinancials(
  projectId: string,
  contractValue: number
): Promise<{ project: ProjectFinancials; byDivision: DivisionFinancials[] }> {
  const { divisions, changeOrders } = await getCostData(projectId)
  return {
    project: computeProjectFinancials(divisions, changeOrders, contractValue),
    byDivision: computeDivisionFinancials(divisions, changeOrders),
  }
}
