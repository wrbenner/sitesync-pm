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

// Adds calendar days to a date string and returns a new date string
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function generateMockActivities(projectId: string): ScheduleActivity[] {
  // Project spans 14 months: 2025-09-01 through 2026-11-02
  const PROJECT_START = '2025-09-01'

  type ActivityDef = {
    name: string
    startOffset: number   // days from PROJECT_START
    durationDays: number
    isCriticalPath: boolean
    outdoorActivity: boolean
    percentComplete: number
    deps: number[]        // indices of predecessor activities
    floatDays: number
    isDelayed?: boolean
    baselineShift?: number // days earlier than actual for baseline (shows slippage)
  }

  const defs: ActivityDef[] = [
    // 0
    { name: 'Site Mobilization', startOffset: 0, durationDays: 14, isCriticalPath: false, outdoorActivity: false, percentComplete: 100, deps: [], floatDays: 5, baselineShift: 0 },
    // 1
    { name: 'Site Utilities', startOffset: 7, durationDays: 21, isCriticalPath: false, outdoorActivity: true, percentComplete: 100, deps: [0], floatDays: 7, baselineShift: 0 },
    // 2
    { name: 'Excavation and Grading', startOffset: 14, durationDays: 21, isCriticalPath: false, outdoorActivity: true, percentComplete: 100, deps: [0], floatDays: 10, baselineShift: 4, isDelayed: false },
    // 3
    { name: 'Underground Plumbing', startOffset: 35, durationDays: 14, isCriticalPath: false, outdoorActivity: false, percentComplete: 100, deps: [1, 2], floatDays: 6, baselineShift: 0 },
    // 4
    { name: 'Foundation', startOffset: 35, durationDays: 28, isCriticalPath: false, outdoorActivity: false, percentComplete: 100, deps: [2, 3], floatDays: 3, baselineShift: 5 },
    // 5
    { name: 'Structural Steel', startOffset: 63, durationDays: 42, isCriticalPath: true, outdoorActivity: false, percentComplete: 100, deps: [4], floatDays: 0, baselineShift: 0 },
    // 6
    { name: 'Concrete Decks Floors 1 through 5', startOffset: 105, durationDays: 56, isCriticalPath: true, outdoorActivity: false, percentComplete: 85, deps: [5], floatDays: 0, baselineShift: 3, isDelayed: true },
    // 7
    { name: 'Building Envelope and Curtain Wall', startOffset: 126, durationDays: 42, isCriticalPath: false, outdoorActivity: true, percentComplete: 50, deps: [5], floatDays: 14, baselineShift: 6 },
    // 8
    { name: 'Roofing', startOffset: 140, durationDays: 21, isCriticalPath: true, outdoorActivity: true, percentComplete: 30, deps: [6], floatDays: 0, baselineShift: 0, isDelayed: true },
    // 9
    { name: 'MEP Rough In', startOffset: 126, durationDays: 56, isCriticalPath: false, outdoorActivity: false, percentComplete: 60, deps: [5], floatDays: 8, baselineShift: 4 },
    // 10
    { name: 'Electrical Rough In', startOffset: 133, durationDays: 28, isCriticalPath: false, outdoorActivity: false, percentComplete: 45, deps: [5], floatDays: 10, baselineShift: 0 },
    // 11
    { name: 'Elevator Installation', startOffset: 161, durationDays: 42, isCriticalPath: false, outdoorActivity: false, percentComplete: 20, deps: [6], floatDays: 12, baselineShift: 7 },
    // 12
    { name: 'Fire Protection', startOffset: 168, durationDays: 28, isCriticalPath: false, outdoorActivity: false, percentComplete: 15, deps: [6, 9], floatDays: 9, baselineShift: 0 },
    // 13
    { name: 'Interior Framing', startOffset: 196, durationDays: 42, isCriticalPath: false, outdoorActivity: false, percentComplete: 5, deps: [7, 8, 9], floatDays: 6, baselineShift: 0, isDelayed: true },
    // 14
    { name: 'HVAC Installation', startOffset: 203, durationDays: 35, isCriticalPath: false, outdoorActivity: false, percentComplete: 0, deps: [9, 10], floatDays: 11, baselineShift: 0 },
    // 15
    { name: 'Exterior Finishes', startOffset: 203, durationDays: 28, isCriticalPath: false, outdoorActivity: true, percentComplete: 0, deps: [7, 8], floatDays: 15, baselineShift: 0 },
    // 16
    { name: 'Drywall and Finishing', startOffset: 238, durationDays: 35, isCriticalPath: false, outdoorActivity: false, percentComplete: 0, deps: [12, 13], floatDays: 4, baselineShift: 0 },
    // 17
    { name: 'Flooring', startOffset: 273, durationDays: 21, isCriticalPath: false, outdoorActivity: false, percentComplete: 0, deps: [16], floatDays: 5, baselineShift: 0 },
    // 18
    { name: 'MEP Trim Out', startOffset: 280, durationDays: 28, isCriticalPath: false, outdoorActivity: false, percentComplete: 0, deps: [14, 16], floatDays: 7, baselineShift: 0 },
    // 19
    { name: 'Speciality Equipment Install', startOffset: 287, durationDays: 21, isCriticalPath: false, outdoorActivity: false, percentComplete: 0, deps: [16], floatDays: 13, baselineShift: 0 },
    // 20
    { name: 'Landscaping', startOffset: 294, durationDays: 21, isCriticalPath: false, outdoorActivity: true, percentComplete: 0, deps: [15], floatDays: 15, baselineShift: 0 },
    // 21
    { name: 'Painting and Wall Finishes', startOffset: 308, durationDays: 21, isCriticalPath: false, outdoorActivity: false, percentComplete: 0, deps: [16, 17], floatDays: 8, baselineShift: 0 },
    // 22
    { name: 'Commissioning', startOffset: 329, durationDays: 21, isCriticalPath: true, outdoorActivity: false, percentComplete: 0, deps: [11, 14, 18, 19], floatDays: 0, baselineShift: 0 },
    // 23
    { name: 'Final Inspections', startOffset: 350, durationDays: 14, isCriticalPath: false, outdoorActivity: false, percentComplete: 0, deps: [21, 22], floatDays: 3, baselineShift: 0 },
    // 24
    { name: 'Punch List and Closeout', startOffset: 364, durationDays: 28, isCriticalPath: true, outdoorActivity: false, percentComplete: 0, deps: [20, 23], floatDays: 0, baselineShift: 0 },
  ]

  const ids = defs.map((_, i) => `mock-activity-${i + 1}`)

  function deriveStatus(pct: number, isDelayed?: boolean): string {
    if (isDelayed) return 'delayed'
    if (pct === 0) return 'not_started'
    if (pct === 100) return 'completed'
    return 'in_progress'
  }

  return defs.map((def, i) => {
    const startDate = addDays(PROJECT_START, def.startOffset)
    const endDate = addDays(startDate, def.durationDays)
    const baselineStart = def.baselineShift
      ? addDays(startDate, -def.baselineShift)
      : null
    const baselineEnd = def.baselineShift
      ? addDays(endDate, -def.baselineShift)
      : null

    return {
      id: ids[i],
      project_id: projectId,
      name: def.name,
      start_date: startDate,
      end_date: endDate,
      baseline_start: baselineStart,
      baseline_end: baselineEnd,
      percent_complete: def.percentComplete,
      status: deriveStatus(def.percentComplete, def.isDelayed),
      is_critical_path: def.isCriticalPath,
      float_days: def.floatDays,
      dependencies: def.deps.map((d) => ids[d]),
      depends_on: def.deps.length > 0 ? ids[def.deps[0]] : null,
      outdoor_activity: def.outdoorActivity,
      earned_value: null,
      assigned_crew_id: null,
      created_at: null,
      updated_at: null,
    } satisfies ScheduleActivity
  })
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
        setData(generateMockActivities(projectId))
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
