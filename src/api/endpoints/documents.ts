import { supabase, transformSupabaseError } from '../client'
import { validateProjectId } from '../middleware/projectScope'
import type { DrawingRow, FileRow } from '../../types/api'

export const getDrawings = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('drawings').select('*').eq('project_id', projectId).order('sheet_number')
  if (error) throw transformSupabaseError(error)
  return (data || []).map((d: DrawingRow) => ({
    ...d,
    setNumber: d.sheet_number || d.id?.slice(0, 6),
    disciplineColor: d.discipline || 'gray',
    date: d.created_at?.slice(0, 10) || '',
    sheetCount: 1,
  }))
}

export const getFiles = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('files').select('*').eq('project_id', projectId).order('name')
  if (error) throw transformSupabaseError(error)
  return (data || []).map((f: FileRow) => ({
    ...f,
    type: f.content_type?.includes('folder') ? 'folder' : 'file',
    size: f.file_size ? `${(f.file_size / 1024 / 1024).toFixed(1)} MB` : '',
    modifiedDate: f.created_at?.slice(0, 10) || '',
    itemCount: 0,
  }))
}
