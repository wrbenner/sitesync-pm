import { useQuery } from '@tanstack/react-query'
import { getLinkedEntities } from '../services/entityLinkService'
import type { EntityType, LinkedItem } from '../components/shared/LinkedEntities'

/**
 * Fetches linked entities for a given entity.
 * Only runs when entityId is truthy (e.g. when a row is expanded).
 */
export function useLinkedEntities(
  projectId: string | null | undefined,
  entityType: EntityType,
  entityId: string | null | undefined,
) {
  return useQuery<LinkedItem[]>({
    queryKey: ['entity_links', projectId, entityType, entityId],
    queryFn: () => getLinkedEntities(projectId!, entityType, entityId!),
    enabled: !!projectId && !!entityId,
    staleTime: 30_000,
  })
}
