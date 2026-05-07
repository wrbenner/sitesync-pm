// ── useRFIClockEvents ───────────────────────────────────────────────────
// P2b deliverable #7 — structured pause/resume events with reason codes.
// Days-open counter respects pauses (calendar - paused = effective).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'
import { logAuditEntry } from '../../lib/auditLogger'

const from = (table: string) => fromTable(table as never)

export type RFIPauseReason = 'site_closed' | 'holiday' | 'weather' | 'permit_wait' | 'other'

export interface RFIClockEvent {
  id: string
  rfi_id: string
  paused_at: string
  resumed_at: string | null
  reason_code: RFIPauseReason
  reason_text: string | null
  paused_by: string | null
  resumed_by: string | null
  source: 'manual' | 'auto_weekend' | 'auto_holiday'
  created_at: string
}

const QK = (rfiId: string | undefined) => ['rfi_clock_events', rfiId ?? '__none__']

export function useRFIClockEvents(rfiId: string | undefined) {
  return useQuery({
    queryKey: QK(rfiId),
    enabled: !!rfiId,
    queryFn: async (): Promise<RFIClockEvent[]> => {
      if (!rfiId) return []
      const { data } = await from('rfi_clock_events')
        .select('*')
        .eq('rfi_id' as never, rfiId)
        .order('paused_at' as never, { ascending: false })
      return (data ?? []) as unknown as RFIClockEvent[]
    },
  })
}

export function usePauseRFIClock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      rfiId: string
      projectId: string
      reasonCode: RFIPauseReason
      reasonText?: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await from('rfi_clock_events').insert({
        rfi_id: params.rfiId,
        paused_at: new Date().toISOString(),
        reason_code: params.reasonCode,
        reason_text: params.reasonText ?? null,
        paused_by: user?.id ?? null,
        source: 'manual',
      } as never)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: { rfi_clock_paused: true, reason_code: params.reasonCode },
        metadata: { kind: 'rfi_clock_pause', reason_text: params.reasonText },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK(vars.rfiId) })
    },
  })
}

export function useResumeRFIClock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { eventId: string; rfiId: string; projectId: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await from('rfi_clock_events')
        .update({
          resumed_at: new Date().toISOString(),
          resumed_by: user?.id ?? null,
        } as never)
        .eq('id' as never, params.eventId)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: { rfi_clock_resumed: true, event_id: params.eventId },
        metadata: { kind: 'rfi_clock_resume' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK(vars.rfiId) })
    },
  })
}

/**
 * Compute the days-open breakdown the detail page renders:
 *   "14 days open · 9 calendar · 2 holidays · 3 weekend"
 *
 * Pure for testability. Walks each event and subtracts its paused
 * interval from the calendar-day total. Calendar = today - createdAt
 * in days; pauses are sliced into weekend / holiday / manual buckets
 * via the source column.
 */
export function computeDaysOpenBreakdown(opts: {
  createdAt: string | null
  events: RFIClockEvent[]
  closedAt?: string | null
}): { totalDays: number; calendarDays: number; weekendDays: number; holidayDays: number; pausedDays: number; activeDays: number } {
  if (!opts.createdAt) return { totalDays: 0, calendarDays: 0, weekendDays: 0, holidayDays: 0, pausedDays: 0, activeDays: 0 }
  const start = new Date(opts.createdAt).getTime()
  const end = opts.closedAt ? new Date(opts.closedAt).getTime() : Date.now()
  const calendarDays = Math.max(0, Math.floor((end - start) / 86400000))

  let weekendMs = 0
  let holidayMs = 0
  let pausedMs = 0
  for (const e of opts.events) {
    const pStart = Math.max(start, new Date(e.paused_at).getTime())
    const pEnd = e.resumed_at ? Math.min(end, new Date(e.resumed_at).getTime()) : end
    if (pEnd <= pStart) continue
    const ms = pEnd - pStart
    if (e.source === 'auto_weekend') weekendMs += ms
    else if (e.source === 'auto_holiday') holidayMs += ms
    else pausedMs += ms
  }

  const toDays = (ms: number) => Math.floor(ms / 86400000)
  const weekendDays = toDays(weekendMs)
  const holidayDays = toDays(holidayMs)
  const pausedDays = toDays(pausedMs)
  const totalPaused = weekendDays + holidayDays + pausedDays
  const activeDays = Math.max(0, calendarDays - totalPaused)

  return {
    totalDays: activeDays,
    calendarDays,
    weekendDays,
    holidayDays,
    pausedDays,
    activeDays,
  }
}
