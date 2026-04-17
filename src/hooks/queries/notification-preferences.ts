import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Notification Preferences ─────────────────────────────

export function useNotificationPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ['notification_preferences', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId!)
        .single()
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
      return data
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}
