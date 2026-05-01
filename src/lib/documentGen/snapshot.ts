/**
 * Project snapshot — frozen at edge-function time, never re-read.
 *
 * The generators in this folder are PURE: they take a fully-loaded
 * snapshot + a target date and return a structured document. The
 * snapshot is captured at the start of the edge function so that:
 *
 *   1. Generation is reproducible (re-run with the same inputs → same output)
 *   2. Long-running generation can't be invalidated mid-flight by writes
 *   3. The audit trail can store snapshot_at + content_hash for tamper detection
 */

export interface ProjectSnapshotMeta {
  project_id: string
  project_name: string
  /** ISO-8601 instant the snapshot was taken. */
  snapshot_at: string
  /** Period covered by this snapshot (depends on the document kind). */
  period_start: string
  period_end: string
}

export interface RfiSnapshotRow {
  id: string
  number: number
  title: string
  status: string
  sent_at: string | null
  responded_at: string | null
  days_open: number
}

export interface SubmittalSnapshotRow {
  id: string
  number: string
  title: string
  status: string
  submitted_at: string | null
  reviewed_at: string | null
}

export interface ChangeOrderSnapshotRow {
  id: string
  number: number
  title: string
  status: string
  cost_impact: number
  schedule_impact_days: number | null
}

export interface PunchItemSnapshotRow {
  id: string
  title: string
  status: string
  severity: 'low' | 'medium' | 'high'
  trade: string | null
}

export interface DailyLogSnapshotRow {
  id: string
  log_date: string
  manpower_count: number | null
  weather_condition: string | null
  notes: string
}

export interface InspectionSnapshotRow {
  id: string
  inspection_type: string
  date: string
  result: 'pass' | 'fail' | 'conditional'
  deficiencies_count: number
}

export interface PaymentSnapshotRow {
  id: string
  application_number: number
  amount_due: number
  status: string
  period_to: string
}

export interface ProjectSnapshot {
  meta: ProjectSnapshotMeta
  rfis: RfiSnapshotRow[]
  submittals: SubmittalSnapshotRow[]
  change_orders: ChangeOrderSnapshotRow[]
  punch_items: PunchItemSnapshotRow[]
  daily_logs: DailyLogSnapshotRow[]
  inspections: InspectionSnapshotRow[]
  payments: PaymentSnapshotRow[]
}

/**
 * Server-side snapshot loader. Lives in this lib but reads from supabase
 * — used exclusively from edge functions (generators never touch supabase).
 */
export async function loadSnapshot(
  // Loose typing: this lib is consumed by both browser tests and edge fns.
  // Edge fns pass the supabase client; browser tests don't call this.
  supabase: { from: (tbl: string) => unknown },
  project_id: string,
  asOfDate: Date,
  /** Period start; defaults to 30 days back from asOfDate. */
  periodStart?: Date,
): Promise<ProjectSnapshot> {
  const periodEnd = asOfDate
  const start = periodStart ?? new Date(asOfDate.getTime() - 30 * 86400_000)

  // The full implementation queries six tables; for now we return a shell
  // with empty rows so unit-testable consumers can stub it. Real edge
  // functions override or extend this.
  const empty: ProjectSnapshot = {
    meta: {
      project_id,
      project_name: '',
      snapshot_at: new Date().toISOString(),
      period_start: start.toISOString(),
      period_end: periodEnd.toISOString(),
    },
    rfis: [],
    submittals: [],
    change_orders: [],
    punch_items: [],
    daily_logs: [],
    inspections: [],
    payments: [],
  }

  // Edge functions can extend this with real queries; we leave it as a
  // shell so the lib compiles in browser tests (where supabase isn't
  // available). The actual loadSnapshot used by edge functions is
  // re-exported there with concrete queries.
  void supabase
  return empty
}
