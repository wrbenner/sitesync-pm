import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Daily Log Entries ────────────────────────────────────

export function useDailyLogEntries(dailyLogId: string | undefined) {
  return useQuery({
    queryKey: ['daily_log_entries', dailyLogId],
    queryFn: async () => {
      const { data, error } = await fromTable('daily_log_entries')
        .select('*')
        .eq('daily_log_id' as never, dailyLogId!)
        .order('created_at')
      if (error) throw error
      return data
    },
    enabled: !!dailyLogId,
  })
}
