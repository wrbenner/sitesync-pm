import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Integration Framework ────────────────────────────────

export function useApiKeys(orgId: string | undefined) {
  return useQuery({
    queryKey: ['api_keys', orgId],
    queryFn: async () => {
      const { data, error } = await fromTable('api_keys').select('*').eq('organization_id' as never, orgId!).order('created_at', { ascending: false })
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
      const { data, error } = await fromTable('webhooks').select('*').eq('organization_id' as never, orgId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}
