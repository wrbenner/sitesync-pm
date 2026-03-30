import { supabase, transformSupabaseError } from '../client'
const PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
export const getActivityFeed = async () => {
  const { data, error } = await supabase.from('activity_feed').select('*').eq('project_id', PID).order('created_at', { ascending: false }).limit(50)
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return data || []
}
