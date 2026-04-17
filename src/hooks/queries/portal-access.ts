import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Portal Access ────────────────────────────────────────

export function usePortalAccessTokens(projectId: string | undefined) {
  return useQuery({
    queryKey: ['portal_access_tokens', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_access_tokens')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function usePortalAccessByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['portal_access_token', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_access_tokens')
        .select('*, projects(*)')
        .eq('token', token!)
        .eq('active', true)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!token,
  })
}
