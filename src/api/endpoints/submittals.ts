import { supabase, transformSupabaseError } from '../client'
import { validateProjectId } from '../middleware/projectScope'
import type { SubmittalRow } from '../../types/api'

function mapSubmittal(s: SubmittalRow) {
  return {
    ...s,
    submittalNumber: s.number ? `SUB-${String(s.number).padStart(3, '0')}` : s.id?.slice(0, 8),
    from: s.subcontractor || s.created_by || 'Contractor',
    dueDate: s.due_date || '',
  }
}

export const getSubmittals = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('submittals').select('*').eq('project_id', projectId).order('number', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return (data || []).map(mapSubmittal)
}
export const getSubmittalById = async (projectId: string, id: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('submittals').select('*').eq('project_id', projectId).eq('id', id).single()
  if (error) throw transformSupabaseError(error)
  return mapSubmittal(data)
}
