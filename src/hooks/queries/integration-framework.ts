import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Integration Framework ────────────────────────────────

export function useApiKeys(orgId: string | undefined) {
  return useQuery({
    queryKey: ['api_keys', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('api_keys').select('*').eq('organization_id', orgId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}

export function useWebhooks(orgId: string | undefined) {
  return useQuery({
    queryKey: ['webhooks', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('webhooks').select('*').eq('organization_id', orgId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}
