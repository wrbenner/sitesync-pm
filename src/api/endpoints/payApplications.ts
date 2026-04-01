import { supabase, transformSupabaseError } from '../client'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { PayApplication, CreatePayAppPayload, LienWaiverRow } from '../../types/api'
import { autoGenerateLienWaivers } from './lienWaivers'

// AIA G702 formula for a single SOV line item.
// Current Payment Due = (SOV Scheduled Value x % Complete) + Stored Materials - Retainage
export function computeCurrentPaymentDue(params: {
  scheduledValue: number
  prevPctComplete: number
  currentPctComplete: number
  storedMaterials: number
  retainageRate: number
  previousCertificates?: number
}): {
  workThisPeriod: number
  totalCompletedAndStored: number
  retainageAmount: number
  currentPaymentDue: number
} {
  const {
    scheduledValue,
    prevPctComplete,
    currentPctComplete,
    storedMaterials,
    retainageRate,
    previousCertificates = 0,
  } = params
  const previousWork = scheduledValue * (prevPctComplete / 100)
  const workThisPeriod = scheduledValue * (currentPctComplete / 100) - previousWork
  const totalCompletedAndStored = previousWork + workThisPeriod + storedMaterials
  const retainageAmount = totalCompletedAndStored * retainageRate
  const currentPaymentDue = totalCompletedAndStored - retainageAmount - previousCertificates
  return { workThisPeriod, totalCompletedAndStored, retainageAmount, currentPaymentDue }
}

export const getPayApplications = async (projectId: string): Promise<PayApplication[]> => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase
    .from('pay_applications')
    .select('*')
    .eq('project_id', projectId)
    .order('application_number', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return (data || []) as PayApplication[]
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
