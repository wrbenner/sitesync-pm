// @ts-strict-check
import { supabase, transformSupabaseError, supabaseMutation } from '../client'
import type { ChangeOrderType, ChangeOrderState, ReasonCode } from '../../machines/changeOrderMachine'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { BudgetItemRow, BudgetLineItemRow, ChangeOrderRow, CreateChangeOrderPayload } from '../../types/api'
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

export interface BudgetLineItem {
  id: string
  project_id: string
  csi_code: string | null
  description: string | null
  original_amount: number
  approved_changes: number
  revised_budget: number
  committed_cost: number
  actual_cost: number
  projected_final: number
  variance: number
}

export interface BudgetSummary {
  total_original_budget: number
  total_approved_changes: number
  total_revised_budget: number
  total_committed: number
  total_actual: number
  total_projected: number
  total_variance: number
  contingency_original: number
  contingency_used: number
  contingency_remaining: number
}

export interface BudgetLineItemInput {
  csi_code?: string | null
  description?: string | null
  original_amount?: number | null
  approved_changes?: number | null
  revised_budget?: number | null
  committed_cost?: number | null
  actual_cost?: number | null
  projected_final?: number | null
  variance?: number | null
}

function mapBudgetLineItemRow(row: BudgetLineItemRow): BudgetLineItem {
  return {
    id: row.id,
    project_id: row.project_id,
    csi_code: row.csi_code,
    description: row.description,
    original_amount: row.original_amount ?? 0,
    approved_changes: row.approved_changes ?? 0,
    revised_budget: row.revised_budget ?? ((row.original_amount ?? 0) + (row.approved_changes ?? 0)),
    committed_cost: row.committed_cost ?? 0,
    actual_cost: row.actual_cost ?? 0,
    projected_final: row.projected_final ?? 0,
    variance: row.variance ?? 0,
  }
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
  const [budgetRes, coRes, lineItemsRes] = await Promise.all([
    supabase.from('budget_items').select('*').eq('project_id', projectId).order('division'),
    supabase.from('change_orders').select('*').eq('project_id', projectId).order('number', { ascending: false }),
    supabase.from('budget_line_items').select('*').eq('project_id', projectId).order('csi_code'),
  ])
  if (budgetRes.error) throw transformSupabaseError(budgetRes.error)
  if (coRes.error) throw transformSupabaseError(coRes.error)
  if (lineItemsRes.error) throw transformSupabaseError(lineItemsRes.error)

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

  const lineItems: BudgetLineItem[] = (lineItemsRes.data || []).map(mapBudgetLineItemRow)

  return { divisions, changeOrders, budgetItems: rawBudgetItems, lineItems }
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

// ── Budget Summary Metrics ───────────────────────────────────

export interface BudgetLineMetrics {
  id: string
  division: string
  csi_division: string | null
  cost_code: string | null
  originalAmount: number
  revisedAmount: number
  committed: number
  spentToDate: number
  costToComplete: number
  projectedFinalCost: number
  variance: number
}

export interface BudgetSummaryMetrics {
  lineItems: BudgetLineMetrics[]
  totalOriginalBudget: number
  totalRevisedBudget: number
  totalCommitted: number
  totalSpentToDate: number
  totalProjectedFinal: number
  totalVariance: number
  variancePercent: number
  contingencyRemaining: number
  overBudgetLineCount: number
}

export async function getBudgetSummaryMetrics(projectId: string): Promise<BudgetSummaryMetrics> {
  await assertProjectAccess(projectId)

  const { data, error } = await supabase
    .from('budget_items')
    .select('*')
    .eq('project_id', projectId)
  if (error) throw transformSupabaseError(error)

  const rows: BudgetItemRow[] = data || []

  // Work in integer cents to avoid floating point drift; convert to dollars on return.
  const toCents = (v: number | null | undefined): number => Math.round((v ?? 0) * 100)
  const toDollars = (cents: number): number => cents / 100

  let totalOriginalCents = 0
  let totalRevisedCents = 0
  let totalCommittedCents = 0
  let totalSpentCents = 0
  let totalProjectedCents = 0
  let totalVarianceCents = 0
  let contingencyCents = 0
  let overBudgetLineCount = 0

  const lineItems: BudgetLineMetrics[] = rows.map((b) => {
    const originalCents = toCents(b.original_amount)
    // forecast_amount is the explicit revised budget when set; fall back to original.
    const revisedCents = b.forecast_amount !== null ? toCents(b.forecast_amount) : originalCents
    const committedCents = toCents(b.committed_amount)
    const spentCents = toCents(b.actual_amount)

    // Cost to complete: remaining work not yet spent.
    const costToCompleteCents = b.forecast_amount !== null
      ? Math.max(0, toCents(b.forecast_amount) - spentCents)
      : Math.max(0, originalCents - spentCents)

    // Projected final = exposure floor (max of committed vs spent) + remaining work.
    const projectedFinalCents = Math.max(committedCents, spentCents) + costToCompleteCents

    // Variance: positive = under budget, negative = over.
    const varianceCents = revisedCents - projectedFinalCents

    totalOriginalCents += originalCents
    totalRevisedCents += revisedCents
    totalCommittedCents += committedCents
    totalSpentCents += spentCents
    totalProjectedCents += projectedFinalCents
    totalVarianceCents += varianceCents

    if (varianceCents < 0) overBudgetLineCount++

    // CSI Division 01 = General Requirements; treated as contingency pool.
    if (b.csi_division?.startsWith('01')) {
      contingencyCents += Math.max(0, revisedCents - spentCents)
    }

    return {
      id: b.id,
      division: b.division,
      csi_division: b.csi_division || null,
      cost_code: b.cost_code || null,
      originalAmount: toDollars(originalCents),
      revisedAmount: toDollars(revisedCents),
      committed: toDollars(committedCents),
      spentToDate: toDollars(spentCents),
      costToComplete: toDollars(costToCompleteCents),
      projectedFinalCost: toDollars(projectedFinalCents),
      variance: toDollars(varianceCents),
    }
  })

  const variancePercent = totalRevisedCents !== 0
    ? Math.round((totalVarianceCents / totalRevisedCents) * 10000) / 100
    : 0

  return {
    lineItems,
    totalOriginalBudget: toDollars(totalOriginalCents),
    totalRevisedBudget: toDollars(totalRevisedCents),
    totalCommitted: toDollars(totalCommittedCents),
    totalSpentToDate: toDollars(totalSpentCents),
    totalProjectedFinal: toDollars(totalProjectedCents),
    totalVariance: toDollars(totalVarianceCents),
    variancePercent,
    contingencyRemaining: toDollars(contingencyCents),
    overBudgetLineCount,
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

// ── Budget Line Items CRUD ───────────────────────────────────

export async function getBudgetSummary(projectId: string): Promise<BudgetSummary> {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase
    .from('budget_line_items')
    .select('*')
    .eq('project_id', projectId)
    .order('csi_code')
  if (error) throw transformSupabaseError(error)

  const rows = data || []

  let total_original_budget = 0
  let total_approved_changes = 0
  let total_revised_budget = 0
  let total_committed = 0
  let total_actual = 0
  let total_projected = 0
  let total_variance = 0
  let contingency_original = 0
  let contingency_used = 0

  for (const row of rows) {
    total_original_budget += row.original_amount ?? 0
    total_approved_changes += row.approved_changes ?? 0
    total_revised_budget += row.revised_budget ?? ((row.original_amount ?? 0) + (row.approved_changes ?? 0))
    total_committed += row.committed_cost ?? 0
    total_actual += row.actual_cost ?? 0
    total_projected += row.projected_final ?? 0
    total_variance += row.variance ?? 0
    if (row.csi_code?.startsWith('01')) {
      contingency_original += row.original_amount ?? 0
      contingency_used += row.actual_cost ?? 0
    }
  }

  return {
    total_original_budget,
    total_approved_changes,
    total_revised_budget,
    total_committed,
    total_actual,
    total_projected,
    total_variance,
    contingency_original,
    contingency_used,
    contingency_remaining: contingency_original - contingency_used,
  }
}

export async function updateBudgetLineItem(
  projectId: string,
  itemId: string,
  updates: BudgetLineItemInput & { updated_at?: string | null },
): Promise<BudgetLineItem> {
  await assertProjectAccess(projectId)
  const { updated_at: expectedUpdatedAt, ...fields } = updates

  if (expectedUpdatedAt) {
    const { data: current, error: fetchError } = await supabase
      .from('budget_line_items')
      .select('updated_at')
      .eq('id', itemId)
      .eq('project_id', projectId)
      .single()
    if (fetchError) throw transformSupabaseError(fetchError)
    if (current?.updated_at !== expectedUpdatedAt) {
      throw new Error('Conflict: this item was modified by another user. Please refresh and try again.')
    }
  }

  const { data, error } = await supabase
    .from('budget_line_items')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('project_id', projectId)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return mapBudgetLineItemRow(data as BudgetLineItemRow)
}

export async function createBudgetLineItem(
  projectId: string,
  input: BudgetLineItemInput,
): Promise<BudgetLineItem> {
  await assertProjectAccess(projectId)
  const now = new Date().toISOString()
  const data = await supabaseMutation<BudgetLineItemRow>(client =>
    client.from('budget_line_items')
      .insert({ ...input, project_id: projectId, created_at: now, updated_at: now })
      .select()
      .single() as unknown as MutationResult<BudgetLineItemRow>
  )
  return mapBudgetLineItemRow(data)
}
