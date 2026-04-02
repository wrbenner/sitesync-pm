import { supabase, transformSupabaseError } from '../client'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { PayApplication, CreatePayAppPayload, LienWaiverRow } from '../../types/api'
import { autoGenerateLienWaivers } from './lienWaivers'

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
  // All monetary inputs are in dollars. Each intermediate value is rounded to cents before
  // further arithmetic to match AIA G702 requirements and avoid floating-point penny drift.
  const previousWork = Math.round(scheduledValue * prevPctComplete * 100) / 100
  const currentWork = Math.round(scheduledValue * currentPctComplete * 100) / 100
  const workThisPeriod = Math.round((currentWork - previousWork) * 100) / 100
  const totalCompletedAndStored = previousWork + workThisPeriod + storedMaterials
  // AIA G702 line numbers
  const line5 = totalCompletedAndStored
  const line5a = Math.round((line5 - storedMaterials) * retainageRate * 100) / 100
  const line5b = Math.round(storedMaterials * storedMaterialRetainageRate * 100) / 100
  const line6 = Math.round((line5 - line5a - line5b) * 100) / 100
  const currentPaymentDue = Math.round((line6 - previousCertificates) * 100) / 100
  return { workThisPeriod, totalCompletedAndStored, line5, line5a, line5b, line6, retainageAmount: line5a, retainageOnStored: line5b, currentPaymentDue }
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
  const { data, error } = await supabase
    .from('pay_applications')
    .select('*')
    .eq('project_id', projectId)
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
  return (data || []) as PayApplication[]
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
    supabase
      .from('budget_items')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('deleted_at', null),
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
    supabase
      .from('budget_items')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('deleted_at', null),
  ])
  const hasScheduleOfValues = (sovResult.count ?? 0) > 0
  return { payApps, hasScheduleOfValues, isLoading: false }
}

export const getPayApplicationById = async (
  projectId: string,
  id: string,
): Promise<PayApplication> => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase
    .from('pay_applications')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', id)
    .single()
  if (error) throw transformSupabaseError(error)
  return data as PayApplication
}

export const createPayApplication = async (
  projectId: string,
  payload: CreatePayAppPayload,
): Promise<PayApplication> => {
  validateProjectId(projectId)
  const { data, error } = await supabase
    .from('pay_applications')
    .insert({ ...payload, project_id: projectId, status: 'draft' })
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as PayApplication
}

export interface UpsertPayAppPayload {
  id?: string
  contract_id: string
  application_number?: number
  period_from?: string | null
  period_to: string
  original_contract_sum?: number | null
  net_change_orders?: number | null
  total_completed_and_stored?: number | null
  retainage?: number | null
  total_earned_less_retainage?: number | null
  less_previous_certificates?: number | null
  current_payment_due?: number | null
  balance_to_finish?: number | null
}

export const upsertPayApplication = async (
  projectId: string,
  payload: UpsertPayAppPayload,
): Promise<PayApplication> => {
  validateProjectId(projectId)
  const { id, ...rest } = payload
  if (id) {
    const { data, error } = await supabase
      .from('pay_applications')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('id', id)
      .select()
      .single()
    if (error) throw transformSupabaseError(error)
    return data as PayApplication
  }
  const { data, error } = await supabase
    .from('pay_applications')
    .insert({ ...rest, project_id: projectId, status: 'draft' })
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as PayApplication
}

export const submitPayApplication = async (
  projectId: string,
  id: string,
): Promise<PayApplication> => {
  validateProjectId(projectId)
  const { data, error } = await supabase
    .from('pay_applications')
    .update({
      status: 'submitted',
      submitted_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('id', id)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as PayApplication
}

// Approves a pay application and auto-generates one conditional_progress lien waiver
// per subcontractor line item with payment > 0. This is the canonical approval path;
// the paymentMachine.ts 'approved' entry action documents this same contract.
export const approvePayApplication = async (
  projectId: string,
  payAppId: string,
): Promise<{ payApp: PayApplication; waivers: LienWaiverRow[] }> => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase
    .from('pay_applications')
    .update({
      status: 'approved',
      approved_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('id', payAppId)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  const waivers = await autoGenerateLienWaivers(projectId, payAppId)
  return { payApp: data as PayApplication, waivers }
}
