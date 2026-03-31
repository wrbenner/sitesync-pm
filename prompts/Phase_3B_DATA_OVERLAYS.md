# Phase 3B: Data Overlay Layers on BIM

**Status**: Phase 3 (Digital Twin + Spatial)
**Priority**: High
**Effort**: 12 days
**Target**: Day 47-58

---

## Pre-Requisites

### Dependent Files
- Phase_3A_BIM_VIEWER.md (BIM model loading + element selection)

### New Dependencies
- Supabase real-time subscriptions (already enabled)
- date-fns 3.0+ for date range calculations
- chroma-js 2.4+ for color gradients

### Database Tables (Create if missing)
```sql
-- Progress tracking per element
CREATE TABLE bim_element_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  ifc_element_id INT NOT NULL,
  global_id VARCHAR(255),
  element_name TEXT,
  completion_percent INT CHECK (completion_percent >= 0 AND completion_percent <= 100),
  last_updated TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  notes TEXT,
  UNIQUE(project_id, ifc_element_id)
);

-- RFI element associations
CREATE TABLE bim_rfi_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES rfis(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  ifc_element_id INT NOT NULL,
  location_x FLOAT,
  location_y FLOAT,
  location_z FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Safety hazards on BIM
CREATE TABLE bim_safety_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  hazard_type VARCHAR(50), -- 'fall', 'electrical', 'excavation', 'dust', etc
  zone_bounds JSONB, -- {minX, maxX, minY, maxY, minZ, maxZ}
  description TEXT,
  severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Schedule sequence with 4D data
CREATE TABLE bim_4d_sequence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  schedule_task_id UUID REFERENCES schedule_tasks(id),
  ifc_element_ids INT[] NOT NULL, -- array of element IDs involved
  planned_start_date DATE,
  planned_end_date DATE,
  sequence_order INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crew GPS locations
CREATE TABLE crew_gps_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  altitude FLOAT,
  accuracy_meters INT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  UNIQUE(crew_id, timestamp)
);

-- Create indexes for performance
CREATE INDEX idx_element_progress_project ON bim_element_progress(project_id);
CREATE INDEX idx_rfi_elements_project ON bim_rfi_elements(project_id);
CREATE INDEX idx_safety_zones_project ON bim_safety_zones(project_id);
CREATE INDEX idx_4d_sequence_project ON bim_4d_sequence(project_id);
CREATE INDEX idx_gps_locations_project ON crew_gps_locations(project_id);
```

---

## Implementation Steps

### Step 1: Overlay Layer Manager

**File**: `src/components/BIMViewer/OverlayManager.ts`

```typescript
import * as THREE from 'three';
import chroma from 'chroma-js';
import { supabase } from '@/lib/supabase';

export type OverlayType = 'progress' | 'rfi' | 'safety' | 'schedule' | 'crew';

export interface OverlayLayer {
  type: OverlayType;
  enabled: boolean;
  opacity: number;
  elements: Map<number, OverlayElement>;
  unsubscribe?: () => void;
}

export interface OverlayElement {
  elementId: number;
  data: any;
  mesh?: THREE.Mesh;
  marker?: THREE.Object3D;
}

export class OverlayManager {
  private layers: Map<OverlayType, OverlayLayer> = new Map();
  private scene: THREE.Group;
  private projectId: string;
  private colorGradient: chroma.Scale;

  constructor(scene: THREE.Group, projectId: string) {
    this.scene = scene;
    this.projectId = projectId;

    // Red (0%) -> Yellow (50%) -> Green (100%) gradient
    this.colorGradient = chroma.scale(['#ef4444', '#eab308', '#22c55e']);

    this.initializeLayers();
  }

  private initializeLayers(): void {
    this.layers.set('progress', {
      type: 'progress',
      enabled: false,
      opacity: 1,
      elements: new Map(),
    });

    this.layers.set('rfi', {
      type: 'rfi',
      enabled: false,
      opacity: 1,
      elements: new Map(),
    });

    this.layers.set('safety', {
      type: 'safety',
      enabled: false,
      opacity: 1,
      elements: new Map(),
    });

    this.layers.set('schedule', {
      type: 'schedule',
      enabled: false,
      opacity: 1,
      elements: new Map(),
    });

    this.layers.set('crew', {
      type: 'crew',
      enabled: false,
      opacity: 1,
      elements: new Map(),
    });
  }

  async toggleLayer(type: OverlayType, enabled: boolean): Promise<void> {
    const layer = this.layers.get(type);
    if (!layer) return;

    layer.enabled = enabled;

    if (enabled) {
      await this.loadLayerData(type);
      if (!layer.unsubscribe) {
        layer.unsubscribe = this.subscribeToLayerUpdates(type);
      }
    } else {
      this.clearLayerVisualization(type);
      if (layer.unsubscribe) {
        layer.unsubscribe();
        layer.unsubscribe = undefined;
      }
    }
  }

  setLayerOpacity(type: OverlayType, opacity: number): void {
    const layer = this.layers.get(type);
    if (!layer) return;

    layer.opacity = Math.max(0, Math.min(1, opacity));
    this.updateLayerOpacity(type);
  }

  private async loadLayerData(type: OverlayType): Promise<void> {
    switch (type) {
      case 'progress':
        await this.loadProgressOverlay();
        break;
      case 'rfi':
        await this.loadRFIOverlay();
        break;
      case 'safety':
        await this.loadSafetyOverlay();
        break;
      case 'schedule':
        await this.loadScheduleOverlay();
        break;
      case 'crew':
        await this.loadCrewOverlay();
        break;
    }
  }

  private async loadProgressOverlay(): Promise<void> {
    const { data, error } = await supabase
      .from('bim_element_progress')
      .select('*')
      .eq('project_id', this.projectId);

    if (error || !data) {
      console.error('Failed to load progress data:', error);
      return;
    }

    const layer = this.layers.get('progress')!;
    const modelScene = this.scene;

    for (const row of data) {
      const completion = row.completion_percent / 100; // 0-1
      const color = this.colorGradient(completion);

      // Find corresponding mesh in scene
      let targetMesh: THREE.Mesh | null = null;
      modelScene.traverse((node) => {
        if (
          node instanceof THREE.Mesh &&
          (node as any).userData.ifc_element_id === row.ifc_element_id
        ) {
          targetMesh = node;
        }
      });

      if (!targetMesh) continue;

      // Create overlay material
      const overlayMaterial = new THREE.MeshPhongMaterial({
        color: color.num(),
        opacity: 0.7,
        transparent: true,
        emissive: color.num(),
        emissiveIntensity: 0.3,
      });

      // Create overlay mesh (slightly offset)
      const geometry = (targetMesh.geometry as THREE.BufferGeometry).clone();
      const overlayMesh = new THREE.Mesh(geometry, overlayMaterial);
      overlayMesh.position.copy(targetMesh.position);
      overlayMesh.rotation.copy(targetMesh.rotation);
      overlayMesh.scale.copy(targetMesh.scale);
      overlayMesh.scale.multiplyScalar(1.001); // Slight offset to prevent z-fighting

      this.scene.add(overlayMesh);

      layer.elements.set(row.ifc_element_id, {
        elementId: row.ifc_element_id,
        data: row,
        mesh: overlayMesh,
      });
    }

    console.log(`Progress overlay loaded: ${data.length} elements`);
  }

  private async loadRFIOverlay(): Promise<void> {
    const { data, error } = await supabase
      .from('bim_rfi_elements')
      .select('*, rfi:rfis(*)')
      .eq('project_id', this.projectId);

    if (error || !data) {
      console.error('Failed to load RFI data:', error);
      return;
    }

    const layer = this.layers.get('rfi')!;

    for (const row of data) {
      // Create marker sphere at RFI location
      const markerGeometry = new THREE.SphereGeometry(2, 16, 16);
      const markerMaterial = new THREE.MeshPhongMaterial({
        color: 0xff6b35, // Orange
        emissive: 0xff6b35,
        emissiveIntensity: 0.6,
      });

      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(row.location_x || 0, row.location_y || 0, row.location_z || 0);
      marker.userData = {
        rfiId: row.rfi_id,
        elementId: row.ifc_element_id,
        rfiData: row,
      };

      this.scene.add(marker);

      // Add pulse animation
      this.addPulseAnimation(marker);

      layer.elements.set(row.ifc_element_id, {
        elementId: row.ifc_element_id,
        data: row,
        marker,
      });
    }

    console.log(`RFI overlay loaded: ${data.length} markers`);
  }

  private async loadSafetyOverlay(): Promise<void> {
    const { data, error } = await supabase
      .from('bim_safety_zones')
      .select('*')
      .eq('project_id', this.projectId)
      .eq('active', true);

    if (error || !data) {
      console.error('Failed to load safety data:', error);
      return;
    }

    const layer = this.layers.get('safety')!;

    for (const zone of data) {
      const bounds = zone.zone_bounds;

      // Create bounding box visualization
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      const depth = bounds.maxZ - bounds.minZ;

      const geometry = new THREE.BoxGeometry(width, height, depth);

      // Color based on severity
      const severityColors: Record<string, number> = {
        low: 0xffeb3b,
        medium: 0xff9800,
        high: 0xff5722,
        critical: 0xd32f2f,
      };

      const color = severityColors[zone.severity] || 0xff5722;

      const material = new THREE.MeshPhongMaterial({
        color,
        opacity: 0.3,
        transparent: true,
        wireframe: false,
      });

      const hazardMesh = new THREE.Mesh(geometry, material);
      hazardMesh.position.set(
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2,
        (bounds.minZ + bounds.maxZ) / 2
      );
      hazardMesh.userData = { hazardData: zone };

      this.scene.add(hazardMesh);

      // Add pulse for critical zones
      if (zone.severity === 'critical') {
        this.addPulseAnimation(hazardMesh);
      }

      layer.elements.set(zone.id, {
        elementId: 0,
        data: zone,
        mesh: hazardMesh,
      });
    }

    console.log(`Safety overlay loaded: ${data.length} zones`);
  }

  private async loadScheduleOverlay(): Promise<void> {
    const { data, error } = await supabase
      .from('bim_4d_sequence')
      .select('*')
      .eq('project_id', this.projectId)
      .order('sequence_order', { ascending: true });

    if (error || !data) {
      console.error('Failed to load schedule data:', error);
      return;
    }

    // For 4D visualization, we'll color by sequence
    const colors = [
      0x3b82f6, // Blue
      0x10b981, // Green
      0xf59e0b, // Amber
      0xef4444, // Red
      0x8b5cf6, // Purple
    ];

    const layer = this.layers.get('schedule')!;

    for (let i = 0; i < data.length; i++) {
      const sequence = data[i];
      const color = colors[i % colors.length];

      for (const elementId of sequence.ifc_element_ids || []) {
        // Find mesh and apply schedule color
        this.scene.traverse((node) => {
          if (
            node instanceof THREE.Mesh &&
            (node as any).userData.ifc_element_id === elementId
          ) {
            const material = new THREE.MeshPhongMaterial({
              color,
              opacity: 0.6,
              transparent: true,
              emissive: color,
              emissiveIntensity: 0.2,
            });

            const scheduleOverlay = new THREE.Mesh(
              (node.geometry as THREE.BufferGeometry).clone(),
              material
            );
            scheduleOverlay.position.copy(node.position);
            scheduleOverlay.scale.multiplyScalar(1.002);

            this.scene.add(scheduleOverlay);

            layer.elements.set(elementId, {
              elementId,
              data: { ...sequence, sequenceIndex: i },
              mesh: scheduleOverlay,
            });
          }
        });
      }
    }

    console.log(`Schedule overlay loaded: ${data.length} sequences`);
  }

  private async loadCrewOverlay(): Promise<void> {
    const { data, error } = await supabase
      .from('crew_gps_locations')
      .select('*, crew:crews(*)')
      .eq('project_id', this.projectId);

    if (error || !data) {
      console.error('Failed to load crew data:', error);
      return;
    }

    const layer = this.layers.get('crew')!;

    for (const location of data) {
      // Create crew marker
      const markerGeometry = new THREE.ConeGeometry(1.5, 3, 8);
      const markerMaterial = new THREE.MeshPhongMaterial({
        color: 0x4ec896, // Teal
        emissive: 0x4ec896,
        emissiveIntensity: 0.4,
      });

      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      // In real scenario, convert GPS to scene coords
      marker.position.set(location.latitude || 0, location.altitude || 0, location.longitude || 0);
      marker.userData = {
        crewId: location.crew_id,
        crewData: location.crew,
      };

      this.scene.add(marker);

      layer.elements.set(location.crew_id, {
        elementId: 0,
        data: location,
        marker,
      });
    }

    console.log(`Crew overlay loaded: ${data.length} crew members`);
  }

  private subscribeToLayerUpdates(type: OverlayType): () => void {
    // Subscribe to real-time updates
    if (type === 'progress') {
      const subscription = supabase
        .channel(`bim-progress-${this.projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bim_element_progress',
            filter: `project_id=eq.${this.projectId}`,
          },
          (payload) => {
            this.updateProgressElement(payload.new);
          }
        )
        .subscribe();

      return () => subscription.unsubscribe();
    }

    return () => {};
  }

  private updateProgressElement(data: any): void {
    const layer = this.layers.get('progress')!;
    const element = layer.elements.get(data.ifc_element_id);

    if (!element || !element.mesh) {
      return;
    }

    const completion = data.completion_percent / 100;
    const color = this.colorGradient(completion);

    const material = element.mesh.material as THREE.MeshPhongMaterial;
    material.color.setHex(color.num());
    material.emissive.setHex(color.num());
  }

  private addPulseAnimation(mesh: THREE.Mesh): void {
    const originalScale = mesh.scale.clone();
    let time = 0;

    const animate = () => {
      time += 0.016;
      const scale = 1 + Math.sin(time * 3) * 0.1;
      mesh.scale.copy(originalScale).multiplyScalar(scale);

      if (this.layers.get(mesh.userData.type || 'rfi')?.enabled) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  private clearLayerVisualization(type: OverlayType): void {
    const layer = this.layers.get(type);
    if (!layer) return;

    layer.elements.forEach((element) => {
      if (element.mesh) {
        this.scene.remove(element.mesh);
      }
      if (element.marker) {
        this.scene.remove(element.marker);
      }
    });

    layer.elements.clear();
  }

  private updateLayerOpacity(type: OverlayType): void {
    const layer = this.layers.get(type);
    if (!layer) return;

    layer.elements.forEach((element) => {
      if (element.mesh && element.mesh.material) {
        (element.mesh.material as any).opacity = layer.opacity;
      }
    });
  }

  getLayer(type: OverlayType): OverlayLayer | undefined {
    return this.layers.get(type);
  }

  getAllLayers(): Map<OverlayType, OverlayLayer> {
    return this.layers;
  }

  destroy(): void {
    this.layers.forEach((layer) => {
      if (layer.unsubscribe) {
        layer.unsubscribe();
      }
      this.clearLayerVisualization(layer.type);
    });
    this.layers.clear();
  }
}
```

### Step 2: Overlay Control Panel Component

**File**: `src/components/BIMViewer/OverlayPanel.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { OverlayManager, OverlayType } from './OverlayManager';

interface OverlayPanelProps {
  overlayManager: OverlayManager;
}

export const OverlayPanel: React.FC<OverlayPanelProps> = ({ overlayManager }) => {
  const [layers, setLayers] = useState(
    Array.from(overlayManager.getAllLayers().entries())
  );

  const handleToggleLayer = async (type: OverlayType) => {
    const layer = overlayManager.getLayer(type);
    if (layer) {
      await overlayManager.toggleLayer(type, !layer.enabled);
      setLayers(Array.from(overlayManager.getAllLayers().entries()));
    }
  };

  const handleOpacityChange = (type: OverlayType, opacity: number) => {
    overlayManager.setLayerOpacity(type, opacity);
  };

  const layerLabels: Record<OverlayType, string> = {
    progress: 'Progress (0.100%)',
    rfi: 'RFIs & Requests',
    safety: 'Safety Zones',
    schedule: '4D Schedule',
    crew: 'Crew Locations',
  };

  const layerDescriptions: Record<OverlayType, string> = {
    progress: 'Color elements by completion percentage',
    rfi: 'Pin RFI markers on model elements',
    safety: 'Highlight hazard zones',
    schedule: 'Animate construction sequence',
    crew: 'Show crew GPS locations',
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        width: '280px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 5,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #eee',
          background: '#f7f8fa',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
          Data Overlays
        </h3>
      </div>

      {/* Layers */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {layers.map(([type, layer]) => (
          <div
            key={type}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #eee',
            }}
          >
            {/* Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <input
                type="checkbox"
                checked={layer.enabled}
                onChange={() => handleToggleLayer(type)}
                style={{ marginRight: '8px', cursor: 'pointer' }}
              />
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                {layerLabels[type]}
              </label>
            </div>

            {/* Description */}
            <p
              style={{
                fontSize: '11px',
                color: '#999',
                margin: '0 0 8px 0',
                marginLeft: '24px',
              }}
            >
              {layerDescriptions[type]}
            </p>

            {/* Opacity slider */}
            {layer.enabled && (
              <div style={{ marginLeft: '24px' }}>
                <label
                  style={{
                    fontSize: '11px',
                    color: '#666',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Opacity: {Math.round(layer.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(layer.opacity * 100)}
                  onChange={(e) =>
                    handleOpacityChange(type, Number(e.target.value) / 100)
                  }
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Step 3: Integration into BIMViewer

**File**: `src/components/BIMViewer/BIMViewer.tsx` (Updated Section)

```typescript
// Add to imports
import { OverlayManager } from './OverlayManager';
import { OverlayPanel } from './OverlayPanel';

// Add to BIMViewer component state
const [overlayManager, setOverlayManager] = useState<OverlayManager | null>(null);
const [showOverlayPanel, setShowOverlayPanel] = useState(true);

// Add to BIMScene initialization (inside Canvas component)
useEffect(() => {
  if (sceneRef.current && model) {
    const manager = new OverlayManager(sceneRef.current, projectId);
    setOverlayManager(manager);

    return () => {
      manager.destroy();
    };
  }
}, [model, projectId]);

// Add to render (after BIMScene)
{overlayManager && showOverlayPanel && (
  <OverlayPanel overlayManager={overlayManager} />
)}

// Add to toolbar
<ToolbarButton
  label="Overlays"
  onClick={() => setShowOverlayPanel(!showOverlayPanel)}
  active={showOverlayPanel}
/>
```

### Step 4: Progress Update API Handler

**File**: `src/api/bim.ts` (New)

```typescript
import { supabase } from '@/lib/supabase';

export interface ElementProgressInput {
  projectId: string;
  elementId: number;
  globalId?: string;
  elementName: string;
  completionPercent: number;
  notes?: string;
}

export async function updateElementProgress(
  data: ElementProgressInput
): Promise<void> {
  const { error } = await supabase.from('bim_element_progress').upsert(
    {
      project_id: data.projectId,
      ifc_element_id: data.elementId,
      global_id: data.globalId,
      element_name: data.elementName,
      completion_percent: Math.min(100, Math.max(0, data.completionPercent)),
      notes: data.notes,
      updated_by: (await supabase.auth.getUser()).data.user?.id,
    },
    {
      onConflict: 'project_id,ifc_element_id',
    }
  );

  if (error) {
    throw new Error(`Failed to update element progress: ${error.message}`);
  }
}

export async function getElementProgress(
  projectId: string,
  elementId: number
): Promise<any> {
  const { data, error } = await supabase
    .from('bim_element_progress')
    .select('*')
    .eq('project_id', projectId)
    .eq('ifc_element_id', elementId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function addRFIToElement(
  rfiId: string,
  projectId: string,
  elementId: number,
  location: { x: number; y: number; z: number }
): Promise<void> {
  const { error } = await supabase.from('bim_rfi_elements').insert({
    rfi_id: rfiId,
    project_id: projectId,
    ifc_element_id: elementId,
    location_x: location.x,
    location_y: location.y,
    location_z: location.z,
  });

  if (error) {
    throw new Error(`Failed to associate RFI: ${error.message}`);
  }
}

export async function createSafetyZone(
  projectId: string,
  hazardType: string,
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  severity: 'low' | 'medium' | 'high' | 'critical',
  description: string
): Promise<void> {
  const { error } = await supabase.from('bim_safety_zones').insert({
    project_id: projectId,
    hazard_type: hazardType,
    zone_bounds: bounds,
    severity,
    description,
  });

  if (error) {
    throw new Error(`Failed to create safety zone: ${error.message}`);
  }
}
```

---

## Acceptance Criteria

- [ ] Progress overlay colors elements red (0%), yellow (50%), green (100%)
- [ ] RFI overlay shows orange marker spheres with pulsing animation
- [ ] Safety zones display colored bounding boxes (critical zones pulse)
- [ ] Schedule/4D overlay colors elements by sequence order
- [ ] Crew overlay shows teal cone markers at GPS locations
- [ ] Each layer can be toggled on/off independently
- [ ] Opacity slider works for each enabled layer
- [ ] Real-time updates via Supabase subscriptions (progress changes appear instantly)
- [ ] All overlays respect the selection highlight (orange) for priority
- [ ] No performance degradation with multiple overlays enabled (60 FPS maintained)

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Layer loading | <1s per layer |
| Overlay render time | <16ms (60 FPS) |
| Real-time update delay | <500ms |
| Memory per overlay | <50MB |

---

## Future Enhancements

1. Heatmaps for crew density
2. Time-based animation (play/pause/scrub schedule)
3. Element-level RFI counts displayed on model
4. Historical progress comparison (before/after dates)
5. Custom color schemes per layer
6. Export overlay views as images
