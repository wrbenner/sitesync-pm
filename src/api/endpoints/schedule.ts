import { supabase, supabaseMutation, transformSupabaseError } from '../client'
import { assertProjectAccess } from '../middleware/projectScope'
import type { ScheduleActivity, SchedulePhaseUpdate } from '../../types/api'
import { calculateCriticalPath, tasksToCPM } from '../../lib/criticalPath'

// Base columns always present in schedule_phases.
const SCHEDULE_SELECT_BASE =
  'id, project_id, name, start_date, end_date, ' +
  'percent_complete, is_critical_path, depends_on, assigned_crew_id, status, created_at, updated_at, deleted_at, deleted_by'

// Extended select is the same as base — all columns exist in the schema.
const SCHEDULE_SELECT = SCHEDULE_SELECT_BASE

type RawRow = {
  id: string
  project_id: string
  name: string
  start_date: string | null
  end_date: string | null
  percent_complete: number | null
  is_critical_path: boolean | null
  depends_on: string | null
  assigned_crew_id: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
  deleted_by: string | null
}

// DB CHECK: ('completed', 'active', 'upcoming', 'at_risk', 'delayed', 'on_track')
const VALID_STATUSES = new Set<string>([
  'completed',
  'active',
  'upcoming',
  'at_risk',
  'delayed',
  'on_track',
])

function toActivityStatus(s: string | null): ScheduleActivity['status'] {
  if (s !== null && VALID_STATUSES.has(s)) {
    return s as ScheduleActivity['status']
  }
  return 'upcoming' as ScheduleActivity['status']
}

export function mapScheduleActivityRow(row: RawRow): ScheduleActivity {
  const startDate = row.start_date ?? ''
  const finishDate = row.end_date ?? ''
  const durationDays =
    startDate && finishDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(finishDate).getTime() - new Date(startDate).getTime()) / 86400000,
          ),
        )
      : 0
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    description: null,
    start_date: startDate,
    finish_date: finishDate,
    baseline_start: null,
    baseline_finish: null,
    actual_start: null,
    actual_finish: null,
    percent_complete: row.percent_complete ?? 0,
    planned_percent_complete: 0,
    duration_days: durationDays,
    float_days: 0,
    is_critical: row.is_critical_path ?? false,
    is_milestone: false,
    wbs_code: null,
    trade: null,
    assigned_sub_id: row.assigned_crew_id ?? null,
    outdoor_activity: false,
    predecessor_ids: row.depends_on ? [row.depends_on] : [],
    successor_ids: [],
    status: toActivityStatus(row.status),
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  }
}

export const getSchedulePhases = async (projectId: string): Promise<ScheduleActivity[]> => {
  await assertProjectAccess(projectId)

  let rows: RawRow[]
  try {
    const { data, error } = await supabase
      .from('schedule_phases')
      .select(SCHEDULE_SELECT)
      .eq('project_id', projectId)
      .order('start_date')
    if (error) throw error
    rows = (data ?? []) as RawRow[]
  } catch {
    // Extended columns may not exist yet; fall back to base columns with schema defaults.
    const { data, error } = await supabase
      .from('schedule_phases')
      .select(SCHEDULE_SELECT_BASE)
      .eq('project_id', projectId)
      .order('start_date')
    if (error) throw transformSupabaseError(error)
    rows = (data ?? []) as RawRow[]
  }

  const cpmInput = tasksToCPM(
    rows.map(r => ({
      id: r.id,
      title: r.name,
      start_date: r.start_date,
      end_date: r.end_date,
      predecessor_ids: r.depends_on ? [r.depends_on] : null,
      estimated_hours: null,
    })),
  )
  const cpmResults = calculateCriticalPath(cpmInput)

  const activities = rows.map((raw): ScheduleActivity => {
    const base = mapScheduleActivityRow(raw)
    const cpm = cpmResults.get(raw.id)
    if (!cpm) return base
    return { ...base, is_critical: cpm.isCritical, float_days: cpm.totalFloat }
  })

  const successorMap = new Map<string, string[]>()
  for (const activity of activities) {
    for (const predecessorId of activity.predecessor_ids) {
      const existing = successorMap.get(predecessorId)
      if (existing) {
        existing.push(activity.id)
      } else {
        successorMap.set(predecessorId, [activity.id])
      }
    }
  }
  for (const activity of activities) {
    activity.successor_ids = successorMap.get(activity.id) ?? []
  }

  return activities
}

export const updateScheduleActivity = async (
  id: string,
  updates: SchedulePhaseUpdate,
) => {
  return supabaseMutation((client) =>
    client
      .from('schedule_phases')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  )
}
