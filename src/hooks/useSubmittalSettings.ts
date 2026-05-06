// Read submittal_settings for the active project. Phase 1 uses this only
// for the numbering_format token; Phase 2+ surfaces wire the rest. The
// settings table has NO column default for `codeset` (per
// SUBMITTAL_OPEN_QUESTIONS_RESOLUTION_2026-05-06.md decision #1) — the
// project-setup wizard ships in Phase 8. Until then, we may not have a
// row at all for a given project; render the page-default in that case.

import { useQuery } from '@tanstack/react-query'
import { fromTable } from '../lib/db/queries'

export interface SubmittalSettingsRow {
  project_id: string
  codeset: 'ejcdc' | 'aia' | 'ufgs' | 'custom' | null
  numbering_format: string
  default_sla_days: number
  default_buffer_days: number
  is_federal: boolean
  ai_preflight_enabled: boolean
  enable_schedule_linking: boolean
}

export const SUBMITTAL_SETTINGS_DEFAULTS: SubmittalSettingsRow = {
  project_id: '',
  codeset: null, // wizard must pick — Phase 8
  numbering_format: '{spec_section}-{seq}',
  default_sla_days: 10,
  default_buffer_days: 5,
  is_federal: false,
  ai_preflight_enabled: true,
  enable_schedule_linking: true,
}

export function useSubmittalSettings(projectId: string | null | undefined) {
  return useQuery<SubmittalSettingsRow>({
    queryKey: ['submittal_settings', projectId ?? ''],
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!projectId) return { ...SUBMITTAL_SETTINGS_DEFAULTS }
      const { data, error } = await fromTable('submittal_settings')
        .select('*')
        .eq('project_id' as never, projectId)
        .maybeSingle()
      // PGRST116 = no rows; treat as default (project hasn't run the wizard).
      if (error && error.code !== 'PGRST116') {
        // Don't break the page — fall back to defaults silently. The wizard
        // is what will populate this row in Phase 8.
        return { ...SUBMITTAL_SETTINGS_DEFAULTS, project_id: projectId }
      }
      const row = (data ?? null) as Partial<SubmittalSettingsRow> | null
      return {
        ...SUBMITTAL_SETTINGS_DEFAULTS,
        project_id: projectId,
        ...(row ?? {}),
      }
    },
  })
}
