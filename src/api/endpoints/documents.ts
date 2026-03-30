import { supabase, transformSupabaseError } from '../client'
const PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

export const getDrawings = async () => {
  const { data, error } = await supabase.from('drawings').select('*').eq('project_id', PID).order('sheet_number')
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map((d: any) => ({
    ...d,
    setNumber: d.sheet_number || d.id?.slice(0, 6),
    disciplineColor: d.discipline || 'gray',
    date: d.created_at?.slice(0, 10) || '',
    sheetCount: 1,
  }))
}

export const getFiles = async () => {
  const { data, error } = await supabase.from('files').select('*').eq('project_id', PID).order('name')
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map((f: any) => ({
    ...f,
    type: f.content_type?.includes('folder') ? 'folder' : 'file',
    size: f.file_size ? `${(f.file_size / 1024 / 1024).toFixed(1)} MB` : '',
    modifiedDate: f.created_at?.slice(0, 10) || '',
    itemCount: 0,
  }))
}
