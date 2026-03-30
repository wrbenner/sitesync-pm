import { supabase, transformSupabaseError } from '../client'
const PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function mapSubmittal(s: any) {
  return {
    ...s,
    submittalNumber: s.number ? `SUB-${String(s.number).padStart(3, '0')}` : s.id?.slice(0, 8),
    from: s.subcontractor || s.created_by || 'Contractor',
    dueDate: s.due_date || '',
  }
}

export const getSubmittals = async () => {
  const { data, error } = await supabase.from('submittals').select('*').eq('project_id', PID).order('number', { ascending: false })
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map(mapSubmittal)
}
export const getSubmittalById = async (id: string) => {
  const { data, error } = await supabase.from('submittals').select('*').eq('id', id).single()
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return mapSubmittal(data)
}
