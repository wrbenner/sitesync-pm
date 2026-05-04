import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import type {
  DailyLog,
} from '../../types/database'
import type { ExtendedDailyLog } from '../../pages/daily-log/types'

// ── Daily Logs ────────────────────────────────────────────

type RawEntry = {
  type?: string | null
  description?: string | null
  trade?: string | null
  company?: string | null
  headcount?: number | null
  hours?: number | null
  equipment_name?: string | null
  equipment_hours?: number | null
  quantity?: number | null
  po_number?: string | null
  condition?: string | null
  inspector_name?: string | null
  time_in?: string | null
  time_out?: string | null
  delay_cause?: string | null
}

function enrichLog(row: DailyLog & { daily_log_entries?: RawEntry[] }): ExtendedDailyLog {
  const entries = row.daily_log_entries ?? []
  return {
    ...row,
    crew_entries: entries
      .filter(e => e.type === 'crew')
      .map(e => ({
        trade: e.trade ?? '',
        company: e.company ?? '',
        headcount: e.headcount ?? 0,
        hours: e.hours ?? 0,
      })),
    equipment_entries: entries
      .filter(e => e.type === 'equipment')
      .map(e => ({
        type: e.equipment_name ?? e.description ?? '',
        count: e.headcount ?? 1,
        hours_operated: e.equipment_hours ?? 0,
      })),
    material_deliveries: entries
      .filter(e => e.type === 'delivery')
      .map(e => ({
        description: e.description ?? '',
        quantity: e.quantity ?? 0,
        po_reference: e.po_number ?? '',
        delivery_ticket: e.condition ?? '',
      })),
    visitors: entries
      .filter(e => e.type === 'visitor')
      .map(e => ({
        name: e.inspector_name ?? '',
        company: e.company ?? '',
        purpose: e.description ?? '',
        time_in: e.time_in ?? '',
        time_out: e.time_out ?? '',
      })),
    incident_details: entries
      .filter(e => e.type === 'incident')
      .map(e => ({
        description: e.description ?? '',
        type: e.condition ?? '',
        corrective_action: e.delay_cause ?? '',
      })),
  }
}

export function useDailyLogs(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['daily_logs', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<ExtendedDailyLog>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await fromTable('daily_logs')
        .select('*, daily_log_entries(*)', { count: 'exact' })
        .eq('project_id' as never, projectId!)
        .order('log_date', { ascending: false })
        .range(from, to)
      if (error) throw error
      const rows = ((data ?? []) as Array<DailyLog & { daily_log_entries?: RawEntry[] }>).map(enrichLog)
      return { data: rows, total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}
