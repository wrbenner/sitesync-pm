import { supabase, transformSupabaseError } from '../client'
const PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function mapRfi(r: any) {
  return {
    ...r,
    rfiNumber: r.number ? `RFI-${String(r.number).padStart(3, '0')}` : r.id?.slice(0, 8),
    from: r.created_by || 'Turner Construction',
    to: r.assigned_to || '',
    submitDate: r.created_at?.slice(0, 10) || '',
    dueDate: r.due_date || '',
  }
}

export const getRfis = async () => {
  const { data, error } = await supabase.from('rfis').select('*').eq('project_id', PID).order('number', { ascending: false })
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map(mapRfi)
}
export const getRfiById = async (id: string) => {
  const { data, error } = await supabase.from('rfis').select('*').eq('id', id).single()
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return mapRfi(data)
}
