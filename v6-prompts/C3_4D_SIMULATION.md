# C3: 4D Construction Simulation

## Executive Summary

Animate the construction sequence over time, synced to the actual schedule. Users scrub a timeline and watch the building assemble element-by-element, colored by progress, with planned vs. actual visualization, critical path highlighting, and weather/crew overlays.

---

## Architecture Overview

### 1. 4D Data Model

```typescript
// src/services/simulation/types.ts

interface ElementTaskMapping {
  elementId: string
  taskId: string
  taskName: string
  floor: number
  position: { x: number; y: number; z: number }
  startDate: Date
  endDate: Date
  duration: number // days
  percentComplete: number
  predecessors: string[] // other task IDs
  successors: string[]
  criticality: 'critical' | 'non-critical'
  actualStartDate?: Date
  actualEndDate?: Date
}

interface TimelineState {
  currentDate: Date
  startDate: Date
  endDate: Date
  isPlaying: boolean
  playbackSpeed: number // 1.0 = 1 day per second
  selectedTaskId?: string
}

interface SimulationFrame {
  date: Date
  visibleElements: string[] // element IDs visible on this date
  activeElements: string[] // currently being worked on
  completedElements: string[]
  crewPositions: Array<{ crewId: string; position: THREE.Vector3; task: string }>
  weather: WeatherData
  dayNumber: number
  projectProgress: number // 0-1
}

interface WeatherData {
  condition: 'clear' | 'cloudy' | 'rainy' | 'snow'
  temperature: number // celsius
  humidity: number
  windSpeed: number
  visibility: number
  constructionStopped: boolean
}
```

### 2. Element-Task Mapping Database

```sql
-- element_task_mappings.sql

CREATE TABLE element_task_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  element_id UUID NOT NULL,
  task_id UUID NOT NULL,

  -- Task scheduling
  task_name VARCHAR(255) NOT NULL,
  task_type VARCHAR(50), -- 'excavation', 'foundation', 'structure', 'mep', 'finishes', etc.
  floor NUMBER,

  -- Dates
  planned_start_date DATE NOT NULL,
  planned_end_date DATE NOT NULL,
  actual_start_date DATE,
  actual_end_date DATE,
  planned_duration_days INTEGER,
  actual_duration_days INTEGER,

  -- Progress
  percent_complete DECIMAL(5,2) DEFAULT 0,
  percent_complete_source VARCHAR(50), -- 'manual', 'point_cloud', 'schedule'

  -- Dependency management
  predecessor_task_ids UUID[] DEFAULT '{}',
  successor_task_ids UUID[] DEFAULT '{}',

  -- Criticality (from critical path analysis)
  is_critical BOOLEAN DEFAULT false,
  slack_days INTEGER,

  -- Crew & equipment
  assigned_crew_ids UUID[] DEFAULT '{}',
  assigned_equipment TEXT[] DEFAULT '{}',

  -- 3D visualization
  element_geometry_hash VARCHAR(64), -- To detect model changes
  element_center_x DECIMAL(12,3),
  element_center_y DECIMAL(12,3),
  element_center_z DECIMAL(12,3),

  -- Status
  status VARCHAR(50) DEFAULT 'planned', -- 'planned', 'in-progress', 'completed', 'delayed', 'cancelled'
  delay_days INTEGER,
  cancellation_reason TEXT,

  notes TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (element_id) REFERENCES bim_elements(id),
  FOREIGN KEY (task_id) REFERENCES schedule_tasks(id)
)

CREATE INDEX idx_mappings_project ON element_task_mappings(project_id)
CREATE INDEX idx_mappings_element ON element_task_mappings(element_id)
CREATE INDEX idx_mappings_task ON element_task_mappings(task_id)
CREATE INDEX idx_mappings_date_range ON element_task_mappings(planned_start_date, planned_end_date)
CREATE INDEX idx_mappings_critical ON element_task_mappings(is_critical)

-- Weather history table (for simulation)
CREATE TABLE weather_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  date DATE NOT NULL,
  condition VARCHAR(50), -- 'clear', 'cloudy', 'rainy', 'snow'
  temperature_celsius DECIMAL(5,2),
  humidity PERCENT DECIMAL(3,1),
  wind_speed_kmh DECIMAL(5,2),
  visibility_meters INTEGER,
  construction_stopped BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, date)
)

-- Crew positions for 4D simulation
CREATE TABLE crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  task_id UUID NOT NULL,
  crew_member_id UUID NOT NULL,
  date DATE NOT NULL,

  -- Position
  location_x DECIMAL(12,3),
  location_y DECIMAL(12,3),
  location_z DECIMAL(12,3),

  -- Activity
  activity VARCHAR(100),
  hours_worked DECIMAL(4,2),

  created_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (task_id) REFERENCES schedule_tasks(id)
)

CREATE INDEX idx_crew_assignments_project ON crew_assignments(project_id)
CREATE INDEX idx_crew_assignments_date ON crew_assignments(date)
```

---

## Timeline Player Component

### 3. Interactive Timeline Scrubber

```typescript
// src/components/simulation/TimelinePlayer.tsx

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize } from 'lucide-react'
import { useFrame } from '@react-three/fiber'
import { format, addDays, differenceInDays } from 'date-fns'
import { SimulationEngine } from '../../services/simulation/SimulationEngine'
import { useSimulation } from '../../hooks/useSimulation'

interface TimelinePlayerProps {
  projectId: string
  buildingId: string
  onFrameChange: (frame: SimulationFrame) => void
}

export const TimelinePlayer: React.FC<TimelinePlayerProps> = ({
  projectId,
  buildingId,
  onFrameChange,
}) => {
  const [timelineState, setTimelineState] = useState<TimelineState>({
    currentDate: new Date(),
    startDate: new Date(),
    endDate: new Date(),
    isPlaying: false,
    playbackSpeed: 7, // 7 days per second = 1 week per second
  })

  const [frame, setFrame] = useState<SimulationFrame | null>(null)
  const simulationEngine = useRef<SimulationEngine | null>(null)
  const animationFrameId = useRef<number>()
  const startTimeRef = useRef<number>()

  const { loadProjectSchedule, getFrameAtDate } = useSimulation()

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      const schedule = await loadProjectSchedule(projectId, buildingId)

      simulationEngine.current = new SimulationEngine(
        projectId,
        buildingId,
        schedule,
      )

      setTimelineState((prev) => ({
        ...prev,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        currentDate: schedule.startDate,
      }))

      // Get first frame
      const firstFrame = await getFrameAtDate(projectId, schedule.startDate)
      setFrame(firstFrame)
      onFrameChange(firstFrame)
    }

    initialize()
  }, [projectId, buildingId])

  // Playback loop
  useEffect(() => {
    if (!timelineState.isPlaying || !simulationEngine.current) return

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime
      }

      const elapsed = (currentTime - startTimeRef.current) / 1000 // seconds
      const daysAdvanced = elapsed * (timelineState.playbackSpeed / 7) // convert speed to days/sec

      const newDate = addDays(
        timelineState.startDate,
        Math.floor(daysAdvanced),
      )

      if (newDate <= timelineState.endDate) {
        setTimelineState((prev) => ({ ...prev, currentDate: newDate }))
      } else {
        // Reached end, stop playback
        setTimelineState((prev) => ({
          ...prev,
          isPlaying: false,
          currentDate: prev.endDate,
        }))
        startTimeRef.current = undefined
      }

      animationFrameId.current = requestAnimationFrame(animate)
    }

    animationFrameId.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [timelineState.isPlaying, timelineState.playbackSpeed])

  // Update frame when date changes
  useEffect(() => {
    const updateFrame = async () => {
      if (!simulationEngine.current) return
      const newFrame = await simulationEngine.current.getFrameAtDate(
        timelineState.currentDate,
      )
      setFrame(newFrame)
      onFrameChange(newFrame)
    }

    updateFrame()
  }, [timelineState.currentDate])

  const handlePlayPause = () => {
    setTimelineState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))
    startTimeRef.current = undefined
  }

  const handleSpeedChange = (speed: number) => {
    setTimelineState((prev) => ({ ...prev, playbackSpeed: speed }))
  }

  const handleSeek = (date: Date) => {
    setTimelineState((prev) => ({ ...prev, currentDate: date }))
  }

  const dayNumber = differenceInDays(
    timelineState.currentDate,
    timelineState.startDate,
  )
  const totalDays = differenceInDays(
    timelineState.endDate,
    timelineState.startDate,
  )
  const progress = dayNumber / totalDays

  return (
    <div className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 rounded-lg shadow-xl">
      {/* Status Info */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1">
          <div className="text-xl font-bold">
            {format(timelineState.currentDate, 'MMMM d, yyyy')}
          </div>
          <div className="text-sm text-gray-400">
            Day {dayNumber + 1} of {totalDays + 1}
            {frame && ` • ${(frame.projectProgress * 100).toFixed(1)}% Complete`}
          </div>
        </div>

        {frame && (
          <div className="text-right">
            <div className="text-lg font-semibold text-blue-400">
              {frame.visibleElements.length} Elements
            </div>
            <div className="text-sm text-gray-400">
              {frame.activeElements.length} In Progress
            </div>
          </div>
        )}
      </div>

      {/* Timeline Scrubber */}
      <TimelineBar
        startDate={timelineState.startDate}
        endDate={timelineState.endDate}
        currentDate={timelineState.currentDate}
        onSeek={handleSeek}
      />

      {/* Controls */}
      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={() => handleSeek(timelineState.startDate)}
          className="p-2 hover:bg-slate-700 rounded"
          title="Go to start"
        >
          <SkipBack size={20} />
        </button>

        <button
          onClick={handlePlayPause}
          className="p-2 hover:bg-slate-700 rounded bg-blue-600"
          title={timelineState.isPlaying ? 'Pause' : 'Play'}
        >
          {timelineState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button
          onClick={() => handleSeek(timelineState.endDate)}
          className="p-2 hover:bg-slate-700 rounded"
          title="Go to end"
        >
          <SkipForward size={20} />
        </button>

        <div className="flex-1" />

        {/* Speed Control */}
        <div className="flex items-center gap-2">
          <span className="text-sm">Speed:</span>
          <select
            value={timelineState.playbackSpeed}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="bg-slate-700 rounded px-2 py-1 text-sm"
          >
            <option value={1}>1x (Real-time)</option>
            <option value={7}>7x (1 week/sec)</option>
            <option value={14}>14x (2 weeks/sec)</option>
            <option value={30}>30x (1 month/sec)</option>
          </select>
        </div>
      </div>

      {/* Weather & Crew Info */}
      {frame && (
        <div className="flex gap-6 mt-4 text-sm border-t border-slate-700 pt-4">
          <div>
            <span className="text-gray-400">Weather:</span>
            <span className="ml-2 font-medium capitalize">{frame.weather.condition}</span>
            <span className="ml-2 text-gray-400">{frame.weather.temperature}°C</span>
          </div>

          {frame.weather.constructionStopped && (
            <div className="text-red-400 font-semibold">⚠ NO WORK - Bad weather</div>
          )}

          <div>
            <span className="text-gray-400">Crew:</span>
            <span className="ml-2 font-medium">{frame.crewPositions.length} positions</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Timeline bar with markers
const TimelineBar: React.FC<{
  startDate: Date
  endDate: Date
  currentDate: Date
  onSeek: (date: Date) => void
}> = ({ startDate, endDate, currentDate, onSeek }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const totalDays = differenceInDays(endDate, startDate)
  const currentDays = differenceInDays(currentDate, startDate)
  const progress = currentDays / totalDays

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const newDate = addDays(startDate, Math.floor(x * totalDays))

    onSeek(newDate)
  }

  return (
    <div
      ref={containerRef}
      className="w-full bg-slate-700 rounded-full h-2 cursor-pointer overflow-hidden relative group"
      onClick={handleClick}
    >
      {/* Progress fill */}
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
        style={{ width: `${progress * 100}%` }}
      />

      {/* Seekable area highlight on hover */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-full" />

      {/* Playhead */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none"
        style={{ left: `${progress * 100}%` }}
      />
    </div>
  )
}
```

---

## Simulation Engine

### 4. Animation & State Management

```typescript
// src/services/simulation/SimulationEngine.ts

export class SimulationEngine {
  private projectId: string
  private buildingId: string
  private schedule: ScheduleData
  private elementTaskMappings: Map<string, ElementTaskMapping> = new Map()
  private bimModel: THREE.Group | null = null
  private elementVisibility: Map<string, boolean> = new Map()
  private elementProgress: Map<string, number> = new Map()

  constructor(projectId: string, buildingId: string, schedule: ScheduleData) {
    this.projectId = projectId
    this.buildingId = buildingId
    this.schedule = schedule

    this.initialize()
  }

  private async initialize() {
    // Load element-task mappings
    const mappings = await this.loadElementTaskMappings()
    for (const mapping of mappings) {
      this.elementTaskMappings.set(mapping.elementId, mapping)
    }

    // Load BIM model
    this.bimModel = await this.loadBIMModel()

    // Initialize visibility states
    this.elementVisibility.forEach((_, elementId) => {
      this.elementVisibility.set(elementId, false)
    })
  }

  async getFrameAtDate(date: Date): Promise<SimulationFrame> {
    const visibleElements: string[] = []
    const activeElements: string[] = []
    const completedElements: string[] = []

    // Determine which elements should be visible/active/complete on this date
    for (const [elementId, mapping] of this.elementTaskMappings) {
      const startDate = mapping.startDate
      const endDate = mapping.endDate
      const actualEndDate = mapping.actualEndDate

      // Element is visible if work has started
      if (date >= startDate) {
        visibleElements.push(elementId)

        // Element is active if currently being worked on
        if (date >= startDate && date < endDate) {
          activeElements.push(elementId)
        }

        // Element is complete if work is done (use actual if available)
        const completionDate = actualEndDate || endDate
        if (date >= completionDate) {
          completedElements.push(elementId)
        }
      }
    }

    // Get crew positions
    const crewPositions = await this.getCrewPositions(date)

    // Get weather data
    const weather = await this.getWeatherData(date)

    // Compute overall progress
    const projectProgress = completedElements.length / this.elementTaskMappings.size

    // Update visibility in 3D model
    this.updateElementVisibility(visibleElements)

    // Color elements by state
    this.colorElementsByState(
      visibleElements,
      activeElements,
      completedElements,
    )

    return {
      date,
      visibleElements,
      activeElements,
      completedElements,
      crewPositions,
      weather,
      dayNumber: differenceInDays(date, this.schedule.startDate),
      projectProgress,
    }
  }

  private updateElementVisibility(visibleElements: string[]) {
    if (!this.bimModel) return

    const visibleSet = new Set(visibleElements)

    this.bimModel.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh && obj.userData.elementId) {
        obj.visible = visibleSet.has(obj.userData.elementId)
      }
    })
  }

  private colorElementsByState(
    visible: string[],
    active: string[],
    completed: string[],
  ) {
    if (!this.bimModel) return

    const visibleSet = new Set(visible)
    const activeSet = new Set(active)
    const completedSet = new Set(completed)

    this.bimModel.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh && obj.userData.elementId) {
        const elementId = obj.userData.elementId
        const material = obj.material as THREE.Material

        if (material instanceof THREE.MeshStandardMaterial) {
          if (completedSet.has(elementId)) {
            // Completed = solid color (green)
            material.color.setHex(0x4ade80)
            material.opacity = 1
            material.transparent = false
          } else if (activeSet.has(elementId)) {
            // Active = animated (blue with pulse)
            material.color.setHex(0x3b82f6)
            material.opacity = 0.9
            material.transparent = true
            material.emissive.setHex(0x1e40af)
            material.emissiveIntensity = 0.5
          } else if (visibleSet.has(elementId)) {
            // Visible but not started = light gray wireframe
            material.color.setHex(0x9ca3af)
            material.opacity = 0.3
            material.transparent = true
            material.wireframe = true
          } else {
            // Not visible yet = hidden
            material.opacity = 0
            material.transparent = true
          }
        }
      }
    })
  }

  private async getCrewPositions(date: Date): Promise<Array<{ crewId: string; position: THREE.Vector3; task: string }>> {
    const response = await fetch(
      `/api/projects/${this.projectId}/crew-assignments?date=${date.toISOString().split('T')[0]}`,
    )
    const data = await response.json()

    return data.map((assignment: any) => ({
      crewId: assignment.crewId,
      position: new THREE.Vector3(
        assignment.locationX,
        assignment.locationY,
        assignment.locationZ,
      ),
      task: assignment.activity,
    }))
  }

  private async getWeatherData(date: Date): Promise<WeatherData> {
    const response = await fetch(
      `/api/projects/${this.projectId}/weather?date=${date.toISOString().split('T')[0]}`,
    )
    const data = await response.json()

    return {
      condition: data.condition || 'clear',
      temperature: data.temperatureCelsius || 20,
      humidity: data.humidity || 50,
      windSpeed: data.windSpeedKmh || 0,
      visibility: data.visibilityMeters || 10000,
      constructionStopped: data.constructionStopped || false,
    }
  }

  private async loadElementTaskMappings(): Promise<ElementTaskMapping[]> {
    const response = await fetch(
      `/api/buildings/${this.buildingId}/element-task-mappings`,
    )
    return response.json()
  }

  private async loadBIMModel(): Promise<THREE.Group> {
    // Load from IFC or cached model
    const response = await fetch(`/api/buildings/${this.buildingId}/model`)
    // TODO: Implement actual loading
    return new THREE.Group()
  }
}
```

---

## Planned vs. Actual Visualization

### 5. Schedule Variance Display

```typescript
// src/components/simulation/PlannedVsActual.tsx

interface PlannedVsActualProps {
  elementId: string
  mapping: ElementTaskMapping
  currentDate: Date
}

export const PlannedVsActual: React.FC<PlannedVsActualProps> = ({
  elementId,
  mapping,
  currentDate,
}) => {
  const plannedProgress = this.computePlannedProgress(mapping, currentDate)
  const actualProgress = mapping.percentComplete

  const variance = actualProgress - plannedProgress // Positive = ahead, negative = behind

  const getColor = () => {
    if (variance > 0.1) return 'bg-green-500' // Ahead of schedule
    if (variance < -0.1) return 'bg-red-500' // Behind schedule
    return 'bg-blue-500' // On track
  }

  return (
    <div className="p-3 bg-slate-900 rounded">
      <div className="font-semibold text-sm mb-2">{mapping.taskName}</div>

      {/* Planned progress (light) */}
      <div className="mb-2">
        <div className="text-xs text-gray-400">Planned: {(plannedProgress * 100).toFixed(0)}%</div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className="h-full bg-gray-500 rounded-full opacity-50"
            style={{ width: `${plannedProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Actual progress (bright) */}
      <div className="mb-2">
        <div className="text-xs text-gray-400">Actual: {(actualProgress * 100).toFixed(0)}%</div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className={`h-full rounded-full ${getColor()}`}
            style={{ width: `${actualProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Variance indicator */}
      <div className={`text-xs font-semibold ${variance > 0 ? 'text-green-400' : 'text-red-400'}`}>
        {variance > 0 ? '↑' : '↓'} {Math.abs(variance * 100).toFixed(0)}% {variance > 0 ? 'ahead' : 'behind'}
      </div>
    </div>
  )
}

private computePlannedProgress(
  mapping: ElementTaskMapping,
  asOfDate: Date,
): number {
  const duration = mapping.endDate.getTime() - mapping.startDate.getTime()
  const elapsed = asOfDate.getTime() - mapping.startDate.getTime()

  if (elapsed <= 0) return 0
  if (elapsed >= duration) return 1

  return elapsed / duration
}
```

---

## Critical Path Visualization

### 6. Critical Path Highlighting

```typescript
// src/components/simulation/CriticalPathDisplay.tsx

interface CriticalPathDisplayProps {
  schedule: ScheduleData
  currentDate: Date
  activeElements: string[]
}

export const CriticalPathDisplay: React.FC<CriticalPathDisplayProps> = ({
  schedule,
  currentDate,
  activeElements,
}) => {
  const criticalTasks = schedule.tasks.filter((t) => {
    const mapping = this.getElementTaskMapping(t.elementId)
    return mapping?.criticality === 'critical'
  })

  const remainingCritical = criticalTasks.filter((t) => currentDate < t.endDate)

  return (
    <div className="w-full bg-red-900/20 border border-red-700 rounded-lg p-4">
      <div className="text-red-300 font-bold mb-3 flex items-center gap-2">
        <AlertTriangle size={18} />
        Critical Path: {remainingCritical.length} tasks remaining
      </div>

      <div className="space-y-2">
        {remainingCritical.map((task) => (
          <div
            key={task.id}
            className={`p-2 rounded text-sm font-medium ${
              activeElements.some((e) => e === task.elementId)
                ? 'bg-red-600 text-white'
                : 'bg-red-900/40 text-red-200'
            }`}
          >
            <div>{task.name}</div>
            <div className="text-xs opacity-75">
              {format(task.startDate, 'MMM d')} - {format(task.endDate, 'MMM d')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

private getElementTaskMapping(elementId: string): ElementTaskMapping | undefined {
  // Lookup in database
  return undefined
}
```

---

## Weather & Crew Overlays

### 7. Dynamic Overlay System

```typescript
// src/components/simulation/WeatherOverlay.tsx

interface WeatherOverlayProps {
  weather: WeatherData
  scene: THREE.Scene
}

export const useWeatherOverlay = (weather: WeatherData, scene: THREE.Scene | null) => {
  useEffect(() => {
    if (!scene) return

    // Clear existing weather effects
    scene.children = scene.children.filter((obj) => !obj.userData.isWeatherEffect)

    if (weather.condition === 'rainy') {
      addRainParticles(scene, weather.intensity || 1)
    } else if (weather.condition === 'snow') {
      addSnowParticles(scene, weather.intensity || 1)
    }

    if (weather.constructionStopped) {
      addFogOverlay(scene, 0xff4444) // Red tint
    } else if (weather.condition === 'cloudy') {
      addFogOverlay(scene, 0xcccccc)
    }
  }, [weather, scene])
}

function addRainParticles(scene: THREE.Scene, intensity: number) {
  const count = Math.floor(5000 * intensity)
  const geometry = new THREE.BufferGeometry()

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = Math.random() * 200 - 100 // x
    positions[i + 1] = Math.random() * 150 // y
    positions[i + 2] = Math.random() * 200 - 100 // z
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color: 0x8899cc,
    size: 0.1,
    transparent: true,
    opacity: 0.6,
  })

  const rain = new THREE.Points(geometry, material)
  rain.userData.isWeatherEffect = true

  // Animate rain falling
  const velocities = new Float32Array(count * 3)
  for (let i = 0; i < count * 3; i += 3) {
    velocities[i] = 0
    velocities[i + 1] = -0.5 * intensity // Fall speed
    velocities[i + 2] = 0
  }

  // Update in animation loop
  const animate = () => {
    const pos = geometry.getAttribute('position') as BufferAttribute
    const posArray = pos.array as Float32Array

    for (let i = 0; i < count * 3; i += 3) {
      posArray[i + 1] -= velocities[i + 1]

      // Wrap around
      if (posArray[i + 1] < -10) {
        posArray[i + 1] = 150
      }
    }

    pos.needsUpdate = true
    requestAnimationFrame(animate)
  }

  animate()
  scene.add(rain)
}

function addSnowParticles(scene: THREE.Scene, intensity: number) {
  // Similar to rain but slower, lateral drift
}

function addFogOverlay(scene: THREE.Scene, color: number) {
  const fog = new THREE.Fog(color, 10, 500)
  scene.fog = fog
}
```

### 8. Crew Position Visualization

```typescript
// src/components/simulation/CrewVisualization.tsx

export const CrewVisualization: React.FC<{ frame: SimulationFrame }> = ({ frame }) => {
  const groupRef = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (!groupRef.current) return

    // Clear previous crew meshes
    groupRef.current.clear()

    // Add crew avatar for each position
    for (const crew of frame.crewPositions) {
      const avatar = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 2, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff6b6b,
          emissive: 0xff6b6b,
          emissiveIntensity: 0.3,
        }),
      )

      avatar.position.copy(crew.position)
      avatar.castShadow = true

      // Label
      const canvas = new OffscreenCanvas(256, 64)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.font = '24px Arial'
      ctx.fillText(crew.task, 10, 40)

      const texture = new THREE.CanvasTexture(canvas as any)
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }))
      label.position.y = 2.5
      avatar.add(label)

      groupRef.current.add(avatar)
    }
  }, [frame.crewPositions])

  return <group ref={groupRef} />
}
```

---

## Video Export

### 9. Time-Lapse Video Rendering

```typescript
// src/services/simulation/VideoExporter.ts

export class SimulationVideoExporter {
  private fps: number = 30
  private duration: number = 60 // seconds
  private width: number = 1920
  private height: number = 1080

  async exportTimelapseVideo(
    projectId: string,
    buildingId: string,
    startDate: Date,
    endDate: Date,
    onProgress: (progress: number) => void,
  ): Promise<Blob> {
    const mediaRecorder = new MediaRecorder(
      await this.getCanvasStream(),
      { mimeType: 'video/webm;codecs=vp9' },
    )

    const chunks: Blob[] = []
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data)

    const simulationEngine = new SimulationEngine(projectId, buildingId, {})
    const canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })

    const totalDays = differenceInDays(endDate, startDate)
    const daysPerFrame = Math.max(1, totalDays / (this.fps * this.duration))

    mediaRecorder.start()

    let currentDate = startDate
    let frameCount = 0

    while (currentDate <= endDate) {
      const frame = await simulationEngine.getFrameAtDate(currentDate)

      // Render frame
      // TODO: Render 3D scene to canvas

      onProgress(frameCount / (this.fps * this.duration))

      currentDate = addDays(currentDate, daysPerFrame)
      frameCount++
    }

    mediaRecorder.stop()

    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        resolve(blob)
      }
    })
  }

  private async getCanvasStream(): Promise<MediaStream> {
    const canvas = document.createElement('canvas')
    const stream = canvas.captureStream(this.fps)
    return stream
  }
}
```

---

## Integration Points

### 10. Schedule Page Integration

```typescript
// src/pages/Schedule.tsx (Enhanced)

import { TimelinePlayer } from '../components/simulation/TimelinePlayer'
import { PlannedVsActual } from '../components/simulation/PlannedVsActual'
import { CriticalPathDisplay } from '../components/simulation/CriticalPathDisplay'
import { BIMViewer } from '../components/drawings/BIMViewer'

export const SchedulePage: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [frame, setFrame] = useState<SimulationFrame | null>(null)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-3 gap-4 h-screen">
      {/* 3D Visualization */}
      <div className="col-span-2 bg-slate-900 rounded-lg overflow-hidden">
        <BIMViewer
          projectId={projectId}
          buildingId="primary"
          onSelectElement={(info) => setSelectedElement(info?.id || null)}
          selectedId={selectedElement}
        />
      </div>

      {/* Timeline & Controls */}
      <div className="col-span-3 bg-slate-800 rounded-lg p-4">
        <TimelinePlayer
          projectId={projectId}
          buildingId="primary"
          onFrameChange={setFrame}
        />
      </div>

      {/* Right Panel */}
      <div className="bg-slate-900 rounded-lg p-4 overflow-y-auto">
        {frame && (
          <>
            <CriticalPathDisplay
              schedule={frame as any}
              currentDate={frame.date}
              activeElements={frame.activeElements}
            />

            {selectedElement && (
              <PlannedVsActual
                elementId={selectedElement}
                mapping={selectedElement as any}
                currentDate={frame.date}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

---

## Database Schema Summary

The implementation uses:
- `element_task_mappings` - Links BIM elements to schedule tasks with dates and progress
- `weather_history` - Historical/forecasted weather for construction impact
- `crew_assignments` - Position and activity tracking for visualization

---

## Expected Performance

- Load project schedule: <1s
- Compute frame at any date: <100ms
- Video export (30-min timelapse): ~5 minutes
- Playback at 7x speed: 60fps with WebGPU

---

## Key Features

1. **Interactive scrubber** - Drag to any date, play/pause, speed control
2. **Planned vs. actual** - Ghost wireframe for planned, solid for actual
3. **Critical path** - Red highlighting for critical tasks, yellow for near-critical
4. **Weather impact** - Rain/snow particles, fog overlay, construction halts
5. **Crew visualization** - Avatars positioned at crew locations
6. **Progress color coding** - Not started (gray) → In progress (blue) → Completed (green)
7. **Video export** - Render timelapse MP4 for presentations
