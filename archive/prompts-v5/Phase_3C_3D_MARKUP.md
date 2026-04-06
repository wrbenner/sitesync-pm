# Phase 3C: 3D Markup and Measurement Tools

**Status**: Phase 3 (Digital Twin + Spatial)
**Priority**: High
**Effort**: 10 days
**Target**: Day 59-68

---

## Pre-Requisites

### Dependent Files
- Phase_3A_BIM_VIEWER.md (BIM model + Three.js scene)
- Phase_3B_DATA_OVERLAYS.md (overlay system)

### New Dependencies
- three/examples for PointerLockControls
- gl-matrix for vector calculations

### Database Tables

```sql
CREATE TABLE bim_markups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  markup_type VARCHAR(50), -- 'annotation', 'measurement', 'clash', 'note'
  title VARCHAR(255),
  description TEXT,
  annotation_text TEXT,
  start_position JSONB, -- {x, y, z}
  end_position JSONB, -- for measurements
  measurement_value FLOAT,
  measurement_unit VARCHAR(10), -- 'mm', 'cm', 'm', 'ft', etc
  area_value FLOAT,
  area_unit VARCHAR(20), -- 'sqm', 'sqft'
  volume_value FLOAT,
  volume_unit VARCHAR(20), -- 'cum', 'cuft'
  markup_data JSONB, -- {arrows, labels, clipping_planes, etc}
  image_url TEXT, -- snapshot of markup view
  element_ids INT[], -- associated IFC elements
  shared_with UUID[], -- user IDs
  visibility_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE bim_clash_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title VARCHAR(255),
  description TEXT,
  severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
  status VARCHAR(20), -- 'new', 'reviewing', 'resolved', 'deferred'
  element_a_id INT NOT NULL,
  element_b_id INT NOT NULL,
  clash_location JSONB, -- {x, y, z}
  clash_volume_cm3 FLOAT,
  resolution TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  markup_id UUID REFERENCES bim_markups(id)
);

CREATE INDEX idx_markups_project ON bim_markups(project_id);
CREATE INDEX idx_markups_user ON bim_markups(user_id);
CREATE INDEX idx_clash_project ON bim_clash_reports(project_id);
CREATE INDEX idx_clash_status ON bim_clash_reports(status);
```

---

## Implementation Steps

### Step 1: Markup Tool Manager

**File**: `src/components/BIMViewer/MarkupManager.ts`

```typescript
import * as THREE from 'three';
import { vec3 } from 'gl-matrix';
import { supabase } from '@/lib/supabase';

export type MarkupType = 'annotation' | 'measurement' | 'clash' | 'note';
export type ToolMode = 'idle' | 'annotation' | 'measure' | 'area' | 'volume' | 'select';

export interface Markup {
  id: string;
  type: MarkupType;
  title: string;
  description?: string;
  startPos: THREE.Vector3;
  endPos?: THREE.Vector3;
  additionalPoints?: THREE.Vector3[];
  text?: string;
  color: string;
  visible: boolean;
  objects: THREE.Object3D[];
}

export interface MeasurementResult {
  type: 'distance' | 'area' | 'volume';
  value: number;
  unit: string;
  points: THREE.Vector3[];
}

export class MarkupManager {
  private scene: THREE.Group;
  private camera: THREE.Camera;
  private raycaster: THREE.Raycaster;
  private currentMode: ToolMode = 'idle';
  private markups: Map<string, Markup> = new Map();
  private selectedPoints: THREE.Vector3[] = [];
  private projectId: string;
  private userId: string;
  private annotationGroup: THREE.Group;
  private pointGroup: THREE.Group;

  constructor(
    scene: THREE.Group,
    camera: THREE.Camera,
    projectId: string,
    userId: string
  ) {
    this.scene = scene;
    this.camera = camera;
    this.projectId = projectId;
    this.userId = userId;
    this.raycaster = new THREE.Raycaster();

    // Create container groups
    this.annotationGroup = new THREE.Group();
    this.annotationGroup.name = 'Markups';
    this.scene.add(this.annotationGroup);

    this.pointGroup = new THREE.Group();
    this.pointGroup.name = 'MeasurementPoints';
    this.scene.add(this.pointGroup);
  }

  setToolMode(mode: ToolMode): void {
    this.currentMode = mode;
    if (mode === 'idle') {
      this.clearSelectionPoints();
    }
  }

  getCurrentMode(): ToolMode {
    return this.currentMode;
  }

  onMouseClick(
    clientX: number,
    clientY: number,
    viewport: { width: number; height: number }
  ): void {
    if (this.currentMode === 'idle') return;

    // Cast ray and get intersection point
    const normalizedMouse = new THREE.Vector2(
      (clientX / viewport.width) * 2 - 1,
      -(clientY / viewport.height) * 2 + 1
    );

    this.raycaster.setFromCamera(normalizedMouse, this.camera);

    // Get all intersections with scene geometry
    const intersections = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    if (intersections.length === 0) return;

    const point = intersections[0].point;

    switch (this.currentMode) {
      case 'annotation':
        this.createAnnotation(point);
        this.setToolMode('idle');
        break;

      case 'measure':
        this.addMeasurementPoint(point);
        if (this.selectedPoints.length === 2) {
          this.completeMeasurement('distance');
          this.setToolMode('idle');
        }
        break;

      case 'area':
        this.addMeasurementPoint(point);
        if (this.selectedPoints.length >= 3) {
          // Can complete area
          console.log('Click again to finalize area, or add more points');
        }
        break;

      case 'volume':
        this.addMeasurementPoint(point);
        if (this.selectedPoints.length === 8) {
          // Bounding box requires 8 corners (or fewer for simplified box)
          this.completeMeasurement('volume');
          this.setToolMode('idle');
        }
        break;
    }
  }

  private createAnnotation(position: THREE.Vector3): void {
    const markup = this.createAnnotationMarker(position);
    this.markups.set(markup.id, markup);
  }

  private createAnnotationMarker(position: THREE.Vector3): Markup {
    const id = Math.random().toString(36).substring(7);
    const color = '#f47820'; // Orange

    // Create marker sphere
    const markerGeometry = new THREE.SphereGeometry(1, 16, 16);
    const markerMaterial = new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
    });
    const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
    markerMesh.position.copy(position);

    // Create sprite for label
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(5, 5, 1);

    this.annotationGroup.add(markerMesh);
    this.annotationGroup.add(sprite);

    return {
      id,
      type: 'annotation',
      title: `Annotation ${id}`,
      startPos: position.clone(),
      color,
      visible: true,
      objects: [markerMesh, sprite],
    };
  }

  private addMeasurementPoint(position: THREE.Vector3): void {
    this.selectedPoints.push(position.clone());

    // Visualize point
    const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0x4ec896, // Teal
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.copy(position);
    this.pointGroup.add(sphere);

    // Draw lines between points
    if (this.selectedPoints.length > 1) {
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setFromPoints(this.selectedPoints);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x4ec896,
        linewidth: 2,
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      this.pointGroup.add(line);
    }
  }

  private completeMeasurement(type: 'distance' | 'area' | 'volume'): void {
    if (this.selectedPoints.length < 2) return;

    let result: MeasurementResult | null = null;

    switch (type) {
      case 'distance':
        if (this.selectedPoints.length === 2) {
          const dist = this.selectedPoints[0].distanceTo(this.selectedPoints[1]);
          result = {
            type: 'distance',
            value: dist,
            unit: 'm',
            points: this.selectedPoints,
          };
        }
        break;

      case 'area':
        if (this.selectedPoints.length >= 3) {
          const area = this.calculatePolygonArea(this.selectedPoints);
          result = {
            type: 'area',
            value: area,
            unit: 'sqm',
            points: this.selectedPoints,
          };
        }
        break;

      case 'volume':
        if (this.selectedPoints.length >= 4) {
          const volume = this.calculateBoundingBoxVolume(this.selectedPoints);
          result = {
            type: 'volume',
            value: volume,
            unit: 'cum',
            points: this.selectedPoints,
          };
        }
        break;
    }

    if (result) {
      this.createMeasurementMarkup(result);
      this.clearSelectionPoints();
    }
  }

  private createMeasurementMarkup(result: MeasurementResult): Markup {
    const id = Math.random().toString(36).substring(7);
    const color = '#4ec896';

    const valueText = `${result.value.toFixed(2)} ${result.unit}`;
    const markup: Markup = {
      id,
      type: 'measurement',
      title: `${result.type.charAt(0).toUpperCase() + result.type.slice(1)}: ${valueText}`,
      startPos: result.points[0],
      endPos: result.points[result.points.length - 1],
      additionalPoints: result.points.slice(1, -1),
      text: valueText,
      color,
      visible: true,
      objects: this.pointGroup.children.slice(),
    };

    this.markups.set(markup.id, markup);

    // Add label in 3D space
    this.addMeasurementLabel(
      result.points[0].clone().add(result.points[result.points.length - 1]).multiplyScalar(0.5),
      valueText
    );

    return markup;
  }

  private addMeasurementLabel(position: THREE.Vector3, text: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#4ec896';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(20, 5, 1);

    this.annotationGroup.add(sprite);
  }

  private calculatePolygonArea(points: THREE.Vector3[]): number {
    // Simplified: assume points lie in a plane, calculate area using cross products
    if (points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const p0 = points[i];
      const p1 = points[(i + 1) % points.length];
      const cross = new THREE.Vector3().crossVectors(p0, p1);
      area += cross.length() / 2;
    }

    return area;
  }

  private calculateBoundingBoxVolume(points: THREE.Vector3[]): number {
    if (points.length === 0) return 0;

    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    points.forEach((p) => {
      min.min(p);
      max.max(p);
    });

    const width = max.x - min.x;
    const height = max.y - min.y;
    const depth = max.z - min.z;

    return width * height * depth;
  }

  private clearSelectionPoints(): void {
    this.selectedPoints = [];
    this.pointGroup.clear();
  }

  async saveMarkup(markupId: string): Promise<void> {
    const markup = this.markups.get(markupId);
    if (!markup) return;

    // Take screenshot of current view
    const imageUrl = await this.captureViewport();

    const { error } = await supabase.from('bim_markups').upsert({
      id: markup.id,
      project_id: this.projectId,
      user_id: this.userId,
      markup_type: markup.type,
      title: markup.title,
      description: markup.text || '',
      annotation_text: markup.text,
      start_position: {
        x: markup.startPos.x,
        y: markup.startPos.y,
        z: markup.startPos.z,
      },
      end_position: markup.endPos
        ? {
            x: markup.endPos.x,
            y: markup.endPos.y,
            z: markup.endPos.z,
          }
        : null,
      image_url: imageUrl,
      markup_data: {
        color: markup.color,
        text: markup.text,
      },
    });

    if (error) {
      console.error('Failed to save markup:', error);
    }
  }

  private async captureViewport(): Promise<string> {
    // Render scene to canvas and convert to base64
    // This is a simplified version; production would use offscreen canvas
    const canvas = document.querySelector('canvas');
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  }

  async loadMarkups(): Promise<void> {
    const { data, error } = await supabase
      .from('bim_markups')
      .select('*')
      .eq('project_id', this.projectId);

    if (error || !data) {
      console.error('Failed to load markups:', error);
      return;
    }

    for (const row of data) {
      const position = new THREE.Vector3(
        row.start_position.x,
        row.start_position.y,
        row.start_position.z
      );

      const markup =
        row.markup_type === 'annotation'
          ? this.createAnnotationMarker(position)
          : {
              id: row.id,
              type: row.markup_type as MarkupType,
              title: row.title,
              description: row.description,
              startPos: position,
              endPos: row.end_position
                ? new THREE.Vector3(
                    row.end_position.x,
                    row.end_position.y,
                    row.end_position.z
                  )
                : undefined,
              text: row.annotation_text,
              color: row.markup_data?.color || '#4ec896',
              visible: true,
              objects: [],
            };

      this.markups.set(markup.id, markup);
    }

    console.log(`Loaded ${data.length} markups`);
  }

  deleteMarkup(markupId: string): void {
    const markup = this.markups.get(markupId);
    if (!markup) return;

    markup.objects.forEach((obj) => {
      if (obj.parent) {
        obj.parent.remove(obj);
      }
    });

    this.markups.delete(markupId);
  }

  getMarkups(): Markup[] {
    return Array.from(this.markups.values());
  }

  destroy(): void {
    this.scene.remove(this.annotationGroup);
    this.scene.remove(this.pointGroup);
    this.markups.clear();
  }
}
```

### Step 2: Markup Toolbar Component

**File**: `src/components/BIMViewer/MarkupToolbar.tsx`

```typescript
import React, { useState } from 'react';
import { MarkupManager, ToolMode } from './MarkupManager';

interface MarkupToolbarProps {
  markupManager: MarkupManager;
  onModeChange: (mode: ToolMode) => void;
}

export const MarkupToolbar: React.FC<MarkupToolbarProps> = ({
  markupManager,
  onModeChange,
}) => {
  const [currentMode, setCurrentMode] = useState<ToolMode>('idle');
  const [showMeasurementPanel, setShowMeasurementPanel] = useState(false);

  const handleToolClick = (mode: ToolMode) => {
    const newMode = currentMode === mode ? 'idle' : mode;
    setCurrentMode(newMode);
    markupManager.setToolMode(newMode);
    onModeChange(newMode);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '50px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '12px 8px',
        display: 'flex',
        gap: '4px',
        zIndex: 5,
      }}
    >
      <ToolButton
        label="Annotate"
        icon="📌"
        active={currentMode === 'annotation'}
        onClick={() => handleToolClick('annotation')}
        title="Click to place annotation marker"
      />

      <ToolButton
        label="Distance"
        icon="📏"
        active={currentMode === 'measure'}
        onClick={() => handleToolClick('measure')}
        title="Click two points to measure distance"
      />

      <ToolButton
        label="Area"
        icon="▭"
        active={currentMode === 'area'}
        onClick={() => handleToolClick('area')}
        title="Click three or more points to measure area"
      />

      <ToolButton
        label="Volume"
        icon="▦"
        active={currentMode === 'volume'}
        onClick={() => handleToolClick('volume')}
        title="Click points to define bounding box"
      />

      <div style={{ width: '1px', background: '#ddd', margin: '4px' }} />

      <ToolButton
        label="Markups"
        icon="📋"
        active={showMeasurementPanel}
        onClick={() => setShowMeasurementPanel(!showMeasurementPanel)}
        title="View all markups"
      />

      {currentMode !== 'idle' && (
        <div
          style={{
            padding: '6px 12px',
            background: '#f0f0f0',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500',
            color: '#666',
            marginLeft: '8px',
          }}
        >
          {currentMode === 'annotation' && 'Click to place annotation'}
          {currentMode === 'measure' && 'Click two points'}
          {currentMode === 'area' && 'Click three or more points'}
          {currentMode === 'volume' && 'Click to define box'}
        </div>
      )}
    </div>
  );
};

interface ToolButtonProps {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  title?: string;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  label,
  icon,
  active,
  onClick,
  title,
}) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      padding: '8px 10px',
      background: active ? '#f47820' : '#fff',
      color: active ? '#fff' : '#333',
      border: '1px solid #ddd',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      transition: 'all 0.2s',
    }}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);
```

### Step 3: Clash Detection

**File**: `src/services/bim/ClashDetection.ts`

```typescript
import * as THREE from 'three';
import { supabase } from '@/lib/supabase';

export interface ClashResult {
  elementAId: number;
  elementBId: number;
  clashLocation: THREE.Vector3;
  clashVolumeCm3: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ClashDetector {
  detectClashes(meshes: THREE.Mesh[]): ClashResult[] {
    const clashes: ClashResult[] = [];

    // For each pair of meshes, check for intersection
    for (let i = 0; i < meshes.length; i++) {
      for (let j = i + 1; j < meshes.length; j++) {
        const clash = this.checkMeshIntersection(meshes[i], meshes[j]);
        if (clash) {
          clashes.push(clash);
        }
      }
    }

    return clashes;
  }

  private checkMeshIntersection(mesh1: THREE.Mesh, mesh2: THREE.Mesh): ClashResult | null {
    const box1 = new THREE.Box3().setFromObject(mesh1);
    const box2 = new THREE.Box3().setFromObject(mesh2);

    if (!box1.intersectsBox(box2)) {
      return null;
    }

    // Calculate intersection volume (simplified bounding box overlap)
    const intersection = new THREE.Box3();
    intersection.copy(box1);
    intersection.intersect(box2);

    const size = new THREE.Vector3();
    intersection.getSize(size);

    const volumeCm3 = size.x * size.y * size.z * 1000000; // m3 to cm3

    return {
      elementAId: (mesh1.userData as any).ifc_element_id || 0,
      elementBId: (mesh2.userData as any).ifc_element_id || 0,
      clashLocation: intersection.getCenter(new THREE.Vector3()),
      clashVolumeCm3: volumeCm3,
      severity: volumeCm3 > 10000 ? 'critical' : volumeCm3 > 1000 ? 'high' : 'medium',
    };
  }

  async saveClashReport(
    projectId: string,
    userId: string,
    clash: ClashResult,
    title: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('bim_clash_reports')
      .insert({
        project_id: projectId,
        created_by: userId,
        title,
        element_a_id: clash.elementAId,
        element_b_id: clash.elementBId,
        clash_location: {
          x: clash.clashLocation.x,
          y: clash.clashLocation.y,
          z: clash.clashLocation.z,
        },
        clash_volume_cm3: clash.clashVolumeCm3,
        severity: clash.severity,
      })
      .select('id');

    if (error) {
      throw new Error(`Failed to save clash report: ${error.message}`);
    }

    return data?.[0]?.id || '';
  }
}
```

---

## Acceptance Criteria

- [ ] Click to place annotation markers (orange spheres with labels)
- [ ] Measure distance: click two points, shows distance with line
- [ ] Measure area: click 3+ points, calculates and displays polygon area
- [ ] Measure volume: click 8 corner points, calculates bounding box volume
- [ ] All measurements display values in 3D space with unit labels
- [ ] Markups save to Supabase with snapshot images
- [ ] Load previously saved markups from database
- [ ] Clash detection automatically identifies overlapping elements
- [ ] Clash reports save with location, volume, and severity
- [ ] Delete markup removes visualization and database record
- [ ] Measurement points visualize in teal, annotations in orange

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Markup creation | <100ms |
| Clash detection (1000 meshes) | <2s |
| Measurement calculation | <50ms |
- [ ] Toggle toolbar and clear points without lag

---

## Future Enhancements

1. Polygon-based clash volumes (not just AABB)
2. Measurement history and comparison
3. Markup filtering by type/user/date
4. Bulk export of all markups as PDF report
5. Markup versioning and revision tracking
6. Team commenting on specific markups
