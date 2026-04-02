import { supabase, supabaseMutation, transformSupabaseError } from '../client'
import { assertProjectAccess } from '../middleware/projectScope'
import type { ScheduleActivity, SchedulePhaseRow, SchedulePhaseUpdate } from '../../types/api'
import { calculateCriticalPath, tasksToCPM } from '../../lib/criticalPath'

// Columns fetched from schedule_phases; must match fields used in mapScheduleActivityRow.
const SCHEDULE_SELECT =
  'id, project_id, name, start_date, end_date, baseline_start, baseline_end, ' +
  'percent_complete, float_days, is_critical_path, dependencies, status, created_at, updated_at'

type RawRow = Pick<
  SchedulePhaseRow,
  | 'id'
  | 'project_id'
  | 'name'
  | 'start_date'
  | 'end_date'
  | 'baseline_start'
  | 'baseline_end'
  | 'percent_complete'
  | 'float_days'
  | 'is_critical_path'
  | 'dependencies'
  | 'status'
  | 'created_at'
  | 'updated_at'
>

const VALID_STATUSES = new Set<ScheduleActivity['status']>([
  'not_started',
  'in_progress',
  'completed',
  'delayed',
])

function toActivityStatus(s: string | null): ScheduleActivity['status'] {
  if (s !== null && VALID_STATUSES.has(s as ScheduleActivity['status'])) {
    return s as ScheduleActivity['status']
  }
  return 'not_started'
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
    baseline_start: row.baseline_start ?? null,
    baseline_finish: row.baseline_end ?? null,
    actual_start: null,
    actual_finish: null,
    percent_complete: row.percent_complete ?? 0,
    planned_percent_complete: 0,
    duration_days: durationDays,
    float_days: row.float_days ?? 0,
    is_critical: row.is_critical_path ?? false,
    is_milestone: false,
    wbs_code: null,
    trade: null,
    assigned_sub_id: null,
    outdoor_activity: false,
    predecessor_ids: row.dependencies ?? [],
    successor_ids: [],
    status: toActivityStatus(row.status),
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  }
}

export const getSchedulePhases = async (projectId: string): Promise<ScheduleActivity[]> => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase
    .from('schedule_phases')
    .select(SCHEDULE_SELECT)
    .eq('project_id', projectId)
    .order('start_date')
  if (error) throw transformSupabaseError(error)

  const rows = (data ?? []) as RawRow[]

  const cpmInput = tasksToCPM(
    rows.map(r => ({
      id: r.id,
      title: r.name,
      start_date: r.start_date,
      end_date: r.end_date,
      predecessor_ids: r.dependencies ?? null,
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
