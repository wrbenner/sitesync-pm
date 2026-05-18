// ── useProjectCostCodes ─────────────────────────────────────────────────
// Distinct cost codes seen on a project — sourced from prior `rfis.cost_code`
// values + budget_line_items.code where the budget module is wired. Powers
// the Cost Code typeahead on Create / Edit / Detail.
//
// The column is free text (admins haven't standardised on a code dictionary
// yet) so this hook returns a sorted, deduped string list. Callers are
// expected to drop the result into an HTML5 `<datalist>` for native
// typeahead UX.

import { useQuery } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'

export function useProjectCostCodes(projectId: string | null | undefined) {
  return useQuery<string[]>({
    queryKey: ['project_cost_codes', projectId ?? null],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return []
      const seen = new Set<string>()

      // 1. Pull every distinct rfis.cost_code on this project.
      const { data: rfiRows } = await fromTable('rfis')
        .select('cost_code')
        .eq('project_id' as never, projectId)
        .not('cost_code' as never, 'is', null)
      ;(rfiRows ?? []).forEach((row) => {
        const code = (row as { cost_code?: string | null }).cost_code
        if (code && code.trim()) seen.add(code.trim())
      })

      // 2. Best-effort merge with budget_line_items.csi_code if it exists.
      try {
        const { data: budgetRows } = await fromTable('budget_line_items' as never)
          .select('csi_code')
          .eq('project_id' as never, projectId)
          .not('csi_code' as never, 'is', null)
        ;((budgetRows as unknown as { csi_code?: string | null }[]) ?? []).forEach((row) => {
          if (row.csi_code && row.csi_code.trim()) seen.add(row.csi_code.trim())
        })
      } catch {
        // budget module may not be wired on this project — non-fatal.
      }

      return Array.from(seen).sort((a, b) => a.localeCompare(b))
    },
  })
}
