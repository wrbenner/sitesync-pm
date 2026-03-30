import { supabase, transformSupabaseError } from '../client'
const PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
export const getAiInsights = async () => {
  const { data, error } = await supabase.from('ai_insights').select('*').eq('project_id', PID).eq('dismissed', false).order('created_at', { ascending: false })
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return data || []
}
export const getAiConversation = async () => {
  return [] // AI conversations are handled by useProjectAI hook
}
export const getVisionContent = async () => {
  return null // Vision page uses static content
}
