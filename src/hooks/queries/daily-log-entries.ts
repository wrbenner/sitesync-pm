import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Daily Log Entries ────────────────────────────────────

export function useDailyLogEntries(dailyLogId: string | undefined) {
  return useQuery({
    queryKey: ['daily_log_entries', dailyLogId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_log_entries')
        .select('*')
        .eq('daily_log_id', dailyLogId!)
        .order('created_at')
      if (error) throw error
      return data
    },
    enabled: !!dailyLogId,
  })
}
