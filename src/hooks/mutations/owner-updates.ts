import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { ownerUpdatesKeys, type OwnerUpdate } from '../queries/owner-updates'

export interface CreateOwnerUpdateInput {
  project_id: string
  title: string
  content: string
  publish?: boolean
  created_by?: string | null
}

export function useCreateOwnerUpdate() {
  const queryClient = useQueryClient()
  return useMutation<OwnerUpdate, Error, CreateOwnerUpdateInput>({
    mutationFn: async (input) => {
      const title = input.title.trim()
      const content = input.content.trim()
      if (!title) throw new Error('Title is required')

      const publish = input.publish ?? true
      const payload = {
        project_id: input.project_id,
        title,
        content: content || null,
        created_by: input.created_by ?? null,
        published: publish,
        published_at: publish ? new Date().toISOString() : null,
      }

      const { data, error } = await supabase
        .from('owner_updates')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as OwnerUpdate
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ownerUpdatesKeys.byProject(variables.project_id),
      })
      toast.success('Update posted')
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to post update')
    },
  })
}

/**
 * Acknowledge stub.
 *
 * TODO: when the `owner_update_acknowledgements` table is added, replace this
 * with:
 *   supabase.from('owner_update_acknowledgements').upsert({
 *     owner_update_id, user_id, acknowledged_at: new Date().toISOString(),
 *   }, { onConflict: 'owner_update_id,user_id' })
 * and invalidate ownerUpdatesKeys.acknowledgements(updateId, userId).
 *
 * For now it no-ops client-side so the button exists, gives feedback, and
 * surfaces the missing-backend gap without throwing.
 */
export function useAcknowledgeOwnerUpdate() {
  return useMutation<
    { pending: true },
    Error,
    { owner_update_id: string; user_id: string }
  >({
    mutationFn: async () => {
      return { pending: true }
    },
    onSuccess: () => {
      toast.message('Acknowledgements coming soon', {
        description:
          'The owner_update_acknowledgements table is not yet deployed.',
      })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to acknowledge update')
    },
  })
}
