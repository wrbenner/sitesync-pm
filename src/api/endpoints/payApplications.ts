import { supabase, transformSupabaseError } from '../client'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { PayApplication, CreatePayAppPayload, LienWaiverRow } from '../../types/api'
import { autoGenerateLienWaivers } from './lienWaivers'

/**
 * AIA G702 formula for a single SOV line item.
 * Retainage on stored materials defaults to 0% per standard AIA practice but is configurable per contract.
 * Current Payment Due = (Total Completed and Stored to Date) - (Retainage on Completed Work) - (Retainage on Stored Materials) - (Previous Certificates for Payment)
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
  // All monetary inputs are in dollars. Internal calculations use Math.round to avoid floating-point drift on penny amounts.
  const previousWork = Math.round(scheduledValue * prevPctComplete) / 100
  const currentWork = Math.round(scheduledValue * currentPctComplete) / 100
  const workThisPeriod = Math.round((currentWork - previousWork) * 100) / 100
  const totalCompletedAndStored = previousWork + workThisPeriod + storedMaterials
  const retainageOnWork = Math.round((previousWork + workThisPeriod) * retainageRate * 100) / 100
  const retainageOnStored = Math.round(storedMaterials * storedMaterialRetainageRate * 100) / 100
  const currentPaymentDue = Math.round((totalCompletedAndStored - retainageOnWork - retainageOnStored - previousCertificates) * 100) / 100
  return { workThisPeriod, totalCompletedAndStored, retainageAmount: retainageOnWork, retainageOnStored, currentPaymentDue }
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
  try {
    const { data, error } = await supabase
      .from('pay_applications')
      .select('*')
      .eq('project_id', projectId)
      .order('application_number', { ascending: false })
    if (error) throw error
    return (data || []) as PayApplication[]
  } catch (err: unknown) {
    const supaError = err && typeof err === 'object' && 'code' in err ? err as { code?: string; message?: string } : null
    if (supaError?.code === 'PGRST301' || supaError?.code === '42501') {
      throw new Error('You do not have permission to view payment applications for this project.')
    }
    if (supaError?.code === 'PGRST116') {
      throw new Error('Project not found. It may have been deleted or you may not have access.')
    }
    throw new Error('Unable to load payment applications. Please check your connection and try again.')
  }
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
