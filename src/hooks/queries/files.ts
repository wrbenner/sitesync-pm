import { useQuery } from '@tanstack/react-query'
import { getFiles as getFilesEnriched } from '../../api/endpoints/documents'



// ── Files ─────────────────────────────────────────────────

export function useFiles(projectId: string | undefined) {
  return useQuery({
    queryKey: ['files', projectId],
    queryFn: () => getFilesEnriched(projectId!),
    enabled: !!projectId,
  })
}
