// ── Digital Twin Types ─────────────────────────────────────────
// Type definitions for the real-time 3D data overlay system.
// Each overlay layer maps project data onto the BIM model.

import type * as THREE from 'three'

// ── Overlay Layer IDs ─────────────────────────────────────────

export const OVERLAY_LAYERS = [
  'progress',
  'rfis',
  'safety',
  'schedule',
  'crews',
  'photos',
] as const

export type OverlayLayerId = (typeof OVERLAY_LAYERS)[number]

export interface OverlayLayerConfig {
  id: OverlayLayerId
  label: string
  description: string
  icon: string // lucide icon name
  color: string // theme color key
}

export const OVERLAY_CONFIG: Record<OverlayLayerId, OverlayLayerConfig> = {
  progress: {
    id: 'progress',
    label: 'Progress',
    description: 'Color elements by completion percentage',
    icon: 'TrendingUp',
    color: 'statusActive',
  },
  rfis: {
    id: 'rfis',
    label: 'RFIs',
    description: 'Pin markers on elements with open RFIs',
    icon: 'AlertTriangle',
    color: 'primaryOrange',
  },
  safety: {
    id: 'safety',
    label: 'Safety',
    description: 'Heatmap of incident locations',
    icon: 'ShieldAlert',
    color: 'statusCritical',
  },
  schedule: {
    id: 'schedule',
    label: 'Schedule',
    description: 'Timeline slider showing planned vs actual',
    icon: 'Calendar',
    color: 'statusInfo',
  },
  crews: {
    id: 'crews',
    label: 'Crews',
    description: 'Real time crew locations from GPS check in',
    icon: 'Users',
    color: 'statusReview',
  },
  photos: {
    id: 'photos',
    label: 'Photos',
    description: 'Photo pins at 3D locations',
    icon: 'Camera',
    color: 'statusPending',
  },
}

// ── Progress Overlay Data ─────────────────────────────────────

export interface ProgressElement {
  elementId: string       // IFC element ID or BIM element ID
  taskId: string
  taskTitle: string
  percentComplete: number // 0-100
  trade: string
  location: string
  status: 'not_started' | 'in_progress' | 'complete' | 'behind'
}

// ── RFI Pin Data ──────────────────────────────────────────────

export interface RFIPin {
  id: string
  rfiNumber: string
  subject: string
  status: 'open' | 'under_review' | 'answered' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  position: { x: number; y: number; z: number }
  elementId?: string
  assignedTo?: string
  daysOpen: number
  isOverdue: boolean
}

// ── Safety Heatmap Data ───────────────────────────────────────

export interface SafetyIncident {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  position: { x: number; y: number; z: number }
  date: string
  type: string // 'near_miss' | 'first_aid' | 'recordable' | 'lost_time'
  corrective_action?: string
  resolved: boolean
}

export interface SafetyZone {
  id: string
  center: { x: number; y: number; z: number }
  radius: number
  incidentCount: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// ── Schedule Timeline Data ────────────────────────────────────

export interface ScheduleElement {
  elementId: string
  taskId: string
  taskTitle: string
  plannedStart: string  // ISO date
  plannedEnd: string
  actualStart?: string
  actualEnd?: string
  percentComplete: number
  isCriticalPath: boolean
  isBehind: boolean
  daysVariance: number  // negative = behind, positive = ahead
}

export interface TimelineState {
  currentDate: string       // ISO date the slider is set to
  projectStart: string
  projectEnd: string
  showPlanned: boolean
  showActual: boolean
  highlightBehind: boolean
}

// ── Crew Location Data ────────────────────────────────────────

export interface CrewLocation {
  id: string
  crewName: string
  trade: string
  headcount: number
  foreman: string
  position: { x: number; y: number; z: number }
  currentTask?: string
  checkInTime: string
  lastUpdated: string
  status: 'active' | 'break' | 'idle'
}

// ── Photo Pin Data ────────────────────────────────────────────

export interface PhotoPin {
  id: string
  photoUrl: string
  thumbnailUrl?: string
  position: { x: number; y: number; z: number }
  cameraState?: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
  }
  takenAt: string
  takenBy: string
  description?: string
  linkedEntityType?: string
  linkedEntityId?: string
}

// ── Markup Types ──────────────────────────────────────────────

export type MarkupTool = 'pin' | 'cloud' | 'dimension' | 'section' | 'measure' | 'select'

export interface Markup3D {
  id: string
  type: MarkupTool
  position: { x: number; y: number; z: number }
  endPosition?: { x: number; y: number; z: number } // For dimension/measure
  label?: string
  color: string
  linkedEntityType?: string
  linkedEntityId?: string
  createdBy: string
  createdAt: string
}

// ── Viewpoint (Shareable Camera State) ────────────────────────

export interface Viewpoint {
  id: string
  name: string
  cameraPosition: { x: number; y: number; z: number }
  cameraTarget: { x: number; y: number; z: number }
  visibleLayers: OverlayLayerId[]
  visibleFloors: string[]
  timelineDate?: string
  markupIds: string[]
  createdBy: string
  createdAt: string
  shareUrl?: string
}

// ── IoT Sensor Types (future ready) ──────────────────────────

export interface IoTSensor {
  id: string
  name: string
  type: 'temperature' | 'humidity' | 'vibration' | 'dust' | 'noise' | 'co2'
  position: { x: number; y: number; z: number }
  currentValue: number
  unit: string
  thresholds: {
    warning: number
    critical: number
  }
  status: 'normal' | 'warning' | 'critical' | 'offline'
  lastReading: string
}

// ── Digital Twin State ────────────────────────────────────────

export interface DigitalTwinState {
  // Layer visibility
  activeLayers: Set<OverlayLayerId>

  // Data per layer
  progressElements: ProgressElement[]
  rfiPins: RFIPin[]
  safetyIncidents: SafetyIncident[]
  safetyZones: SafetyZone[]
  scheduleElements: ScheduleElement[]
  crewLocations: CrewLocation[]
  photoPins: PhotoPin[]
  markups: Markup3D[]
  sensors: IoTSensor[]

  // Timeline
  timeline: TimelineState

  // Interaction
  selectedPinId: string | null
  selectedPinType: OverlayLayerId | null
  activeTool: MarkupTool

  // Viewpoints
  viewpoints: Viewpoint[]
}
