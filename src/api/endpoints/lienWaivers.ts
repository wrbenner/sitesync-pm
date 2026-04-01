import { supabase, transformSupabaseError } from '../client'
import { validateProjectId } from '../middleware/projectScope'
import type { LienWaiverType } from '../../types/api'

export type { LienWaiverType }

export interface LienWaiver {
  id: string
  project_id: string
  subcontractor_id: string | null
  payment_period: string | null
  type: LienWaiverType
  amount: number | null
  status: 'pending' | 'received' | 'missing'
  payment_app_id: string | null
  created_at: string | null
  received_at: string | null
}

export const getLienWaivers = async (projectId: string): Promise<LienWaiver[]> => {
  validateProjectId(projectId)
  const { data, error } = await supabase
    .from('lien_waivers')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return (data || []) as LienWaiver[]
}

export const createLienWaiver = async (
  projectId: string,
  waiverData: Omit<LienWaiver, 'id' | 'created_at' | 'received_at'>,
): Promise<LienWaiver> => {
  validateProjectId(projectId)
  const { data, error } = await supabase
    .from('lien_waivers')
    .insert({ ...waiverData, project_id: projectId })
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as LienWaiver
}

export const markReceived = async (waiverId: string, receivedAt: string): Promise<LienWaiver> => {
  const { data, error } = await supabase
    .from('lien_waivers')
    .update({ status: 'received', received_at: receivedAt })
    .eq('id', waiverId)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as LienWaiver
}

export interface LienWaiverSummary {
  total: number
  received: number
  missing: number
  missingSubcontractors: string[]
}

export const generateLienWaiver = async (
  projectId: string,
  subcontractorId: string,
  payAppId: string,
  type: LienWaiverType,
): Promise<LienWaiver> => {
  validateProjectId(projectId)
  const { data, error } = await supabase
    .from('lien_waivers')
    .insert({
      project_id: projectId,
      subcontractor_id: subcontractorId,
      payment_app_id: payAppId,
      type,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as LienWaiver
}

export const markLienWaiverReceived = async (waiverId: string): Promise<LienWaiver> => {
  return markReceived(waiverId, new Date().toISOString())
}

export const updateLienWaiverStatus = async (waiverId: string, status: LienWaiver['status']): Promise<LienWaiver> => {
  const { data, error } = await supabase
    .from('lien_waivers')
    .update({ status, ...(status === 'received' ? { received_at: new Date().toISOString() } : {}) })
    .eq('id', waiverId)
    .select()
    .single()
  if (error) throw transformSupabaseError(error)
  return data as LienWaiver
}

export const getLienWaiverSummary = async (projectId: string): Promise<LienWaiverSummary> => {
  validateProjectId(projectId)
  const waivers = await getLienWaivers(projectId)
  const received = waivers.filter(w => w.status === 'received').length
  const missingWaivers = waivers.filter(w => w.status === 'missing')
  const missingSubcontractors = [
    ...new Set(
      missingWaivers
        .map(w => w.subcontractor_id)
        .filter((id): id is string => id !== null),
    ),
  ]
  return {
    total: waivers.length,
    received,
    missing: missingWaivers.length,
    missingSubcontractors,
  }
}
