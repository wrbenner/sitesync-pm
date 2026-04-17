import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── RFI Watchers ─────────────────────────────────────────

export function useRFIWatchers(rfiId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_watchers', rfiId],
    queryFn: async () => {
      const { data, error } = await supabase.from('rfi_watchers').select('*').eq('rfi_id', rfiId!)
      if (error) throw error
      return data
    },
    enabled: !!rfiId,
  })
}
