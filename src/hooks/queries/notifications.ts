import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  Notification,
} from '../../types/database'

// ── Notifications ─────────────────────────────────────────

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('is_read', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Notification[]
    },
    enabled: !!userId,
  })
}
