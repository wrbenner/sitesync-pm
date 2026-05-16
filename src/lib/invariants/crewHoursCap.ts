export interface CrewAttendanceEntry {
  crewId: string
  workDateIso: string
  hoursWorked: number
}

export interface CrewDayHours {
  crewId: string
  workDateIso: string
  entries: readonly CrewAttendanceEntry[]
}

export const MAX_CREW_HOURS_PER_DAY = 24

export class CrewHoursCapViolation extends Error {
  readonly crewId: string
  readonly workDateIso: string
  readonly totalHours: number

  constructor(crewId: string, workDateIso: string, totalHours: number) {
    super(`daily_log_crew_hours_cap violated: crew ${crewId} logged ${totalHours}h on ${workDateIso} (cap ${MAX_CREW_HOURS_PER_DAY})`)
    this.name = 'CrewHoursCapViolation'
    this.crewId = crewId
    this.workDateIso = workDateIso
    this.totalHours = totalHours
  }
}

export function sumCrewHours(entries: readonly CrewAttendanceEntry[]): number {
  return entries.reduce((acc, entry) => acc + entry.hoursWorked, 0)
}

export function assertCrewHoursValid(day: CrewDayHours): void {
  const total = sumCrewHours(day.entries)
  if (total > MAX_CREW_HOURS_PER_DAY) {
    throw new CrewHoursCapViolation(day.crewId, day.workDateIso, total)
  }
}
