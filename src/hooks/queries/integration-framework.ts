import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import { scoped } from '../../lib/supabase/orgScope'

// ── Integration Framework ────────────────────────────────

export function useApiKeys(orgId: string | undefined) {
  return useQuery({
    queryKey: ['api_keys', orgId],
    queryFn: async () => {
      const { data, error } = await scoped(
        fromTable('api_keys').select('*'),
        orgId,
      ).order('created_at', { ascending: false })
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
      const { data, error } = await scoped(
        fromTable('webhooks').select('*'),
        orgId,
      ).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}
