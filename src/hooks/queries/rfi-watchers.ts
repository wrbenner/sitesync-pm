import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── RFI Watchers ─────────────────────────────────────────

export function useRFIWatchers(rfiId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_watchers', rfiId],
    queryFn: async () => {
      const { data, error } = await fromTable('rfi_watchers').select('*').eq('rfi_id' as never, rfiId!)
      if (error) throw error
      return data
    },
    enabled: !!rfiId,
  })
}
