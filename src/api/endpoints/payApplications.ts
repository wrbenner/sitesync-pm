import { transformSupabaseError } from '../errors'
import { fromTable, selectScoped } from '../../lib/db/queries'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { PayApplication, CreatePayAppPayload, LienWaiverRow } from '../../types/api'
import { autoGenerateLienWaivers } from './lienWaivers'
import { paymentService } from '../../services/paymentService'
import {
  type Cents,
  addCents,
  applyRateCents,
  dollarsToCents,
  fromCents,
  subtractCents,
} from '../../types/money'


const LIEN_WAIVER_TYPES = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'] as const
type LienWaiverType = typeof LIEN_WAIVER_TYPES[number]

/**
 * AIA G702 formula for a single SOV line item.
 * Line 5  = Total Completed and Stored to Date
 * Line 5a = Retainage on completed work only (% of Line 5 minus stored materials)
 * Line 5b = Retainage on stored materials (% of stored materials)
 * Line 6  = Total Earned Less Retainage (Line 5 - Line 5a - Line 5b)
 * Line 7  = Less Previous Certificates for Payment
 * Line 8  = Current Payment Due (Line 6 - Line 7)
 *
 * @param params.prevPctComplete    Decimal fraction from 0.0 to 1.0 (e.g. 0.45 means 45% complete)
 * @param params.currentPctComplete Decimal fraction from 0.0 to 1.0 (e.g. 0.60 means 60% complete)
 */
export function computeCurrentPaymentDue(params: {
  scheduledValue: number
  prevPctComplete: number
  currentPctComplete: number
  storedMaterials: number
  retainageRate: number
  previousCertificates?: number
  storedMaterialRetainageRate?: number
}): {
  workThisPeriod: number
  totalCompletedAndStored: number
  line5: number
  line5a: number
  line5b: number
  line6: number
  retainageAmount: number
  retainageOnStored: number
  currentPaymentDue: number
} {
  const {
    scheduledValue,
    prevPctComplete,
    currentPctComplete,
    storedMaterials,
    retainageRate,
    previousCertificates = 0,
    storedMaterialRetainageRate = 0,
  } = params
  if (currentPctComplete > 1 || currentPctComplete < 0 || prevPctComplete > 1 || prevPctComplete < 0) {
    throw new Error('Percent complete values must be between 0 and 1 (0% to 100%).')
  }
  if (currentPctComplete < prevPctComplete) {
    throw new Error('Current percent complete (' + (currentPctComplete * 100).toFixed(1) + '%) cannot be less than previous percent complete (' + (prevPctComplete * 100).toFixed(1) + '%). Percent complete can only increase within a pay period.')
  }
  if (retainageRate < 0 || retainageRate > 1) {
    throw new Error('Retainage rate must be between 0 and 1.')
  }
  // Money discipline: convert dollar inputs to integer cents at the boundary,
  // perform all arithmetic on Cents (per src/types/money.ts), convert back to
  // dollars at the boundary so the public return shape stays unchanged.
  const svC: Cents = dollarsToCents(scheduledValue)
  const storedC: Cents = dollarsToCents(storedMaterials)
  const prevCertC: Cents = dollarsToCents(previousCertificates)

  const previousWorkC: Cents = applyRateCents(svC, prevPctComplete)
  const currentWorkC: Cents = applyRateCents(svC, currentPctComplete)
  const workThisPeriodC: Cents = subtractCents(currentWorkC, previousWorkC)
  const totalCompletedAndStoredC: Cents = addCents(currentWorkC, storedC)
  // AIA G702 line numbers
  const line5C: Cents = totalCompletedAndStoredC
  const line5aC: Cents = applyRateCents(subtractCents(line5C, storedC), retainageRate)
  const line5bC: Cents = applyRateCents(storedC, storedMaterialRetainageRate)
  const line6C: Cents = subtractCents(subtractCents(line5C, line5aC), line5bC)
  const currentPaymentDueC: Cents = subtractCents(line6C, prevCertC)

  return {
    workThisPeriod: fromCents(workThisPeriodC) / 100,
    totalCompletedAndStored: fromCents(totalCompletedAndStoredC) / 100,
    line5: fromCents(line5C) / 100,
    line5a: fromCents(line5aC) / 100,
    line5b: fromCents(line5bC) / 100,
    line6: fromCents(line6C) / 100,
    retainageAmount: fromCents(line5aC) / 100,
    retainageOnStored: fromCents(line5bC) / 100,
    currentPaymentDue: fromCents(currentPaymentDueC) / 100,
  }
}

/**
 * Fetches all pay applications for a project.
 *
 * Returns:
 *   - Empty array: project exists but has no pay applications yet (UI should show empty state)
 *   - Populated array: one or more pay applications found
 *   - Throws Error: network failure, permission denied, or other fetch error (user-friendly message)
 */
export const getPayApplications = async (projectId: string): Promise<PayApplication[]> => {
  await assertProjectAccess(projectId)
  const { data, error } = await selectScoped('pay_applications', projectId, '*')
    .order('application_number', { ascending: false })
  if (error) {
    if (
      error.code === '42501' ||
      error.message?.toLowerCase().includes('permission') ||
      error.message?.toLowerCase().includes('policy')
    ) {
      throw new Error('You do not have permission to view payment applications for this project.')
    }
    throw transformSupabaseError(error)
  }
  return (data || []) as unknown as PayApplication[]
}

/**
 * Fetches pay applications along with a flag indicating whether any schedule of values
 * (budget_items) exist for the project. The UI uses `hasScheduleOfValues` to show a
 * prerequisite warning before allowing pay app creation.
 */
export const getPayApplicationsWithMeta = async (
  projectId: string,
): Promise<{ payApps: PayApplication[]; hasScheduleOfValues: boolean }> => {
  const [payApps, sovResult] = await Promise.all([
    getPayApplications(projectId),
    fromTable('budget_items')
      .select('id', { count: 'exact', head: true })
      .eq('project_id' as never, projectId),
  ])
  const hasScheduleOfValues = (sovResult.count ?? 0) > 0
  return { payApps, hasScheduleOfValues }
}

/**
 * Fetches pay applications and whether any schedule of values (budget_items) exist.
 * The UI uses `hasScheduleOfValues` to show a prerequisite warning before allowing
 * pay app creation (acceptance criteria item 12).
 * `isLoading: false` is a discriminant so callers can use this as a loaded-state sentinel.
 */
export const getPayApplicationsWithContext = async (
  projectId: string,
): Promise<{ payApps: PayApplication[]; hasScheduleOfValues: boolean; isLoading: false }> => {
  const [payApps, sovResult] = await Promise.all([
    getPayApplications(projectId),
    fromTable('budget_items')
      .select('id', { count: 'exact', head: true })
      .eq('project_id' as never, projectId),
  ])
  const hasScheduleOfValues = (sovResult.count ?? 0) > 0
  return { payApps, hasScheduleOfValues, isLoading: false }
}

export const getPayApplicationById = async (
  projectId: string,
  id: string,
): Promise<PayApplication> => {
  await assertProjectAccess(projectId)
  const { data, error } = await selectScoped('pay_applications', projectId, '*')
    .eq('id' as never, id)
    .single()
  if (error) throw transformSupabaseError(error)
  return data as unknown as PayApplication
}

export const createPayApplication = async (
  projectId: string,
  payload: CreatePayAppPayload,
): Promise<PayApplication> => {
  validateProjectId(projectId)
  const dbPayload = sanitizePayAppPayload(payload as unknown as Record<string, unknown>)
  const ocs = (dbPayload.original_contract_sum as number) ?? 0
  const nco = (dbPayload.net_change_orders as number) ?? 0
  if (dbPayload.contract_sum_to_date == null) {
    dbPayload.contract_sum_to_date = ocs + nco
  }
  const { data, error } = await fromTable('pay_applications')
    .insert({ ...dbPayload, project_id: projectId, status: 'draft' } as never)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as unknown as PayApplication
}

export interface UpsertPayAppPayload {
  id?: string
  contract_id: string
  application_number?: number
  period_to: string
  original_contract_sum?: number | null
  net_change_orders?: number | null
  contract_sum_to_date?: number | null
  total_completed_and_stored?: number | null
  retainage?: number | null
  total_earned_less_retainage?: number | null
  less_previous_certificates?: number | null
  current_payment_due?: number | null
  balance_to_finish?: number | null
}

/**
 * Strip fields that don't exist on the pay_applications table before sending to Supabase.
 * The UI may pass `period_from` for display, but the DB table doesn't have it.
 */
function sanitizePayAppPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const { period_from: _pf, ...safe } = payload
  return safe
}

export const upsertPayApplication = async (
  projectId: string,
  payload: UpsertPayAppPayload,
): Promise<PayApplication> => {
  validateProjectId(projectId)
  const { id, ...rest } = payload
  const dbPayload = sanitizePayAppPayload(rest as Record<string, unknown>)
  // Compute contract_sum_to_date if not provided
  const ocs = (dbPayload.original_contract_sum as number) ?? 0
  const nco = (dbPayload.net_change_orders as number) ?? 0
  if (dbPayload.contract_sum_to_date == null) {
    dbPayload.contract_sum_to_date = ocs + nco
  }
  if (id) {
    const { data, error } = await fromTable('pay_applications')
      .update({ ...dbPayload, updated_at: new Date().toISOString() } as never)
      .eq('project_id' as never, projectId)
      .eq('id' as never, id)
      .select()
      .single()
    if (error) throw transformSupabaseError(error)
    return data as unknown as PayApplication
  }
  const { data, error } = await fromTable('pay_applications')
    .insert({ ...dbPayload, project_id: projectId, status: 'draft' } as never)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as unknown as PayApplication
}

export const submitPayApplication = async (
  projectId: string,
  id: string,
): Promise<PayApplication> => {
  validateProjectId(projectId)
  // Route through the lifecycle machine so invalid status writes are rejected.
  const transition = await paymentService.transitionStatus(id, 'submitted')
  if (transition.error) {
    throw new Error(transition.error.message)
  }
  const { data, error } = await selectScoped('pay_applications', projectId, '*')
    .eq('id' as never, id)
    .single()
  if (error) throw transformSupabaseError(error)
  return data as unknown as PayApplication
}

// Approves a pay application and auto-generates one conditional_progress lien waiver
// per subcontractor line item with payment > 0. This is the canonical approval path;
// the paymentMachine.ts 'approved' entry action documents this same contract.
export const approvePayApplication = async (
  projectId: string,
  payAppId: string,
): Promise<{ payApp: PayApplication; waivers: LienWaiverRow[] }> => {
  await assertProjectAccess(projectId)
  // Route through the lifecycle machine so only a valid gc_review/owner_review
  // → approved transition is allowed for the acting user's role.
  const transition = await paymentService.transitionStatus(payAppId, 'approved')
  if (transition.error) {
    throw new Error(transition.error.message)
  }
  const { data, error } = await selectScoped('pay_applications', projectId, '*')
    .eq('id' as never, payAppId)
    .single()
  if (error) throw transformSupabaseError(error)
  const waivers = await autoGenerateLienWaivers(projectId, payAppId)
  return { payApp: data as unknown as PayApplication, waivers }
}

/**
 * Marks an approved pay application as paid. Transitions via the payment state
 * machine (approved → paid) and records the payment timestamp.
 */
export const markPayApplicationAsPaid = async (
  projectId: string,
  payAppId: string,
): Promise<PayApplication> => {
  await assertProjectAccess(projectId)
  const transition = await paymentService.transitionStatus(payAppId, 'paid')
  if (transition.error) {
    throw new Error(transition.error.message)
  }
  // Record paid timestamp
  await fromTable('pay_applications')
    .update({ paid_at: new Date().toISOString() } as never)
    .eq('id' as never, payAppId)
  const { data, error } = await selectScoped('pay_applications', projectId, '*')
    .eq('id' as never, payAppId)
    .single()
  if (error) throw transformSupabaseError(error)
  return data as unknown as PayApplication
}

/**
 * Validates that all active subcontractors and vendors paid in a given pay period
 * have submitted at least a conditional_progress lien waiver linked to the pay application.
 *
 * Returns { complete: true } when every active sub has a matching waiver.
 * Returns { complete: false, missingWaivers: [...] } listing every vendor still outstanding.
 *
 * Call this before allowing submitPayApplication so the UI can block submission
 * and surface a waiver warning per subcontractor.
 */
export const validateLienWaiverCompleteness = async (params: {
  projectId: string
  payAppId: string
  periodNumber: number
}): Promise<{
  complete: boolean
  missingWaivers: Array<{
    vendorName: string
    vendorId: string
    requiredType: LienWaiverType
  }>
}> => {
  const { projectId, payAppId } = params
  await assertProjectAccess(projectId)

  const [waiversResult, invoicesResult, purchaseOrdersResult] = await Promise.all([
    fromTable('lien_waivers')
      .select('vendor_id, waiver_type')
      .eq('pay_application_id' as never, payAppId),
    selectScoped('subcontractor_invoices', projectId, 'vendor_id, vendor_name, amount')
      .eq('pay_application_id' as never, payAppId)
      .gt('amount' as never, 0),
    selectScoped('purchase_orders', projectId, 'vendor_id, vendor_name, period_amount')
      .eq('pay_application_id' as never, payAppId)
      .gt('period_amount' as never, 0),
  ])

  if (waiversResult.error) throw transformSupabaseError(waiversResult.error)

  // Merge vendors from both invoices and purchase orders, deduplicating by vendor_id.
  const vendorMap = new Map<string, string>()

  type VendorRow = { vendor_id: string | null; vendor_name: string | null }
  for (const row of (invoicesResult.data ?? []) as unknown as VendorRow[]) {
    if (row.vendor_id && !vendorMap.has(row.vendor_id)) {
      vendorMap.set(row.vendor_id, row.vendor_name ?? row.vendor_id)
    }
  }
  for (const row of (purchaseOrdersResult.data ?? []) as unknown as VendorRow[]) {
    if (row.vendor_id && !vendorMap.has(row.vendor_id)) {
      vendorMap.set(row.vendor_id, row.vendor_name ?? row.vendor_id)
    }
  }

  // Build a set of vendor_ids that already have a conditional_progress waiver.
  type WaiverShortRow = { vendor_id: string | null; waiver_type: string | null }
  const coveredVendorIds = new Set<string>(
    ((waiversResult.data ?? []) as unknown as WaiverShortRow[])
      .filter((w) => w.waiver_type === 'conditional_progress')
      .map((w) => (w.vendor_id ?? '') as string)
      .filter((id) => id.length > 0),
  )

  const missingWaivers: Array<{
    vendorName: string
    vendorId: string
    requiredType: LienWaiverType
  }> = []

  for (const [vendorId, vendorName] of vendorMap.entries()) {
    if (!coveredVendorIds.has(vendorId)) {
      missingWaivers.push({ vendorId, vendorName, requiredType: 'conditional_progress' })
    }
  }

  return { complete: missingWaivers.length === 0, missingWaivers }
}

/**
 * Advisory lien waiver validation for pay application submission.
 *
 * Queries the lien_waivers table for the given pay application, then checks that
 * at least one conditional_progress waiver exists for every subcontractor who has
 * a line item billed in this pay period. Returns a warning-only result so the
 * frontend can surface missing waivers without blocking submission.
 *
 * Returns { valid: true } when all subs are covered.
 * Returns { valid: false, missingWaivers: [...] } listing each vendor still outstanding.
 * This is advisory only. Submission is NOT blocked by this function.
 */
export const validateLienWaiversForSubmission = async (
  payApplicationId: string,
): Promise<{
  valid: boolean
  missingWaivers: Array<{ vendor_name: string; waiver_type: LienWaiverType }>
}> => {
  const [waiversResult, lineItemsResult] = await Promise.all([
    fromTable('lien_waivers')
      .select('vendor_id, vendor_name, waiver_type')
      .eq('pay_application_id' as never, payApplicationId),
    fromTable('pay_application_line_items')
      .select('vendor_id, vendor_name, amount_this_period')
      .eq('pay_application_id' as never, payApplicationId)
      .gt('amount_this_period' as never, 0),
  ])

  if (waiversResult.error) throw transformSupabaseError(waiversResult.error)
  if (lineItemsResult.error) throw transformSupabaseError(lineItemsResult.error)

  type LineItemRow = { vendor_id: string | null; vendor_name: string | null; amount_this_period: number | null }
  type WaiverWithNameRow = { vendor_id: string | null; vendor_name: string | null; waiver_type: string | null }

  // Collect every subcontractor with a billed line item this period, deduplicated by vendor_id.
  const vendorMap = new Map<string, string>()
  for (const row of (lineItemsResult.data ?? []) as unknown as LineItemRow[]) {
    if (row.vendor_id && !vendorMap.has(row.vendor_id)) {
      vendorMap.set(row.vendor_id, row.vendor_name ?? row.vendor_id)
    }
  }

  // Build a set of vendor_ids that already have a conditional_progress waiver.
  const coveredVendorIds = new Set<string>(
    ((waiversResult.data ?? []) as unknown as WaiverWithNameRow[])
      .filter((w) => w.waiver_type === 'conditional_progress')
      .map((w) => (w.vendor_id ?? '') as string)
      .filter((id) => id.length > 0),
  )

  const missingWaivers: Array<{ vendor_name: string; waiver_type: LienWaiverType }> = []
  for (const [vendorId, vendorName] of vendorMap.entries()) {
    if (!coveredVendorIds.has(vendorId)) {
      missingWaivers.push({ vendor_name: vendorName, waiver_type: 'conditional_progress' })
    }
  }

  return { valid: missingWaivers.length === 0, missingWaivers }
}
