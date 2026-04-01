// @ts-strict-check
import { supabase, transformSupabaseError, supabaseMutation } from '../client'
import type { ChangeOrderType, ChangeOrderState, ReasonCode } from '../../machines/changeOrderMachine'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { BudgetItemRow, ChangeOrderRow, CreateChangeOrderPayload } from '../../types/api'
import { isReasonCode } from '../../types/api'
import { computeProjectFinancials, computeDivisionFinancials } from '../../lib/financialEngine'
import type { ProjectFinancials, DivisionFinancials } from '../../types/financial'

// Typed alias for the PromiseLike shape that supabaseMutation expects.
// Avoids untyped casts while satisfying the narrower error shape required
// by supabaseMutation.
type MutationResult<T> = PromiseLike<{ data: T | null; error: { message: string; code?: string; details?: string | null } | null }>

const CHANGE_ORDER_STATES = new Set<ChangeOrderState>(['draft', 'pending_review', 'approved', 'rejected', 'void'])
function isChangeOrderState(v: unknown): v is ChangeOrderState {
  return typeof v === 'string' && CHANGE_ORDER_STATES.has(v as ChangeOrderState)
}

const CHANGE_ORDER_TYPES = new Set<ChangeOrderType>(['pco', 'cor', 'co'])
function isChangeOrderType(v: unknown): v is ChangeOrderType {
  return typeof v === 'string' && CHANGE_ORDER_TYPES.has(v as ChangeOrderType)
}

export interface MappedDivision {
  id: string
  name: string
  csi_division: string | null
  budget: number
  spent: number
  committed: number
  progress: number
  cost_code: string | null
}

export interface DivisionCostCode {
  id: string
  cost_code: string
  description: string | null
  amount: number | null
  cost_type: string | null
  date: string | null
  vendor: string | null
}

export interface DivisionInvoice {
  id: string
  invoice_number: string | null
  vendor: string
  invoice_date: string | null
  total: number | null
  status: string | null
  due_date: string | null
}

export interface DivisionDetail {
  division: MappedDivision
  costCodes: DivisionCostCode[]
  invoices: DivisionInvoice[]
  changeOrders: MappedChangeOrder[]
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

function mapChangeOrderRow(co: ChangeOrderRow): MappedChangeOrder {
  const type: ChangeOrderType = isChangeOrderType(co.type) ? co.type : 'co'
  const prefix = type.toUpperCase()
  return {
    id: co.id,
    coNumber: co.number ? `${prefix}-${String(co.number).padStart(3, '0')}` : co.id.slice(0, 6),
    title: co.title || co.description || '',
    description: co.description || '',
    amount: co.amount ?? 0,
    estimated_cost: typeof co.amount === 'number' ? co.amount : 0,
    submitted_cost: typeof co.amount === 'number' && ['submitted', 'approved', 'rejected'].includes(co.status ?? '') ? co.amount : 0,
    approved_cost: typeof co.approved_amount === 'number' ? co.approved_amount : 0,
    status: isChangeOrderState(co.status) ? co.status : 'draft',
    type,
    reason_code: isReasonCode(co.reason) ? co.reason : null,
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
    number: co.number ?? 0,
  }
}

export const createChangeOrder = async (
  projectId: string,
  payload: CreateChangeOrderPayload
): Promise<MappedChangeOrder> => {
  validateProjectId(projectId)
  const data = await supabaseMutation<ChangeOrderRow>(client =>
    client.from('change_orders')
      .insert({ ...payload, project_id: projectId, status: payload.status || 'draft', type: payload.type || 'pco' })
      .select()
      .single() as unknown as MutationResult<ChangeOrderRow>
  )
  return mapChangeOrderRow(data)
}

export const updateChangeOrderStatus = async (
  projectId: string,
  id: string,
  status: ChangeOrderState,
  updates?: Partial<CreateChangeOrderPayload>
): Promise<MappedChangeOrder> => {
  validateProjectId(projectId)
  const data = await supabaseMutation<ChangeOrderRow>(client =>
    client.from('change_orders')
      .update({ ...updates, status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single() as unknown as MutationResult<ChangeOrderRow>
  )
  return mapChangeOrderRow(data)
}

export const getCostData = async (projectId: string) => {
  await assertProjectAccess(projectId)
  const [budgetRes, coRes] = await Promise.all([
    supabase.from('budget_items').select('*').eq('project_id', projectId).order('division'),
    supabase.from('change_orders').select('*').eq('project_id', projectId).order('number', { ascending: false }),
  ])
  if (budgetRes.error) throw transformSupabaseError(budgetRes.error)
  if (coRes.error) throw transformSupabaseError(coRes.error)

  const rawBudgetItems: BudgetItemRow[] = budgetRes.data || []

  const divisions: MappedDivision[] = rawBudgetItems.map((b: BudgetItemRow) => ({
    id: b.id,
    name: b.division,
    csi_division: b.csi_division || null,
    budget: b.original_amount ?? 0,
    spent: b.actual_amount ?? 0,
    committed: b.committed_amount ?? 0,
    progress: b.percent_complete ?? 0,
    cost_code: b.cost_code || null,
  }))

  const changeOrders: MappedChangeOrder[] = (coRes.data || []).map(mapChangeOrderRow)

  return { divisions, changeOrders, budgetItems: rawBudgetItems }
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

// ── Pay Application SOV ──────────────────────────────────────

export interface SOVLineItem {
  id: string
  item_number: string
  description: string
  scheduled_value: number
  prev_pct_complete: number
  current_pct_complete: number
  stored_materials: number
  retainage_rate: number
  cost_code: string | null
}

export interface PayApplicationData {
  payAppId: string
  contractId: string
  projectId: string
  projectName: string
  contractorName: string
  applicationNumber: number
  periodTo: string
  originalContractSum: number
  netChangeOrders: number
  lessPreviousCertificates: number
  retainageRate: number
  lineItems: SOVLineItem[]
}

export interface SOVProgressUpdate {
  id: string
  this_period_completed: number
  materials_stored: number
  total_completed: number
  percent_complete: number
}

export async function getPayApplication(
  projectId: string,
  appNumber: number,
): Promise<PayApplicationData> {
  await assertProjectAccess(projectId)

  const { data: payApp, error: paError } = await supabase
    .from('pay_applications')
    .select('*')
    .eq('project_id', projectId)
    .eq('application_number', appNumber)
    .single()
  if (paError) throw transformSupabaseError(paError)

  const [contractRes, projectRes, sovRes] = await Promise.all([
    supabase.from('contracts').select('*').eq('id', payApp.contract_id).single(),
    supabase.from('projects').select('name, general_contractor').eq('id', projectId).single(),
    supabase
      .from('schedule_of_values')
      .select('*')
      .eq('contract_id', payApp.contract_id)
      .order('sort_order', { ascending: true }),
  ])
  if (contractRes.error) throw transformSupabaseError(contractRes.error)
  if (projectRes.error) throw transformSupabaseError(projectRes.error)
  if (sovRes.error) throw transformSupabaseError(sovRes.error)

  const contract = contractRes.data
  const project = projectRes.data
  const retainageRate = (contract.retainage_percent ?? 10) / 100

  const lineItems: SOVLineItem[] = (sovRes.data || []).map((row, i) => {
    const scheduled = row.scheduled_value || 0
    const prevAmt = row.previous_completed || 0
    const thisAmt = row.this_period_completed || 0
    const prevPct = scheduled > 0 ? (prevAmt / scheduled) * 100 : 0
    const currentPct = scheduled > 0 ? (thisAmt / scheduled) * 100 : 0
    return {
      id: row.id,
      item_number: row.item_number || String(i + 1),
      description: row.description,
      scheduled_value: scheduled,
      prev_pct_complete: prevPct,
      current_pct_complete: currentPct,
      stored_materials: row.materials_stored || 0,
      retainage_rate: retainageRate,
      cost_code: row.cost_code || null,
    }
  })

  return {
    payAppId: payApp.id,
    contractId: payApp.contract_id,
    projectId,
    projectName: project.name,
    contractorName: project.general_contractor || contract.counterparty,
    applicationNumber: payApp.application_number ?? appNumber,
    periodTo: payApp.period_to,
    originalContractSum: payApp.original_contract_sum ?? contract.original_value,
    netChangeOrders: payApp.net_change_orders ?? 0,
    lessPreviousCertificates: payApp.less_previous_certificates ?? 0,
    retainageRate,
    lineItems,
  }
}

export async function saveSOVProgress(
  payAppId: string,
  updates: SOVProgressUpdate[],
  g702Totals: {
    totalCompletedAndStored: number
    retainageAmount: number
    totalEarnedLessRetainage: number
    currentPaymentDue: number
    balanceToFinish: number
  },
  submit = false,
): Promise<void> {
  await Promise.all(
    updates.map((u) =>
      supabase.from('schedule_of_values').update({
        this_period_completed: u.this_period_completed,
        materials_stored: u.materials_stored,
        total_completed: u.total_completed,
        percent_complete: u.percent_complete,
        updated_at: new Date().toISOString(),
      }).eq('id', u.id),
    ),
  )

  const patch: Record<string, unknown> = {
    total_completed_and_stored: g702Totals.totalCompletedAndStored,
    retainage: g702Totals.retainageAmount,
    total_earned_less_retainage: g702Totals.totalEarnedLessRetainage,
    current_payment_due: g702Totals.currentPaymentDue,
    balance_to_finish: g702Totals.balanceToFinish,
    updated_at: new Date().toISOString(),
  }
  if (submit) {
    patch.status = 'submitted'
    patch.submitted_date = new Date().toISOString()
  }

  const { error } = await supabase.from('pay_applications').update(patch).eq('id', payAppId)
  if (error) throw transformSupabaseError(error)
}

export async function approvePayApplication(payAppId: string): Promise<void> {
  const { error } = await supabase
    .from('pay_applications')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', payAppId)
  if (error) throw transformSupabaseError(error)
}

// ── Division Detail ──────────────────────────────────────────

export async function getCostCodesByDivision(
  projectId: string,
  divisionId: string,
): Promise<DivisionDetail> {
  await assertProjectAccess(projectId)

  const { data: b, error: divErr } = await supabase
    .from('budget_items')
    .select('*')
    .eq('id', divisionId)
    .single()
  if (divErr) throw transformSupabaseError(divErr)

  const budgetItem = b as BudgetItemRow

  const [costCodesRes, invoicesRes, coRes] = await Promise.all([
    supabase
      .from('job_cost_entries')
      .select('*')
      .eq('project_id', projectId)
      .eq('budget_item_id', divisionId)
      .order('date', { ascending: false }),
    supabase
      .from('invoices_payable')
      .select('*')
      .eq('project_id', projectId)
      .eq('budget_item_id', divisionId)
      .order('invoice_date', { ascending: false }),
    budgetItem.cost_code
      ? supabase
          .from('change_orders')
          .select('*')
          .eq('project_id', projectId)
          .eq('cost_code', budgetItem.cost_code)
          .order('number', { ascending: false })
      : Promise.resolve({ data: [] as ChangeOrderRow[], error: null }),
  ])
  if (costCodesRes.error) throw transformSupabaseError(costCodesRes.error)
  if (invoicesRes.error) throw transformSupabaseError(invoicesRes.error)
  if (coRes.error) throw transformSupabaseError(coRes.error)

  const division: MappedDivision = {
    id: budgetItem.id,
    name: budgetItem.division,
    csi_division: budgetItem.csi_division || null,
    budget: budgetItem.original_amount ?? 0,
    spent: budgetItem.actual_amount ?? 0,
    committed: budgetItem.committed_amount ?? 0,
    progress: budgetItem.percent_complete ?? 0,
    cost_code: budgetItem.cost_code || null,
  }

  const costCodes: DivisionCostCode[] = (costCodesRes.data || []).map((e) => ({
    id: e.id,
    cost_code: e.cost_code,
    description: e.description || null,
    amount: e.amount || null,
    cost_type: e.cost_type || null,
    date: e.date || null,
    vendor: e.vendor || null,
  }))

  const invoices: DivisionInvoice[] = (invoicesRes.data || []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number || null,
    vendor: inv.vendor,
    invoice_date: inv.invoice_date || null,
    total: inv.total || null,
    status: inv.status || null,
    due_date: inv.due_date || null,
  }))

  const changeOrders: MappedChangeOrder[] = (coRes.data || []).map(mapChangeOrderRow)

  return { division, costCodes, invoices, changeOrders }
}
