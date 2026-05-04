import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'
import type { Database } from '../types/database'

type DailyLogsRow = Database['public']['Tables']['daily_logs']['Row']
type DailyLogsInsert = Database['public']['Tables']['daily_logs']['Insert']
type DailyLogsUpdate = Database['public']['Tables']['daily_logs']['Update']

export interface DailyLog {
  id: string
  project_id: string
  log_date: string
  weather_description: string | null
  temperature_high: number | null
  temperature_low: number | null
  weather_notes: string | null
  site_visit_notes: string | null
  safety_incidents: number | null
  safety_notes: string | null
  visitor_count: number | null
  status: 'draft' | 'submitted' | 'approved'
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

function mapRow(row: DailyLogsRow): DailyLog {
  return {
    id: row.id,
    project_id: row.project_id,
    log_date: row.log_date,
    weather_description: row.weather ?? null,
    temperature_high: row.temperature_high ?? null,
    temperature_low: row.temperature_low ?? null,
    weather_notes: row.precipitation ?? null,
    site_visit_notes: row.summary ?? null,
    safety_incidents: row.incidents ?? null,
    safety_notes: row.rejection_comments ?? null,
    visitor_count: row.workers_onsite ?? null,
    status: (row.status as 'draft' | 'submitted' | 'approved') ?? 'draft',
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function useDailyLogs(projectId: string) {
  const [data, setData] = useState<DailyLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data: rows, error: queryError } = await fromTable('daily_logs')
        .select('*')
        .eq('project_id' as never, projectId)
        .order('log_date', { ascending: false })

      if (queryError) throw queryError
      setData((rows ?? []).map(mapRow))
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
      .channel('daily_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_logs',
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

  const create = useCallback(
    async (fields: {
      log_date: string
      weather?: string | null
      temperature_high?: number | null
      temperature_low?: number | null
      precipitation?: string | null
      summary?: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const insert: DailyLogsInsert = {
        project_id: projectId,
        log_date: fields.log_date,
        status: 'draft',
        weather: fields.weather ?? null,
        temperature_high: fields.temperature_high ?? null,
        temperature_low: fields.temperature_low ?? null,
        precipitation: fields.precipitation ?? null,
        summary: fields.summary ?? null,
        created_by: user?.id ?? null,
      }
      const { data: rows, error: insertError } = await fromTable('daily_logs')
        .insert([insert])
        .select()
      if (insertError) throw insertError
      return rows?.[0] ? mapRow(rows[0]) : null
    },
    [projectId],
  )

  const update = useCallback(
    async (id: string, updates: Pick<DailyLogsUpdate, 'status'>) => {
      const { data: rows, error: updateError } = await fromTable('daily_logs')
        .update(updates as never)
        .eq('id' as never, id)
        .select()
      if (updateError) throw updateError
      return rows?.[0] ? mapRow(rows[0]) : null
    },
    [],
  )

  return { data, isLoading, error, refetch, create, update }
}
