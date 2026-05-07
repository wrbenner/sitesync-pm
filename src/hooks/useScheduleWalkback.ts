// Phase 5 — schedule walkback computation for required-on-site default.
//
// One of the seven North-Star principles ("Predictive defaults, never
// sticky labels"): the required-on-site date should never be empty. The
// platform computes it from
//
//   schedule_activity.start_date
//     - buffer_days (default 5)
//     - ship_lead_time_days (kind-specific reference table, default 7)
//     - fab_lead_time_days (kind-specific, default 28)
//     - review_duration_days (project SLA, default 10)
//
// = computed_submit_by_date
//
// And separately, computed_required_on_site = activity.start_date - buffer.
// The hook returns both dates plus a structured breakdown so the modal can
// render the "auto" badge + a popover explaining how each date was derived.

import { useMemo } from 'react'
import type { SubmittalKind } from '../types/submittal'
import { useScheduleActivities } from './useScheduleActivities'
import { useSubmittalSettings } from './useSubmittalSettings'

export interface WalkbackBreakdown {
  schedule_activity_id: string | null
  schedule_activity_name: string | null
  activity_start_date: string | null
  buffer_days: number
  ship_lead_time_days: number
  fab_lead_time_days: number
  review_duration_days: number
  /** Day arithmetic result: activity_start - buffer. */
  computed_required_on_site: string | null
  /** computed_required_on_site - ship - fab - review. */
  computed_submit_by: string | null
  /** Computed lead time in weeks (ship + fab) — feeds Full tier pre-fill. */
  computed_lead_time_weeks: number | null
  /** True when we have enough inputs to compute (activity + start date). */
  ready: boolean
}

// Kind-specific lead-time table. Real production would source from
// `reference_lead_times` (per spec Part 5.1). Phase 5 ships an inline table
// covering the common kinds.
const LEAD_TIME_TABLE: Record<SubmittalKind, { ship: number; fab: number }> = {
  shop_drawing:        { ship: 7,  fab: 28 },
  product_data:        { ship: 5,  fab: 7 },
  sample:              { ship: 5,  fab: 7 },
  mockup:              { ship: 14, fab: 35 },
  test_report:         { ship: 3,  fab: 14 },
  certification:       { ship: 3,  fab: 7 },
  qualification:       { ship: 3,  fab: 7 },
  closeout:            { ship: 5,  fab: 5 },
  warranty:            { ship: 3,  fab: 5 },
  leed_credit:         { ship: 3,  fab: 7 },
  coordination_drawing:{ ship: 7,  fab: 21 },
  maintenance:         { ship: 5,  fab: 7 },
  other:               { ship: 7,  fab: 14 },
}

const DEFAULT_BUFFER = 5
const DEFAULT_REVIEW_SLA = 10

/** Subtract `days` from an ISO date string; returns ISO date or null when input is null. */
function subtractDays(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export interface UseScheduleWalkbackOpts {
  projectId: string | null | undefined
  scheduleActivityId: string | null
  kind: SubmittalKind | null
}

export function useScheduleWalkback(opts: UseScheduleWalkbackOpts): WalkbackBreakdown {
  const { projectId, scheduleActivityId, kind } = opts
  const { data: activities } = useScheduleActivities(projectId ?? '')
  const { data: settings } = useSubmittalSettings(projectId)

  return useMemo<WalkbackBreakdown>(() => {
    const lead = kind ? LEAD_TIME_TABLE[kind] : LEAD_TIME_TABLE.other
    const buffer = settings?.default_buffer_days ?? DEFAULT_BUFFER
    const reviewSla = settings?.default_sla_days ?? DEFAULT_REVIEW_SLA

    const activity = activities?.find?.((a: { id: string }) => a.id === scheduleActivityId) ?? null
    const startDate = (activity as { start_date?: string | null } | null)?.start_date ?? null
    const activityName = (activity as { name?: string | null } | null)?.name ?? null

    const requiredOnSite = subtractDays(startDate, buffer)
    const submitBy = subtractDays(requiredOnSite, lead.ship + lead.fab + reviewSla)
    const leadTimeWeeks = Math.round(((lead.ship + lead.fab) / 7) * 10) / 10

    return {
      schedule_activity_id: scheduleActivityId,
      schedule_activity_name: activityName,
      activity_start_date: startDate,
      buffer_days: buffer,
      ship_lead_time_days: lead.ship,
      fab_lead_time_days: lead.fab,
      review_duration_days: reviewSla,
      computed_required_on_site: requiredOnSite,
      computed_submit_by: submitBy,
      computed_lead_time_weeks: leadTimeWeeks,
      ready: !!startDate,
    }
  }, [activities, scheduleActivityId, kind, settings])
}

// Stand-alone helper for tests (no React).
export function computeWalkback(input: {
  activity_start_date: string | null
  buffer_days?: number
  kind?: SubmittalKind | null
  review_sla_days?: number
}): WalkbackBreakdown {
  const kind = input.kind ?? 'other'
  const lead = LEAD_TIME_TABLE[kind]
  const buffer = input.buffer_days ?? DEFAULT_BUFFER
  const reviewSla = input.review_sla_days ?? DEFAULT_REVIEW_SLA

  const requiredOnSite = subtractDays(input.activity_start_date, buffer)
  const submitBy = subtractDays(requiredOnSite, lead.ship + lead.fab + reviewSla)
  const leadTimeWeeks = Math.round(((lead.ship + lead.fab) / 7) * 10) / 10

  return {
    schedule_activity_id: null,
    schedule_activity_name: null,
    activity_start_date: input.activity_start_date,
    buffer_days: buffer,
    ship_lead_time_days: lead.ship,
    fab_lead_time_days: lead.fab,
    review_duration_days: reviewSla,
    computed_required_on_site: requiredOnSite,
    computed_submit_by: submitBy,
    computed_lead_time_weeks: leadTimeWeeks,
    ready: input.activity_start_date != null,
  }
}
