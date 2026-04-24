import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export interface TimesheetRow {
  id: string
  project_id: string
  worker_id: string
  work_date: string
  hours: number
  activity: string
  created_at: string
  updated_at: string
  worker_name?: string
  worker_trade?: string
}

export function useTimesheets(projectId: string | undefined, opts?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['timesheets', projectId, opts?.from ?? null, opts?.to ?? null],
    queryFn: async (): Promise<TimesheetRow[]> => {
      if (!projectId || !isSupabaseConfigured) return []

      let q = supabase
        .from('timesheets')
        .select('*, workforce_members(name, trade)')
        .eq('project_id', projectId)
        .order('work_date', { ascending: false })

      if (opts?.from) q = q.gte('work_date', opts.from)
      if (opts?.to) q = q.lte('work_date', opts.to)

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map((r: Record<string, unknown>) => {
        const member = r.workforce_members as { name?: string; trade?: string } | null
        return {
          id: r.id as string,
          project_id: r.project_id as string,
          worker_id: r.worker_id as string,
          work_date: r.work_date as string,
          hours: Number(r.hours ?? 0),
          activity: (r.activity as string) ?? '',
          created_at: r.created_at as string,
          updated_at: r.updated_at as string,
          worker_name: member?.name ?? 'Unknown',
          worker_trade: member?.trade ?? '',
        }
      })
    },
    enabled: !!projectId && isSupabaseConfigured,
  })
}

export interface ActivityHoursRollup {
  activity: string
  hours: number
  entries: number
}

export function useTimesheetHoursByActivity(projectId: string | undefined) {
  return useQuery({
    queryKey: ['timesheets', 'by_activity', projectId],
    queryFn: async (): Promise<ActivityHoursRollup[]> => {
      if (!projectId || !isSupabaseConfigured) return []
      const { data, error } = await supabase
        .from('timesheets')
        .select('activity, hours')
        .eq('project_id', projectId)
      if (error) throw error

      const map = new Map<string, { hours: number; entries: number }>()
      for (const row of data ?? []) {
        const key = ((row as Record<string, unknown>).activity as string) || '(unassigned)'
        const hrs = Number((row as Record<string, unknown>).hours ?? 0)
        const curr = map.get(key) ?? { hours: 0, entries: 0 }
        curr.hours += hrs
        curr.entries += 1
        map.set(key, curr)
      }
      return Array.from(map.entries())
        .map(([activity, v]) => ({ activity, hours: Math.round(v.hours * 100) / 100, entries: v.entries }))
        .sort((a, b) => b.hours - a.hours)
    },
    enabled: !!projectId && isSupabaseConfigured,
  })
}
