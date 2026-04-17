import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getLienWaivers } from '../../api/endpoints/lienWaivers'



// ── Lien Waivers ─────────────────────────────────────────

export function useLienWaivers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['lien_waivers', projectId],
    queryFn: () => getLienWaivers(projectId!),
    enabled: !!projectId,
  })
}

export function useLienWaiversByPayApp(payAppId: string | undefined) {
  return useQuery({
    queryKey: ['lien_waivers', 'pay_app', payAppId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lien_waivers')
        .select('*')
        .eq('pay_app_id', payAppId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!payAppId,
  })
}
