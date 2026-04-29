import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Tables = Database['public']['Tables']
type DailyLogRow = Tables['daily_logs']['Row']
type DailyLogInsert = Tables['daily_logs']['Insert']
type IncidentRow = Tables['incidents']['Row']
type IncidentInsert = Tables['incidents']['Insert']
type IncidentUpdate = Tables['incidents']['Update']
type SafetyInspectionRow = Tables['safety_inspections']['Row']
type ToolboxTalkRow = Tables['toolbox_talks']['Row']
type ToolboxTalkInsert = Tables['toolbox_talks']['Insert']
type CorrectiveActionRow = Tables['corrective_actions']['Row']
type CorrectiveActionInsert = Tables['corrective_actions']['Insert']
type CorrectiveActionUpdate = Tables['corrective_actions']['Update']
type WeatherRecordRow = Tables['weather_records']['Row']
type SafetyCertificationRow = Tables['safety_certifications']['Row']

// ── useDailyLogs ──────────────────────────────────────────────────────────────

export function useDailyLogs(projectId: string) {
  const [logs, setLogs] = useState<DailyLogRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // BUG-H17 FIX: Mirror state in a ref so mutation callbacks can read the latest
  // value without listing the array in their deps (which caused infinite re-creation).
  const logsRef = useRef<DailyLogRow[]>(logs)
  useLayoutEffect(() => { logsRef.current = logs })

  const refetch = useCallback(async () => {
    if (!projectId) return
    try {
      setIsLoading(true)
      const { data, error: queryError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
      if (queryError) throw queryError
      setLogs(data ?? [])
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
      .channel(`field_ops_daily_logs:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_logs', filter: `project_id=eq.${projectId}` },
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

  const createLog = useCallback(
    async (fields: Omit<DailyLogInsert, 'project_id'>) => {
      const optimisticItem: DailyLogRow = {
        id: crypto.randomUUID(),
        project_id: projectId,
        log_date: fields.log_date ?? new Date().toISOString().slice(0, 10),
        status: fields.status ?? 'draft',
        weather: fields.weather ?? null,
        temperature_high: fields.temperature_high ?? null,
        temperature_low: fields.temperature_low ?? null,
        precipitation: fields.precipitation ?? null,
        summary: fields.summary ?? null,
        incidents: fields.incidents ?? null,
        rejection_comments: fields.rejection_comments ?? null,
        workers_onsite: fields.workers_onsite ?? null,
        created_by: fields.created_by ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as DailyLogRow
      setLogs((prev) => [optimisticItem, ...prev])
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error: insertError } = await supabase
          .from('daily_logs')
          .insert([{ ...fields, project_id: projectId, created_by: fields.created_by ?? user?.id ?? null }])
          .select()
          .single()
        if (insertError) throw insertError
        setLogs((prev) => prev.map((l) => (l.id === optimisticItem.id ? (data as DailyLogRow) : l)))
        return data as DailyLogRow
      } catch (err) {
        setLogs((prev) => prev.filter((l) => l.id !== optimisticItem.id))
        if (import.meta.env.DEV) console.error('createLog failed:', err)
        throw err
      }
    },
    [projectId],
  )

  const updateLog = useCallback(
    async (id: string, updates: Partial<DailyLogInsert>) => {
      const previous = logsRef.current.find((l) => l.id === id)
      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
      try {
        const { data, error: updateError } = await supabase
          .from('daily_logs')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (updateError) throw updateError
        setLogs((prev) => prev.map((l) => (l.id === id ? (data as DailyLogRow) : l)))
        return data as DailyLogRow
      } catch (err) {
        if (previous) setLogs((prev) => prev.map((l) => (l.id === id ? previous : l)))
        if (import.meta.env.DEV) console.error('updateLog failed:', err)
        throw err
      }
    },
    [],
  )

  return { logs, isLoading, error, refetch, createLog, updateLog }
}

// ── useIncidents ──────────────────────────────────────────────────────────────

export function useIncidents(projectId: string) {
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // BUG-H17 FIX: See useDailyLogs above for rationale.
  const incidentsRef = useRef<IncidentRow[]>(incidents)
  useLayoutEffect(() => { incidentsRef.current = incidents })

  const refetch = useCallback(async () => {
    if (!projectId) return
    try {
      setIsLoading(true)
      const { data, error: queryError } = await supabase
        .from('incidents')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: false })
      if (queryError) throw queryError
      setIncidents(data ?? [])
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
      .channel(`field_ops_incidents:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents', filter: `project_id=eq.${projectId}` },
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

  const createIncident = useCallback(
    async (fields: Omit<IncidentInsert, 'project_id'>) => {
      const optimisticItem = {
        id: crypto.randomUUID(),
        project_id: projectId,
        ...fields,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as IncidentRow
      setIncidents((prev) => [optimisticItem, ...prev])
      try {
        const { data, error: insertError } = await supabase
          .from('incidents')
          .insert([{ ...fields, project_id: projectId }])
          .select()
          .single()
        if (insertError) throw insertError
        setIncidents((prev) => prev.map((i) => (i.id === optimisticItem.id ? (data as IncidentRow) : i)))
        return data as IncidentRow
      } catch (err) {
        setIncidents((prev) => prev.filter((i) => i.id !== optimisticItem.id))
        if (import.meta.env.DEV) console.error('createIncident failed:', err)
        throw err
      }
    },
    [projectId],
  )

  const updateIncident = useCallback(
    async (id: string, updates: IncidentUpdate) => {
      const previous = incidentsRef.current.find((i) => i.id === id)
      setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)))
      try {
        const { data, error: updateError } = await supabase
          .from('incidents')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (updateError) throw updateError
        setIncidents((prev) => prev.map((i) => (i.id === id ? (data as IncidentRow) : i)))
        return data as IncidentRow
      } catch (err) {
        if (previous) setIncidents((prev) => prev.map((i) => (i.id === id ? previous : i)))
        if (import.meta.env.DEV) console.error('updateIncident failed:', err)
        throw err
      }
    },
    [],
  )

  return { incidents, isLoading, error, refetch, createIncident, updateIncident }
}

// ── useSafetyInspections ──────────────────────────────────────────────────────

export function useSafetyInspections(projectId: string) {
  const [inspections, setInspections] = useState<SafetyInspectionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const refetch = useCallback(async () => {
    if (!projectId) return
    try {
      setIsLoading(true)
      const { data, error: queryError } = await supabase
        .from('safety_inspections')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: false })
      if (queryError) throw queryError
      setInspections(data ?? [])
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
      .channel(`field_ops_safety_inspections:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'safety_inspections', filter: `project_id=eq.${projectId}` },
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

  return { inspections, isLoading, error, refetch }
}

// ── useToolboxTalks ───────────────────────────────────────────────────────────

export function useToolboxTalks(projectId: string) {
  const [talks, setTalks] = useState<ToolboxTalkRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const refetch = useCallback(async () => {
    if (!projectId) return
    try {
      setIsLoading(true)
      const { data, error: queryError } = await supabase
        .from('toolbox_talks')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: false })
      if (queryError) throw queryError
      setTalks(data ?? [])
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
      .channel(`field_ops_toolbox_talks:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'toolbox_talks', filter: `project_id=eq.${projectId}` },
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

  const createTalk = useCallback(
    async (fields: Omit<ToolboxTalkInsert, 'project_id'>) => {
      const optimisticItem = {
        id: crypto.randomUUID(),
        project_id: projectId,
        ...fields,
        created_at: new Date().toISOString(),
      } as ToolboxTalkRow
      setTalks((prev) => [optimisticItem, ...prev])
      try {
        const { data, error: insertError } = await supabase
          .from('toolbox_talks')
          .insert([{ ...fields, project_id: projectId }])
          .select()
          .single()
        if (insertError) throw insertError
        setTalks((prev) => prev.map((t) => (t.id === optimisticItem.id ? (data as ToolboxTalkRow) : t)))
        return data as ToolboxTalkRow
      } catch (err) {
        setTalks((prev) => prev.filter((t) => t.id !== optimisticItem.id))
        if (import.meta.env.DEV) console.error('createTalk failed:', err)
        throw err
      }
    },
    [projectId],
  )

  return { talks, isLoading, error, refetch, createTalk }
}

// ── useCorrectiveActions ──────────────────────────────────────────────────────

export function useCorrectiveActions(projectId: string) {
  const [actions, setActions] = useState<CorrectiveActionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // BUG-H17 FIX: See useDailyLogs above for rationale.
  const actionsRef = useRef<CorrectiveActionRow[]>(actions)
  useLayoutEffect(() => { actionsRef.current = actions })

  const refetch = useCallback(async () => {
    if (!projectId) return
    try {
      setIsLoading(true)
      const { data, error: queryError } = await supabase
        .from('corrective_actions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (queryError) throw queryError
      setActions(data ?? [])
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
      .channel(`field_ops_corrective_actions:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'corrective_actions', filter: `project_id=eq.${projectId}` },
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

  const createAction = useCallback(
    async (fields: Omit<CorrectiveActionInsert, 'project_id'>) => {
      const optimisticItem = {
        id: crypto.randomUUID(),
        project_id: projectId,
        ...fields,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CorrectiveActionRow
      setActions((prev) => [optimisticItem, ...prev])
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error: insertError } = await supabase
          .from('corrective_actions')
          .insert([{ ...fields, project_id: projectId, created_by: fields.created_by ?? user?.id ?? null }])
          .select()
          .single()
        if (insertError) throw insertError
        setActions((prev) => prev.map((a) => (a.id === optimisticItem.id ? (data as CorrectiveActionRow) : a)))
        return data as CorrectiveActionRow
      } catch (err) {
        setActions((prev) => prev.filter((a) => a.id !== optimisticItem.id))
        if (import.meta.env.DEV) console.error('createAction failed:', err)
        throw err
      }
    },
    [projectId],
  )

  const updateAction = useCallback(
    async (id: string, updates: CorrectiveActionUpdate) => {
      const previous = actionsRef.current.find((a) => a.id === id)
      setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)))
      try {
        const { data, error: updateError } = await supabase
          .from('corrective_actions')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (updateError) throw updateError
        setActions((prev) => prev.map((a) => (a.id === id ? (data as CorrectiveActionRow) : a)))
        return data as CorrectiveActionRow
      } catch (err) {
        if (previous) setActions((prev) => prev.map((a) => (a.id === id ? previous : a)))
        if (import.meta.env.DEV) console.error('updateAction failed:', err)
        throw err
      }
    },
    [],
  )

  return { actions, isLoading, error, refetch, createAction, updateAction }
}

// ── useWeatherCache ───────────────────────────────────────────────────────────

export function useWeatherCache(projectId: string) {
  const [weather, setWeather] = useState<WeatherRecordRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    async function fetchWeather() {
      try {
        setIsLoading(true)
        const { data, error: queryError } = await supabase
          .from('weather_records')
          .select('*')
          .eq('project_id', projectId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (queryError) throw queryError
        if (!cancelled) {
          setWeather(data ?? null)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchWeather()
    return () => { cancelled = true }
  }, [projectId])

  return { weather, isLoading, error }
}

// ── useSafetyCertifications ───────────────────────────────────────────────────

export function useSafetyCertifications(projectId: string) {
  const [certifications, setCertifications] = useState<SafetyCertificationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const refetch = useCallback(async () => {
    if (!projectId) return
    try {
      setIsLoading(true)
      const { data, error: queryError } = await supabase
        .from('safety_certifications')
        .select('*')
        .eq('project_id', projectId)
        .order('expiration_date', { ascending: true })
      if (queryError) throw queryError
      setCertifications(data ?? [])
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
      .channel(`field_ops_safety_certifications:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'safety_certifications', filter: `project_id=eq.${projectId}` },
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

  return { certifications, isLoading, error, refetch }
}
