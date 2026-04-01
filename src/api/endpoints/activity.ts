import { supabase, transformSupabaseError } from '../client'
import { validateProjectId } from '../middleware/projectScope'

export const getActivityFeed = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('activity_feed').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50)
  if (error) throw transformSupabaseError(error)
  return data || []
}
