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
      if (!projectId || !isSupabaseConfigured) {
        throw new Error('Project not configured')
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
