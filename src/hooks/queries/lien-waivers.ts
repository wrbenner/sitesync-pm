import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getLienWaivers } from '../../api/endpoints/lienWaivers'
import { toast } from 'sonner'



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

export function useCreateLienWaiver() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      project_id: string
      contractor_name: string
      waiver_state: string
      amount: number | null
      through_date: string | null
      status: string
      notes: string | null
    }) => {
      const { data, error } = await supabase
        .from('lien_waivers')
        .insert({
          ...payload,
          amount: payload.amount ?? 0,
          through_date: payload.through_date ?? '',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lien_waivers', variables.project_id] })
      toast.success('Lien waiver created')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create lien waiver')
    },
  })
}

export function useDeleteLienWaiver() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('lien_waivers')
        .delete()
        .eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lien_waivers', variables.projectId] })
      toast.success('Lien waiver deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete lien waiver')
    },
  })
}
