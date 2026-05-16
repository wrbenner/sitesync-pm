export interface ActivityInterval {
  id: string
  startDateIso: string
  endDateIso: string
}

export interface CriticalPathSegment {
  predecessor: ActivityInterval
  activity: ActivityInterval
}

export class ScheduleMonotonicViolation extends Error {
  readonly predecessorId: string
  readonly activityId: string
  readonly predecessorEnd: string
  readonly activityStart: string

  constructor(predecessorId: string, activityId: string, predecessorEnd: string, activityStart: string) {
    super(`schedule_critical_path_monotonic violated: ${predecessorId} ends ${predecessorEnd} after ${activityId} starts ${activityStart}`)
    this.name = 'ScheduleMonotonicViolation'
    this.predecessorId = predecessorId
    this.activityId = activityId
    this.predecessorEnd = predecessorEnd
    this.activityStart = activityStart
  }
}

export function assertNoOverlap(segment: CriticalPathSegment): void {
  const { predecessor, activity } = segment
  if (predecessor.endDateIso > activity.startDateIso) {
    throw new ScheduleMonotonicViolation(
      predecessor.id,
      activity.id,
      predecessor.endDateIso,
      activity.startDateIso,
    )
  }
}
