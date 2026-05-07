// Phase 4 — Spec Sections lookup hook.

import { useQuery } from '@tanstack/react-query'
import { specSectionsService, type SpecSection } from '../services/specSections'

export function useSpecSections(sectionNumbers: string[]): {
  byNumber: Record<string, SpecSection>
  loading: boolean
  error: Error | null
} {
  // Stable cache key: sorted unique list. Avoids refetch when the same
  // sections come in a different order.
  const key = [...new Set(sectionNumbers)].sort().join(',')

  const q = useQuery<Record<string, SpecSection>>({
    queryKey: ['spec_sections', key],
    enabled: sectionNumbers.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await specSectionsService.lookup(sectionNumbers)
      if (r.error) throw new Error(r.error.message)
      return r.data ?? {}
    },
  })

  return {
    byNumber: q.data ?? {},
    loading: q.isPending && sectionNumbers.length > 0,
    error: (q.error as Error) ?? null,
  }
}
