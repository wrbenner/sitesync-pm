// ── useRFIProjectMetadata ───────────────────────────────────────────────
// Aggregates the data sources the RFI Edit panel needs for typeahead
// inputs (Phase 1.3): cost codes from budget_items, locations from
// project_locations (or free-text fallback when the table is absent),
// and trades from a static enum.
//
// Each query is cached separately so the typeahead reacts instantly
// once the data is warm.

import { useQuery } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'

const from = (table: string) => fromTable(table as never)

export interface CostCodeOption {
  code: string
  label: string
}

export interface LocationOption {
  id: string
  label: string
}

export interface TradeOption {
  value: string
  label: string
}

/** 16 CSI-standard divisions; project_trades junction (if present) is
    project-specific tagging on top of the canonical taxonomy. */
export const TRADE_OPTIONS: TradeOption[] = [
  { value: '01', label: 'General Requirements' },
  { value: '02', label: 'Existing Conditions' },
  { value: '03', label: 'Concrete' },
  { value: '04', label: 'Masonry' },
  { value: '05', label: 'Metals' },
  { value: '06', label: 'Wood, Plastics, Composites' },
  { value: '07', label: 'Thermal & Moisture Protection' },
  { value: '08', label: 'Openings' },
  { value: '09', label: 'Finishes' },
  { value: '10', label: 'Specialties' },
  { value: '11', label: 'Equipment' },
  { value: '12', label: 'Furnishings' },
  { value: '13', label: 'Special Construction' },
  { value: '14', label: 'Conveying Equipment' },
  { value: '21', label: 'Fire Suppression' },
  { value: '22', label: 'Plumbing' },
  { value: '23', label: 'HVAC' },
  { value: '26', label: 'Electrical' },
  { value: '27', label: 'Communications' },
  { value: '31', label: 'Earthwork' },
  { value: '32', label: 'Exterior Improvements' },
  { value: '33', label: 'Utilities' },
]

export function useCostCodeOptions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_cost_code_options', projectId ?? '__none__'],
    enabled: !!projectId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CostCodeOption[]> => {
      if (!projectId) return []
      const { data } = await from('budget_items')
        .select('code, name')
        .eq('project_id' as never, projectId)
        .order('code' as never, { ascending: true })
      const rows = (data ?? []) as Array<{ code?: string; name?: string }>
      return rows
        .filter((r) => r.code)
        .map((r) => ({ code: String(r.code), label: r.name ?? '' }))
    },
  })
}

export function useLocationOptions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_location_options', projectId ?? '__none__'],
    enabled: !!projectId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LocationOption[]> => {
      if (!projectId) return []
      // project_locations is optional; degrade silently when absent.
      try {
        const { data } = await from('project_locations')
          .select('id, label')
          .eq('project_id' as never, projectId)
          .order('label' as never, { ascending: true })
        const rows = (data ?? []) as Array<{ id?: string; label?: string }>
        return rows.filter((r) => r.id && r.label).map((r) => ({ id: String(r.id), label: String(r.label) }))
      } catch {
        return []
      }
    },
  })
}

export interface SpecBookOption {
  id: string
  section_code: string
  section_title: string
  responsible_party: string | null
  responsible_user_id: string | null
}

export function useSpecBookOptions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_spec_book_options', projectId ?? '__none__'],
    enabled: !!projectId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SpecBookOption[]> => {
      if (!projectId) return []
      const { data } = await from('project_spec_book')
        .select('id, section_code, section_title, responsible_party, responsible_user_id')
        .eq('project_id' as never, projectId)
        .order('section_code' as never, { ascending: true })
      return (data ?? []) as unknown as SpecBookOption[]
    },
  })
}
