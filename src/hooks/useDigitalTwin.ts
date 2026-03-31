// ── useDigitalTwin ────────────────────────────────────────────
// Fetches real-time data for all digital twin overlay layers.
// Subscribes to Supabase Realtime for live updates to
// task progress, RFIs, safety incidents, crew locations, and photos.

import { useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useProjectId } from './useProjectId'
import { useDigitalTwinStore } from '../stores/digitalTwinStore'
import type {
  ProgressElement,
  RFIPin,
  SafetyIncident,
  SafetyZone,
  ScheduleElement,
  CrewLocation,
  PhotoPin,
} from '../types/digitalTwin'

// ── Main Hook ─────────────────────────────────────────────────

export function useDigitalTwin() {
  const projectId = useProjectId()
  const queryClient = useQueryClient()
  const store = useDigitalTwinStore()

  // ── Progress Data (tasks with completion %) ─────────────

  const { data: progressData } = useQuery({
    queryKey: ['digital-twin-progress', projectId],
    queryFn: async (): Promise<ProgressElement[]> => {
      if (!projectId || !isSupabaseConfigured) return []
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, percent_complete, status, trade, location')
        .eq('project_id', projectId)
        .not('percent_complete', 'is', null)
      if (error) throw error
      return (data ?? []).map((task) => ({
        elementId: `task-${task.id}`,
        taskId: task.id,
        taskTitle: task.title ?? '',
        percentComplete: task.percent_complete ?? 0,
        trade: task.trade ?? 'General',
        location: task.location ?? '',
        status:
          (task.percent_complete ?? 0) === 0
            ? 'not_started'
            : (task.percent_complete ?? 0) >= 100
              ? 'complete'
              : task.status === 'behind'
                ? 'behind'
                : 'in_progress',
      }))
    },
    enabled: !!projectId && isSupabaseConfigured,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (progressData) store.setProgressElements(progressData)
  }, [progressData, store])

  // ── RFI Pins ────────────────────────────────────────────

  const { data: rfiData } = useQuery({
    queryKey: ['digital-twin-rfis', projectId],
    queryFn: async (): Promise<RFIPin[]> => {
      if (!projectId || !isSupabaseConfigured) return []
      const { data, error } = await supabase
        .from('rfis')
        .select('id, rfi_number, subject, status, priority, location, assigned_to, due_date, created_at')
        .eq('project_id', projectId)
        .in('status', ['open', 'under_review'])
      if (error) throw error
      return (data ?? []).map((rfi) => {
        const daysOpen = Math.floor(
          (Date.now() - new Date(rfi.created_at).getTime()) / (1000 * 60 * 60 * 24),
        )
        const isOverdue = rfi.due_date
          ? new Date(rfi.due_date) < new Date()
          : daysOpen > 14
        // Map location string to approximate 3D position
        const pos = locationTo3DPosition(rfi.location)
        return {
          id: rfi.id,
          rfiNumber: rfi.rfi_number ?? `RFI-${rfi.id.substring(0, 4)}`,
          subject: rfi.subject ?? '',
          status: rfi.status as RFIPin['status'],
          priority: (rfi.priority as RFIPin['priority']) ?? 'medium',
          position: pos,
          assignedTo: rfi.assigned_to ?? undefined,
          daysOpen,
          isOverdue,
        }
      })
    },
    enabled: !!projectId && isSupabaseConfigured,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (rfiData) store.setRFIPins(rfiData)
  }, [rfiData, store])

  // ── Safety Incidents ────────────────────────────────────

  const { data: safetyData } = useQuery({
    queryKey: ['digital-twin-safety', projectId],
    queryFn: async (): Promise<{ incidents: SafetyIncident[]; zones: SafetyZone[] }> => {
      if (!projectId || !isSupabaseConfigured) return { incidents: [], zones: [] }
      const { data, error } = await supabase
        .from('incidents')
        .select('id, description, severity, location, incident_date, incident_type, corrective_action, status')
        .eq('project_id', projectId)
        .order('incident_date', { ascending: false })
        .limit(100)
      if (error) throw error

      const incidents: SafetyIncident[] = (data ?? []).map((inc) => ({
        id: inc.id,
        description: inc.description ?? '',
        severity: (inc.severity as SafetyIncident['severity']) ?? 'low',
        position: locationTo3DPosition(inc.location),
        date: inc.incident_date ?? '',
        type: inc.incident_type ?? 'near_miss',
        corrective_action: inc.corrective_action ?? undefined,
        resolved: inc.status === 'closed' || inc.status === 'resolved',
      }))

      // Cluster incidents into safety zones
      const zones = clusterIncidents(incidents)

      return { incidents, zones }
    },
    enabled: !!projectId && isSupabaseConfigured,
    staleTime: 120_000,
  })

  useEffect(() => {
    if (safetyData) store.setSafetyData(safetyData.incidents, safetyData.zones)
  }, [safetyData, store])

  // ── Schedule Elements ───────────────────────────────────

  const { data: scheduleData } = useQuery({
    queryKey: ['digital-twin-schedule', projectId],
    queryFn: async (): Promise<ScheduleElement[]> => {
      if (!projectId || !isSupabaseConfigured) return []
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, planned_start, planned_end, actual_start, actual_end, percent_complete, is_critical, status')
        .eq('project_id', projectId)
      if (error) throw error

      return (data ?? []).map((task) => {
        const plannedEnd = task.planned_end ? new Date(task.planned_end) : null
        const actualEnd = task.actual_end ? new Date(task.actual_end) : null
        const now = new Date()
        const isBehind =
          task.status === 'behind' ||
          (plannedEnd && !actualEnd && plannedEnd < now && (task.percent_complete ?? 0) < 100)
        const daysVariance = plannedEnd
          ? Math.round(((actualEnd ?? now).getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24))
          : 0

        return {
          elementId: `task-${task.id}`,
          taskId: task.id,
          taskTitle: task.title ?? '',
          plannedStart: task.planned_start ?? '',
          plannedEnd: task.planned_end ?? '',
          actualStart: task.actual_start ?? undefined,
          actualEnd: task.actual_end ?? undefined,
          percentComplete: task.percent_complete ?? 0,
          isCriticalPath: task.is_critical ?? false,
          isBehind: !!isBehind,
          daysVariance: -daysVariance, // negative = behind
        }
      })
    },
    enabled: !!projectId && isSupabaseConfigured,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (scheduleData) store.setScheduleElements(scheduleData)
  }, [scheduleData, store])

  // ── Crew Locations ──────────────────────────────────────

  const { data: crewData } = useQuery({
    queryKey: ['digital-twin-crews', projectId],
    queryFn: async (): Promise<CrewLocation[]> => {
      if (!projectId || !isSupabaseConfigured) return []
      const { data, error } = await supabase
        .from('crews')
        .select('id, name, trade, headcount, foreman, status')
        .eq('project_id', projectId)
        .eq('status', 'active')
      if (error) throw error

      return (data ?? []).map((crew, i) => ({
        id: crew.id,
        crewName: crew.name ?? `Crew ${i + 1}`,
        trade: crew.trade ?? 'General',
        headcount: crew.headcount ?? 0,
        foreman: crew.foreman ?? '',
        position: distributeCrewPosition(i, data?.length ?? 1),
        checkInTime: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: (crew.status as CrewLocation['status']) ?? 'active',
      }))
    },
    enabled: !!projectId && isSupabaseConfigured,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (crewData) store.setCrewLocations(crewData)
  }, [crewData, store])

  // ── Photo Pins ──────────────────────────────────────────

  const { data: photoData } = useQuery({
    queryKey: ['digital-twin-photos', projectId],
    queryFn: async (): Promise<PhotoPin[]> => {
      if (!projectId || !isSupabaseConfigured) return []
      const { data, error } = await supabase
        .from('field_captures')
        .select('id, content, location, created_at, created_by, type')
        .eq('project_id', projectId)
        .eq('type', 'photo')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error

      return (data ?? []).map((photo) => ({
        id: photo.id,
        photoUrl: photo.content ?? '',
        position: locationTo3DPosition(photo.location),
        takenAt: photo.created_at ?? '',
        takenBy: photo.created_by ?? '',
        description: photo.content ?? undefined,
      }))
    },
    enabled: !!projectId && isSupabaseConfigured,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (photoData) store.setPhotoPins(photoData)
  }, [photoData, store])

  // ── Real-time Subscriptions ─────────────────────────────

  useEffect(() => {
    if (!projectId || !isSupabaseConfigured) return

    const channel = supabase
      .channel(`digital-twin-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['digital-twin-progress', projectId] })
          queryClient.invalidateQueries({ queryKey: ['digital-twin-schedule', projectId] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rfis', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['digital-twin-rfis', projectId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['digital-twin-safety', projectId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'field_captures', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['digital-twin-photos', projectId] }),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, queryClient])

  return {
    activeLayers: store.activeLayers,
    toggleLayer: store.toggleLayer,
    progressElements: store.progressElements,
    rfiPins: store.rfiPins,
    safetyIncidents: store.safetyIncidents,
    safetyZones: store.safetyZones,
    scheduleElements: store.scheduleElements,
    crewLocations: store.crewLocations,
    photoPins: store.photoPins,
    timeline: store.timeline,
    setTimelineDate: store.setTimelineDate,
    selectedPinId: store.selectedPinId,
    selectedPinType: store.selectedPinType,
    selectPin: store.selectPin,
    activeTool: store.activeTool,
    setActiveTool: store.setActiveTool,
    markups: store.markups,
    addMarkup: store.addMarkup,
    removeMarkup: store.removeMarkup,
    viewpoints: store.viewpoints,
    addViewpoint: store.addViewpoint,
  }
}

// ── Helpers ───────────────────────────────────────────────────

// Convert location strings like "Level 3 East Wing" to approximate 3D positions
function locationTo3DPosition(location: string | null): { x: number; y: number; z: number } {
  if (!location) return { x: randomRange(-10, 10), y: randomRange(0, 8), z: randomRange(-8, 8) }

  const lower = location.toLowerCase()
  let y = 2 // default mid-height

  // Floor detection
  const floorMatch = lower.match(/(?:floor|level|story)\s*(\d+)/i)
  if (floorMatch) {
    y = (parseInt(floorMatch[1]) - 1) * 3.5 + 1.75
  } else if (lower.includes('ground') || lower.includes('lobby')) {
    y = 1
  } else if (lower.includes('basement')) {
    y = -1.5
  } else if (lower.includes('roof')) {
    y = 11
  }

  // Direction detection
  let x = randomRange(-8, 8)
  let z = randomRange(-6, 6)

  if (lower.includes('east')) x = randomRange(5, 12)
  if (lower.includes('west')) x = randomRange(-12, -5)
  if (lower.includes('north')) z = randomRange(-9, -4)
  if (lower.includes('south')) z = randomRange(4, 9)

  return { x, y, z }
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// Distribute crew positions evenly across the building footprint
function distributeCrewPosition(
  index: number,
  total: number,
): { x: number; y: number; z: number } {
  const cols = Math.ceil(Math.sqrt(total))
  const row = Math.floor(index / cols)
  const col = index % cols
  const spacing = 6

  return {
    x: -10 + col * spacing + randomRange(-1, 1),
    y: Math.floor(index / 4) * 3.5 + 1.5,
    z: -6 + row * spacing + randomRange(-1, 1),
  }
}

// Cluster nearby safety incidents into zones
function clusterIncidents(incidents: SafetyIncident[]): SafetyZone[] {
  if (incidents.length === 0) return []

  const zones: SafetyZone[] = []
  const used = new Set<string>()
  const clusterRadius = 5

  for (const incident of incidents) {
    if (used.has(incident.id)) continue

    // Find all incidents within radius
    const cluster = incidents.filter((other) => {
      if (used.has(other.id)) return false
      const dx = incident.position.x - other.position.x
      const dy = incident.position.y - other.position.y
      const dz = incident.position.z - other.position.z
      return Math.sqrt(dx * dx + dy * dy + dz * dz) < clusterRadius
    })

    for (const c of cluster) used.add(c.id)

    // Average position
    const cx = cluster.reduce((s, c) => s + c.position.x, 0) / cluster.length
    const cy = cluster.reduce((s, c) => s + c.position.y, 0) / cluster.length
    const cz = cluster.reduce((s, c) => s + c.position.z, 0) / cluster.length

    // Max severity in cluster
    const severityOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
    const maxSeverity = cluster.reduce(
      (max, c) =>
        severityOrder[c.severity] > severityOrder[max] ? c.severity : max,
      'low' as SafetyIncident['severity'],
    )

    zones.push({
      id: `zone-${zones.length}`,
      center: { x: cx, y: cy, z: cz },
      radius: Math.max(2, cluster.length * 0.8),
      incidentCount: cluster.length,
      severity: maxSeverity,
    })
  }

  return zones
}
