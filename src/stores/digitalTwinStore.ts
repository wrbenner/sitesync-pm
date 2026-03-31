import { create } from 'zustand'
import type {
  OverlayLayerId,
  ProgressElement,
  RFIPin,
  SafetyIncident,
  SafetyZone,
  ScheduleElement,
  CrewLocation,
  PhotoPin,
  Markup3D,
  IoTSensor,
  TimelineState,
  MarkupTool,
  Viewpoint,
} from '../types/digitalTwin'

// ── Digital Twin Store ────────────────────────────────────────
// Central state for the 3D digital twin overlay system.
// Manages layer visibility, overlay data, timeline, interaction,
// markups, and shareable viewpoints.

interface DigitalTwinStore {
  // Layer visibility
  activeLayers: Set<OverlayLayerId>
  toggleLayer: (id: OverlayLayerId) => void
  setLayerActive: (id: OverlayLayerId, active: boolean) => void

  // Progress overlay
  progressElements: ProgressElement[]
  setProgressElements: (elements: ProgressElement[]) => void

  // RFI pins
  rfiPins: RFIPin[]
  setRFIPins: (pins: RFIPin[]) => void

  // Safety
  safetyIncidents: SafetyIncident[]
  safetyZones: SafetyZone[]
  setSafetyData: (incidents: SafetyIncident[], zones: SafetyZone[]) => void

  // Schedule
  scheduleElements: ScheduleElement[]
  setScheduleElements: (elements: ScheduleElement[]) => void

  // Timeline
  timeline: TimelineState
  setTimelineDate: (date: string) => void
  setTimelineOptions: (opts: Partial<TimelineState>) => void

  // Crews
  crewLocations: CrewLocation[]
  setCrewLocations: (locations: CrewLocation[]) => void
  updateCrewLocation: (id: string, position: { x: number; y: number; z: number }) => void

  // Photos
  photoPins: PhotoPin[]
  setPhotoPins: (pins: PhotoPin[]) => void
  addPhotoPin: (pin: PhotoPin) => void

  // Markups
  markups: Markup3D[]
  setMarkups: (markups: Markup3D[]) => void
  addMarkup: (markup: Markup3D) => void
  removeMarkup: (id: string) => void

  // IoT sensors
  sensors: IoTSensor[]
  setSensors: (sensors: IoTSensor[]) => void

  // Interaction
  selectedPinId: string | null
  selectedPinType: OverlayLayerId | null
  selectPin: (id: string | null, type: OverlayLayerId | null) => void
  activeTool: MarkupTool
  setActiveTool: (tool: MarkupTool) => void

  // Viewpoints
  viewpoints: Viewpoint[]
  setViewpoints: (viewpoints: Viewpoint[]) => void
  addViewpoint: (viewpoint: Viewpoint) => void

  // Reset
  resetOverlays: () => void
}

const today = new Date().toISOString().split('T')[0]

export const useDigitalTwinStore = create<DigitalTwinStore>()((set) => ({
  // Layer visibility — start with progress on
  activeLayers: new Set<OverlayLayerId>(['progress']),

  toggleLayer: (id) =>
    set((s) => {
      const next = new Set(s.activeLayers)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { activeLayers: next }
    }),

  setLayerActive: (id, active) =>
    set((s) => {
      const next = new Set(s.activeLayers)
      if (active) next.add(id)
      else next.delete(id)
      return { activeLayers: next }
    }),

  // Progress
  progressElements: [],
  setProgressElements: (elements) => set({ progressElements: elements }),

  // RFIs
  rfiPins: [],
  setRFIPins: (pins) => set({ rfiPins: pins }),

  // Safety
  safetyIncidents: [],
  safetyZones: [],
  setSafetyData: (incidents, zones) =>
    set({ safetyIncidents: incidents, safetyZones: zones }),

  // Schedule
  scheduleElements: [],
  setScheduleElements: (elements) => set({ scheduleElements: elements }),

  // Timeline
  timeline: {
    currentDate: today,
    projectStart: '2025-03-01',
    projectEnd: '2027-06-30',
    showPlanned: true,
    showActual: true,
    highlightBehind: true,
  },
  setTimelineDate: (date) =>
    set((s) => ({ timeline: { ...s.timeline, currentDate: date } })),
  setTimelineOptions: (opts) =>
    set((s) => ({ timeline: { ...s.timeline, ...opts } })),

  // Crews
  crewLocations: [],
  setCrewLocations: (locations) => set({ crewLocations: locations }),
  updateCrewLocation: (id, position) =>
    set((s) => ({
      crewLocations: s.crewLocations.map((c) =>
        c.id === id ? { ...c, position, lastUpdated: new Date().toISOString() } : c,
      ),
    })),

  // Photos
  photoPins: [],
  setPhotoPins: (pins) => set({ photoPins: pins }),
  addPhotoPin: (pin) => set((s) => ({ photoPins: [...s.photoPins, pin] })),

  // Markups
  markups: [],
  setMarkups: (markups) => set({ markups }),
  addMarkup: (markup) => set((s) => ({ markups: [...s.markups, markup] })),
  removeMarkup: (id) =>
    set((s) => ({ markups: s.markups.filter((m) => m.id !== id) })),

  // IoT
  sensors: [],
  setSensors: (sensors) => set({ sensors }),

  // Interaction
  selectedPinId: null,
  selectedPinType: null,
  selectPin: (id, type) => set({ selectedPinId: id, selectedPinType: type }),
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),

  // Viewpoints
  viewpoints: [],
  setViewpoints: (viewpoints) => set({ viewpoints }),
  addViewpoint: (viewpoint) =>
    set((s) => ({ viewpoints: [...s.viewpoints, viewpoint] })),

  // Reset
  resetOverlays: () =>
    set({
      activeLayers: new Set<OverlayLayerId>(['progress']),
      selectedPinId: null,
      selectedPinType: null,
      activeTool: 'select',
    }),
}))
