import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

export interface MessageReaction {
  emoji: string
  userId: string
}

export async function fetchReactions(messageId: string): Promise<MessageReaction[]> {
  // Table may not exist in generated types yet — using untyped query
  const { data, error } = await fromTable('message_reactions')
    .select('emoji, user_id')
    .eq('message_id' as never, messageId)
  if (error || !data) return []
  return data.map((r: { emoji: string; user_id: string }) => ({ emoji: r.emoji, userId: r.user_id }))
}

export async function addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  await fromTable('message_reactions')
    .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id,emoji' })
}

export async function removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  await fromTable('message_reactions')
    .delete()
    .eq('message_id' as never, messageId)
    .eq('user_id' as never, userId)
    .eq('emoji' as never, emoji)
}
