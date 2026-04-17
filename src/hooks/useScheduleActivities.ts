import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface ScheduleActivity {
  id: string
  project_id: string
  name: string
  start_date: string | null
  end_date: string | null
  baseline_start: string | null
  baseline_end: string | null
  percent_complete: number | null
  status: string | null
  is_critical_path: boolean | null
  float_days: number | null
  dependencies: string[] | null
  depends_on: string | null
  outdoor_activity: boolean
  earned_value: number | null
  assigned_crew_id: string | null
  created_at: string | null
  updated_at: string | null
}

export function useScheduleActivities(projectId: string) {
  const [data, setData] = useState<ScheduleActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data: rows, error: queryError } = await supabase
        .from('schedule_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true })

      if (queryError) throw queryError

      if (!rows || rows.length === 0) {
        setData([])
      } else {
        setData(
          rows.map((row) => ({
            id: row.id,
            project_id: row.project_id,
            name: row.name,
            start_date: row.start_date ?? null,
            end_date: row.end_date ?? null,
            baseline_start: row.baseline_start ?? null,
            baseline_end: row.baseline_end ?? null,
            percent_complete: row.percent_complete ?? null,
            status: row.status ?? null,
            is_critical_path: row.is_critical_path ?? null,
            float_days: row.float_days ?? null,
            dependencies: row.dependencies ?? null,
            depends_on: row.depends_on ?? null,
            outdoor_activity: false,
            earned_value: row.earned_value ?? null,
            assigned_crew_id: row.assigned_crew_id ?? null,
            created_at: row.created_at ?? null,
            updated_at: row.updated_at ?? null,
          } satisfies ScheduleActivity)),
        )
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    refetch()

    const channel = supabase
      .channel('schedule_phases_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_phases',
          filter: `project_id=eq.${projectId}`,
        },
        () => { refetch() },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [projectId, refetch])

  return { data, isLoading, error, refetch }
}
