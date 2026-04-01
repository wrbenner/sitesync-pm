import { supabase, transformSupabaseError } from '../client'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { PayApplication, CreatePayAppPayload } from '../../types/api'

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
