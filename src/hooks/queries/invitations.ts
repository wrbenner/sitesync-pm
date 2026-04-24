import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

export function useInvitations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['invitations', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useCreateInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      organization_id: string
      project_id?: string
      email: string
      role: string
      permissions?: unknown[]
      token: string
      invited_by?: string
      expires_at?: string
    }) => {
      const { data, error } = await supabase
        .from('user_invitations')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, v) => {
      if (v.project_id) {
        queryClient.invalidateQueries({ queryKey: ['invitations', v.project_id] })
      }
      toast.success('Invitation sent')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to send invitation'),
  })
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId?: string }) => {
      const { data, error } = await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return { ...data, projectId }
    },
    onSuccess: (_d, v) => {
      if (v.projectId) {
        queryClient.invalidateQueries({ queryKey: ['invitations', v.projectId] })
      }
      toast.success('Invitation revoked')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to revoke invitation'),
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ token, acceptedBy }: { token: string; acceptedBy: string }) => {
      const { data, error } = await supabase
        .from('user_invitations')
        .update({ status: 'accepted', accepted_by: acceptedBy, accepted_at: new Date().toISOString() })
        .eq('token', token)
        .eq('status', 'pending')
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data.project_id) {
        queryClient.invalidateQueries({ queryKey: ['invitations', data.project_id] })
      }
      toast.success('Invitation accepted')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to accept invitation'),
  })
}
