import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

export function useConversations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['conversations', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('project_id', projectId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useConversationMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['chat_messages', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!conversationId,
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      project_id: string
      user_id?: string
      title?: string
      context_type?: string
      context_id?: string
      route?: string
    }) => {
      const { data, error } = await supabase
        .from('conversations')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', v.project_id] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create conversation'),
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      conversation_id: string
      role: string
      content: string
      metadata?: Record<string, unknown>
    }) => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['chat_messages', v.conversation_id] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to send message'),
  })
}
