// =============================================================================
// OSHA Form 300 / 300A / 301 — log + summary + per-incident detail
// =============================================================================
// Aggregates the project's `incidents` rows into the three OSHA forms.
//
// Form 300:  the running log. One row per recordable case. Visible to OSHA
//            inspectors during walk-throughs; anonymized for posting.
// Form 300A: annual summary. Posted in the workplace Feb 1 – Apr 30.
//            Aggregates 300 cases by outcome (death, days away, restricted,
//            other). Hours-worked + employee-count totals at the bottom.
// Form 301:  per-incident detail. Filed for each recordable case within
//            7 days of the event.
//
// ITA portal CSV export — OSHA's electronic filing format. We generate the
// CSV; the customer uploads via the OSHA Injury Tracking Application portal.
// =============================================================================

export interface IncidentRow {
  id: string
  type: string                      // 'injury' | 'near_miss' | 'property_damage' | 'environmental' | 'fall' | ...
  severity: 'first_aid' | 'medical_treatment' | 'lost_time' | 'fatality' | string
  date: string                      // ISO timestamp
  location: string | null
  description: string
  injured_party_name: string | null
  injured_party_company: string | null
  injured_party_trade: string | null
  osha_recordable: boolean
  /** Number of days the worker was away from work (300 column J). */
  days_away: number | null
  /** Number of days on job restriction or transfer (300 column L). */
  days_restricted: number | null
  /** OSHA case classification — drives 300 column placement. */
  case_classification?: 'death' | 'days_away' | 'restricted' | 'other_recordable' | null
}

export type OshaCaseColumn = 'death' | 'days_away' | 'restricted' | 'other_recordable'

export interface Form300Row {
  caseNumber: number
  employeeName: string
  jobTitle: string
  dateOfInjury: string
  whereOccurred: string
  description: string
  classification: OshaCaseColumn
  daysAwayFromWork: number
  daysOnJobRestriction: number
  injuryOrIllnessType: string
}

export interface Form300A {
  /** Calendar year being summarized. */
  year: number
  /** Establishment / project label. */
  establishment: string
  totalDeaths: number
  totalDaysAway: number
  totalRestricted: number
  totalOtherRecordable: number
  totalCases: number
  /** Sum of days away across all cases (column K total on the form). */
  totalDaysAwayDays: number
  /** Sum of days on restriction across all cases (column M total). */
  totalRestrictedDays: number
  /** Annual employee-hours-worked total (entered by the customer; we surface
   *  the field and the customer attests). */
  totalHoursWorked: number | null
  averageEmployeeCount: number | null
  postingPeriod: { from: string; to: string }
}

export interface Form301 {
  caseNumber: number
  employeeName: string
  injuryDate: string
  injuryDescription: string
  whatHappened: string
  injuryNature: string
  injuryBodyPart: string
  /** Treatment given (text). */
  treatment: string
  /** Source: object that injured. */
  source: string
  /** Result: 'death' | 'days_away' | 'restricted' | 'other_recordable'. */
  result: OshaCaseColumn
}

/** Classify an incident into the four 300-column buckets. Drives where the
 *  case lands on Form 300 and how it counts on Form 300A. */
export function classifyCase(incident: IncidentRow): OshaCaseColumn {
  if (incident.case_classification) return incident.case_classification as OshaCaseColumn
  if (incident.severity === 'fatality') return 'death'
  if (incident.severity === 'lost_time' && (incident.days_away ?? 0) > 0) return 'days_away'
  if ((incident.days_restricted ?? 0) > 0) return 'restricted'
  return 'other_recordable'
}

/** Build the running 300 log from raw incidents. Filters non-recordable. */
export function buildForm300(incidents: IncidentRow[]): Form300Row[] {
  const recordable = incidents.filter(i => i.osha_recordable)
  // Stable order: by date ascending. The 300 form is a chronological log.
  recordable.sort((a, b) => a.date.localeCompare(b.date))
  return recordable.map((i, idx) => ({
    caseNumber: idx + 1,
    employeeName: i.injured_party_name ?? '(unknown)',
    jobTitle: i.injured_party_trade ?? '(unknown)',
    dateOfInjury: i.date.slice(0, 10),
    whereOccurred: i.location ?? '(not recorded)',
    description: i.description,
    classification: classifyCase(i),
    daysAwayFromWork: i.days_away ?? 0,
    daysOnJobRestriction: i.days_restricted ?? 0,
    injuryOrIllnessType: i.type,
  }))
}

/** Build the annual summary (300A). */
export function buildForm300A(
  rows: Form300Row[],
  inputs: {
    year: number
    establishment: string
    totalHoursWorked?: number | null
    averageEmployeeCount?: number | null
  },
): Form300A {
  let totalDeaths = 0
  let totalDaysAway = 0
  let totalRestricted = 0
  let totalOtherRecordable = 0
  let totalDaysAwayDays = 0
  let totalRestrictedDays = 0

  for (const r of rows) {
    switch (r.classification) {
      case 'death':            totalDeaths += 1; break
      case 'days_away':        totalDaysAway += 1; break
      case 'restricted':       totalRestricted += 1; break
      case 'other_recordable': totalOtherRecordable += 1; break
    }
    totalDaysAwayDays += r.daysAwayFromWork
    totalRestrictedDays += r.daysOnJobRestriction
  }

  return {
    year: inputs.year,
    establishment: inputs.establishment,
    totalDeaths,
    totalDaysAway,
    totalRestricted,
    totalOtherRecordable,
    totalCases: totalDeaths + totalDaysAway + totalRestricted + totalOtherRecordable,
    totalDaysAwayDays,
    totalRestrictedDays,
    totalHoursWorked: inputs.totalHoursWorked ?? null,
    averageEmployeeCount: inputs.averageEmployeeCount ?? null,
    postingPeriod: { from: `${inputs.year + 1}-02-01`, to: `${inputs.year + 1}-04-30` },
  }
}

/** Build per-incident 301 detail. */
export function buildForm301(
  incident: IncidentRow,
  caseNumber: number,
  detail: {
    whatHappened: string
    injuryNature: string
    injuryBodyPart: string
    treatment: string
    source: string
  },
): Form301 {
  return {
    caseNumber,
    employeeName: incident.injured_party_name ?? '(unknown)',
    injuryDate: incident.date.slice(0, 10),
    injuryDescription: incident.description,
    whatHappened: detail.whatHappened,
    injuryNature: detail.injuryNature,
    injuryBodyPart: detail.injuryBodyPart,
    treatment: detail.treatment,
    source: detail.source,
    result: classifyCase(incident),
  }
}

/** ITA portal CSV. OSHA accepts a fixed column layout. */
export function exportItaCsv(
  rows: Form300Row[],
  summary: Form300A,
): string {
  const header = [
    'establishment_name',
    'year',
    'case_number',
    'employee_name',
    'job_title',
    'date_of_injury',
    'where_occurred',
    'description',
    'classification',
    'days_away',
    'days_restricted',
    'injury_or_illness_type',
  ].join(',')
  const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const body = rows.map(r => [
    escape(summary.establishment),
    summary.year,
    r.caseNumber,
    escape(r.employeeName),
    escape(r.jobTitle),
    r.dateOfInjury,
    escape(r.whereOccurred),
    escape(r.description),
    r.classification,
    r.daysAwayFromWork,
    r.daysOnJobRestriction,
    escape(r.injuryOrIllnessType),
  ].join(','))
  return [header, ...body].join('\n')
}
