import { supabase, transformSupabaseError } from '../client'
import { validateProjectId } from '../middleware/projectScope'
import type { RfiRow } from '../../types/api'

function mapRfi(r: RfiRow) {
  return {
    ...r,
    rfiNumber: r.number ? `RFI-${String(r.number).padStart(3, '0')}` : r.id?.slice(0, 8),
    from: r.created_by || 'Turner Construction',
    to: r.assigned_to || '',
    submitDate: r.created_at?.slice(0, 10) || '',
    dueDate: r.due_date || '',
  }
}

export const getRfis = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('rfis').select('*').eq('project_id', projectId).order('number', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return (data || []).map(mapRfi)
}
export const getRfiById = async (projectId: string, id: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('rfis').select('*').eq('project_id', projectId).eq('id', id).single()
  if (error) throw transformSupabaseError(error)
  return mapRfi(data)
}
