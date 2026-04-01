// ── useCheckIn ────────────────────────────────────────────────
// Worker check-in/out via QR code scan, manual entry, or geofence.
// Tracks real-time headcount, late arrivals, and hours on site.

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useProjectId } from './useProjectId'

// ── Types ─────────────────────────────────────────────────────

export type CheckInMethod = 'qr_scan' | 'manual' | 'geofence'

export interface CheckInRecord {
  id: string
  projectId: string
  workerId?: string
  workerName: string
  company: string
  trade: string
  checkInAt: string
  checkOutAt?: string
  gpsLat?: number
  gpsLng?: number
  method: CheckInMethod
  hoursOnSite: number
}

export interface HeadcountSummary {
  totalOnSite: number
  byCompany: Array<{ company: string; count: number }>
  byTrade: Array<{ trade: string; count: number }>
  recentCheckIns: CheckInRecord[]
  lateArrivals: CheckInRecord[]
}

// ── QR Code Payload ───────────────────────────────────────────

export function generateQRPayload(projectId: string): string {
  return JSON.stringify({
    type: 'sitesync_checkin',
    projectId,
    timestamp: new Date().toISOString(),
  })
}

export function parseQRPayload(data: string): { projectId: string } | null {
  try {
    const parsed = JSON.parse(data)
    if (parsed.type !== 'sitesync_checkin' || !parsed.projectId) return null
    return { projectId: parsed.projectId }
  } catch {
    return null
  }
}

// ── Headcount Query ───────────────────────────────────────────

export function useHeadcount() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['headcount', projectId],
    queryFn: async (): Promise<HeadcountSummary> => {
      if (!projectId || !isSupabaseConfigured) {
        return { totalOnSite: 0, byCompany: [], byTrade: [], recentCheckIns: [], lateArrivals: [] }
      }

      // Get today's check-ins without check-outs (currently on site)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('site_check_ins')
        .select('*, workforce_members(name, company, trade)')
        .eq('project_id', projectId)
        .gte('check_in_at', todayStart.toISOString())
        .order('check_in_at', { ascending: false })

      if (error) throw error
      const records = data ?? []

      const checkIns: CheckInRecord[] = records.map((r: Record<string, unknown>) => {
        const member = r.workforce_members as Record<string, unknown> | null
        const checkIn = r.check_in_at as string
        const checkOut = r.check_out_at as string | undefined
        const hours = checkOut
          ? (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60)
          : (Date.now() - new Date(checkIn).getTime()) / (1000 * 60 * 60)

        return {
          id: r.id as string,
          projectId: r.project_id as string,
          workerId: r.worker_id as string | undefined,
          workerName: (member?.name as string) ?? 'Unknown',
          company: (member?.company as string) ?? '',
          trade: (member?.trade as string) ?? '',
          checkInAt: checkIn,
          checkOutAt: checkOut,
          gpsLat: r.gps_lat as number | undefined,
          gpsLng: r.gps_lng as number | undefined,
          method: (r.method as CheckInMethod) ?? 'manual',
          hoursOnSite: Math.round(hours * 10) / 10,
        }
      })

      // Currently on site = checked in but not checked out
      const onSite = checkIns.filter((c) => !c.checkOutAt)

      // Group by company
      const companyMap = new Map<string, number>()
      for (const c of onSite) {
        companyMap.set(c.company, (companyMap.get(c.company) || 0) + 1)
      }
      const byCompany = Array.from(companyMap.entries())
        .map(([company, count]) => ({ company, count }))
        .sort((a, b) => b.count - a.count)

      // Group by trade
      const tradeMap = new Map<string, number>()
      for (const c of onSite) {
        tradeMap.set(c.trade, (tradeMap.get(c.trade) || 0) + 1)
      }
      const byTrade = Array.from(tradeMap.entries())
        .map(([trade, count]) => ({ trade, count }))
        .sort((a, b) => b.count - a.count)

      // Late arrivals (checked in after 7:30 AM)
      const lateThreshold = new Date(todayStart)
      lateThreshold.setHours(7, 30, 0, 0)
      const lateArrivals = checkIns.filter(
        (c) => new Date(c.checkInAt) > lateThreshold,
      )

      return {
        totalOnSite: onSite.length,
        byCompany,
        byTrade,
        recentCheckIns: checkIns.slice(0, 10),
        lateArrivals,
      }
    },
    enabled: !!projectId && isSupabaseConfigured,
    refetchInterval: 30_000, // Refresh every 30 seconds
  })
}

// ── Check-In Mutation ─────────────────────────────────────────

export function useCheckInMutation() {
  const projectId = useProjectId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      workerId?: string
      workerName: string
      company: string
      trade: string
      method: CheckInMethod
      gpsLat?: number
      gpsLng?: number
    }) => {
      if (!projectId) throw new Error('Project not configured')

      // Offline: queue for background sync when reconnected
      if (!navigator.onLine || !isSupabaseConfigured) {
        enqueueOfflineCheckIn({
          projectId,
          workerId: params.workerId,
          workerName: params.workerName,
          company: params.company,
          trade: params.trade,
          checkInAt: new Date().toISOString(),
          method: params.method,
        })
        return null
      }

      const { data, error } = await supabase
        .from('site_check_ins')
        .insert({
          project_id: projectId,
          worker_id: params.workerId || null,
          check_in_at: new Date().toISOString(),
          gps_lat: params.gpsLat || null,
          gps_lng: params.gpsLng || null,
          method: params.method,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['headcount', projectId] })
    },
  })
}

// ── Check-Out Mutation ────────────────────────────────────────

export function useCheckOutMutation() {
  const projectId = useProjectId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (checkInId: string) => {
      if (!isSupabaseConfigured) throw new Error('Not configured')

      const { data, error } = await supabase
        .from('site_check_ins')
        .update({ check_out_at: new Date().toISOString() })
        .eq('id', checkInId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['headcount', projectId] })
    },
  })
}

// ── Real-time Headcount Subscription ──────────────────────────

export function useHeadcountRealtime() {
  const projectId = useProjectId()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId || !isSupabaseConfigured) return

    const channel = supabase
      .channel(`headcount-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_check_ins',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['headcount', projectId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, queryClient])
}

// ── subscribeToCheckins ───────────────────────────────────────
// Imperative subscription for multi-super scenarios. Returns an unsubscribe fn.

export function subscribeToCheckins(
  projectId: string,
  onChange: () => void,
): () => void {
  if (!isSupabaseConfigured) return () => {}
  const channel = supabase
    .channel(`checkins-sub-${projectId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'site_check_ins',
      filter: `project_id=eq.${projectId}`,
    }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

// ── WorkerIdentity ────────────────────────────────────────────

export interface WorkerIdentity {
  workerId: string
  workerName: string
  company: string
  trade: string
}

// ── useWorkerLookup ───────────────────────────────────────────
// Resolves a worker from directory_contacts by id or partial name.
// Target: <1s lookup for QR scan resolution.

export function useWorkerLookup() {
  const projectId = useProjectId()
  return useCallback(
    async (idOrName: string): Promise<WorkerIdentity | null> => {
      if (!projectId || !isSupabaseConfigured) return null
      const { data } = await supabase
        .from('directory_contacts')
        .select('id, name, company, trade')
        .eq('project_id', projectId)
        .or(`id.eq.${idOrName},name.ilike.%${idOrName}%`)
        .limit(1)
        .maybeSingle()
      if (!data) return null
      return {
        workerId: data.id as string,
        workerName: (data.name as string) ?? 'Unknown',
        company: (data.company as string) ?? '',
        trade: (data.trade as string) ?? '',
      }
    },
    [projectId],
  )
}

// ── useDailyLogCrewUpsert ─────────────────────────────────────
// Upserts a crew entry in today's daily_log_entries grouped by trade+company.
// Creates the day's daily log if it does not yet exist.

export function useDailyLogCrewUpsert() {
  const projectId = useProjectId()
  return useMutation({
    mutationFn: async (params: {
      trade: string
      company: string
      headcountDelta: number
      timeIn?: string
      timeOut?: string
      hoursDelta?: number
    }) => {
      if (!projectId || !isSupabaseConfigured) return null
      const today = new Date().toISOString().split('T')[0]

      // Find or create today's log
      let logId: string
      const { data: existingLog } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('project_id', projectId)
        .eq('log_date', today)
        .maybeSingle()
      if (existingLog) {
        logId = existingLog.id as string
      } else {
        const { data: created, error } = await supabase
          .from('daily_logs')
          .insert({ project_id: projectId, log_date: today })
          .select('id')
          .single()
        if (error) throw error
        logId = created.id as string
      }

      // Upsert crew entry for this trade+company bucket
      const { data: entry } = await supabase
        .from('daily_log_entries')
        .select('id, headcount, hours, time_in')
        .eq('daily_log_id', logId)
        .eq('type', 'crew')
        .eq('trade', params.trade)
        .eq('company', params.company)
        .maybeSingle()

      if (entry) {
        const patch: Record<string, unknown> = {
          headcount: Math.max(0, ((entry.headcount as number) ?? 0) + params.headcountDelta),
        }
        if (params.timeIn) {
          const prev = entry.time_in as string | null
          if (!prev || params.timeIn < prev) patch.time_in = params.timeIn
        }
        if (params.timeOut) patch.time_out = params.timeOut
        if (params.hoursDelta != null) {
          patch.hours =
            Math.round((((entry.hours as number) ?? 0) + params.hoursDelta) * 10) / 10
        }
        await supabase.from('daily_log_entries').update(patch).eq('id', entry.id as string)
      } else if (params.headcountDelta > 0) {
        await supabase.from('daily_log_entries').insert({
          daily_log_id: logId,
          type: 'crew',
          trade: params.trade || 'General',
          company: params.company || 'Unknown',
          headcount: 1,
          time_in: params.timeIn ?? new Date().toISOString(),
          hours: 0,
        })
      }
      return null
    },
  })
}

// ── Offline Check-In Queue ────────────────────────────────────
// localStorage-based queue; flushed to Supabase on reconnect.

const OFFLINE_CHECKIN_KEY = 'sitesync_offline_checkins'

interface OfflinePendingCheckIn {
  tempId: string
  projectId: string
  workerId?: string
  workerName: string
  company: string
  trade: string
  checkInAt: string
  method: CheckInMethod
}

function readOfflineQueue(): OfflinePendingCheckIn[] {
  try { return JSON.parse(localStorage.getItem(OFFLINE_CHECKIN_KEY) ?? '[]') }
  catch { return [] }
}

function writeOfflineQueue(items: OfflinePendingCheckIn[]) {
  localStorage.setItem(OFFLINE_CHECKIN_KEY, JSON.stringify(items))
}

export function enqueueOfflineCheckIn(item: Omit<OfflinePendingCheckIn, 'tempId'>) {
  writeOfflineQueue([...readOfflineQueue(), { ...item, tempId: crypto.randomUUID() }])
}

// ── useSyncOfflineCheckIns ────────────────────────────────────
// Mount in any page that uses check-in to flush queued offline records.

export function useSyncOfflineCheckIns() {
  const projectId = useProjectId()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId || !isSupabaseConfigured) return

    const flush = async () => {
      const queue = readOfflineQueue().filter((i) => i.projectId === projectId)
      if (!queue.length) return
      const synced: string[] = []
      for (const item of queue) {
        try {
          await supabase.from('site_check_ins').insert({
            project_id: item.projectId,
            worker_id: item.workerId ?? null,
            check_in_at: item.checkInAt,
            method: item.method,
          })
          synced.push(item.tempId)
        } catch { /* leave in queue for retry */ }
      }
      if (synced.length) {
        writeOfflineQueue(readOfflineQueue().filter((i) => !synced.includes(i.tempId)))
        queryClient.invalidateQueries({ queryKey: ['headcount', projectId] })
      }
    }

    window.addEventListener('online', flush)
    if (navigator.onLine) void flush()
    return () => window.removeEventListener('online', flush)
  }, [projectId, queryClient])
}
