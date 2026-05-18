// ── useProjectRFIStages ─────────────────────────────────────────────────
// Reads project_rfi_settings.stages (JSONB array) for the RFI Stage
// typeahead. Falls back to ['Bidding', 'Construction', 'Closeout'] when
// the project hasn't customised the list — those are the Procore default
// stages every GC ships with.

import { useQuery } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'

const FALLBACK_STAGES: ReadonlyArray<string> = ['Bidding', 'Construction', 'Closeout']

export function useProjectRFIStages(projectId: string | null | undefined) {
  return useQuery<string[]>({
    queryKey: ['project_rfi_stages', projectId ?? null],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return [...FALLBACK_STAGES]
      try {
        // SELECT * (not 'stages' specifically) because the `stages` column is
        // not yet live on prod — selecting it directly 400s PostgREST. Read
        // every column the settings row has and look up `stages` from there
        // so we degrade silently on schema drift instead of console-erroring.
        const { data } = await fromTable('project_rfi_settings')
          .select('*')
          .eq('project_id' as never, projectId)
          .maybeSingle()
        const stages = (data as { stages?: unknown } | null)?.stages
        if (Array.isArray(stages) && stages.length > 0) {
          const cleaned = stages
            .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
            .map((s) => s.trim())
          if (cleaned.length > 0) return cleaned
        }
        return [...FALLBACK_STAGES]
      } catch {
        // Settings row missing — that's fine; fallback covers it.
        return [...FALLBACK_STAGES]
      }
    },
  })
}
