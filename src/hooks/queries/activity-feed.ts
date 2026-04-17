import { useQuery } from '@tanstack/react-query'
import { getActivityFeed } from '../../api/endpoints/activity'
import type { ActivityFeedItem as EnrichedActivityFeedItem } from '../../types/entities'



// ── Activity Feed ─────────────────────────────────────────

export function useActivityFeed(projectId: string | undefined) {
  return useQuery<EnrichedActivityFeedItem[]>({
    queryKey: ['activity_feed', projectId],
    queryFn: () => getActivityFeed(projectId!),
    enabled: !!projectId,
  })
}
