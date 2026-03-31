# Phase 3A: WebGPU BIM Viewer with IFC Loading

**Status**: Phase 3 (Digital Twin + Spatial)
**Priority**: Critical
**Effort**: 16 days
**Target**: Day 31-46

---

## Pre-Requisites

### Dependencies
- Three.js 0.160+ (already in package.json)
- @react-three/fiber 8.15+ for React+Three integration
- @react-three/drei 9.88+ for controls and utilities
- web-ifc 0.0.56+ (pure JS IFC parser as fallback)
- @types/three 0.160+
- Supabase client 2.38+ (for model caching)

### Browser Support
- Chrome 113+ (WebGPU baseline)
- Edge 113+
- Safari 17.4+ (WebGPU support added)
- Firefox 121+ (WebGPU experimental, enable via about:config)
- Fallback to WebGL2 for unsupported browsers

### Environment Setup
```bash
npm install three @react-three/fiber @react-three/drei web-ifc
npm install --save-dev @types/three
```

### File Structure
```
src/
  components/
    BIMViewer/
      BIMViewer.tsx              # Main component (enhance existing)
      BIMScene.tsx               # Three.js scene wrapper
      IFCLoader.ts               # IFC file loading logic
      WebGPURenderer.ts          # WebGPU detection and renderer setup
      SelectionHandler.ts        # Element selection and highlighting
      SectionPlane.tsx           # Section plane tool
      PropertyPanel.tsx          # Element properties sidebar
      PerformanceMonitor.tsx     # FPS counter and stats
      types.ts                   # TypeScript interfaces
  services/
    ifc/
      IFCCache.ts                # Supabase-backed model cache
      IFCProgressiveLoader.ts     # Progressive loading strategy
      ElementClassifier.ts        # Categorize IFC elements
```

---

## Implementation Steps

### Step 1: WebGPU Renderer Setup with Fallback

**File**: `src/components/BIMViewer/WebGPURenderer.ts`

```typescript
import * as THREE from 'three';

export interface WebGPUCapabilities {
  supported: boolean;
  renderer: THREE.WebGLRenderer | THREE.WebGPURenderer | null;
  fallbackReason?: string;
}

export async function detectWebGPU(): Promise<WebGPUCapabilities> {
  // WebGPU detection (experimental API)
  if (!navigator.gpu) {
    console.log('WebGPU not supported, falling back to WebGL2');
    return {
      supported: false,
      renderer: null,
      fallbackReason: 'WebGPU not available in browser',
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No GPU adapter available');
    }

    const device = await adapter.requestDevice();
    console.log('WebGPU enabled:', device.label);

    // Once Three.js WebGPU renderer is stable, instantiate here
    // For now, use WebGL2 as high-performance fallback
    return {
      supported: true,
      renderer: null,
      fallbackReason: 'Three.js WebGPU renderer not yet in stable release',
    };
  } catch (error) {
    console.warn('WebGPU initialization failed:', error);
    return {
      supported: false,
      renderer: null,
      fallbackReason: String(error),
    };
  }
}

export function createOptimalRenderer(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    precision: 'highp',
    powerPreference: 'high-performance',
  });

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf7f8fa, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowShadowMap;

  // Enable WebGL2 extensions for better performance
  const ext = renderer.getContext().getExtension('EXT_color_buffer_float');
  if (!ext) {
    console.warn('EXT_color_buffer_float not supported');
  }

  return renderer;
}
```

### Step 2: IFC File Loader with Progressive Loading

**File**: `src/services/ifc/IFCProgressiveLoader.ts`

```typescript
import { IFCLoader } from 'web-ifc-three';
import * as THREE from 'three';

export interface IFCLoadProgress {
  phase: 'parsing' | 'geometry' | 'materials' | 'complete';
  progress: number; // 0-100
  trianglesLoaded: number;
  totalTriangles?: number;
  currentElementType?: string;
}

export interface IFCModel {
  scene: THREE.Group;
  metadata: IFCMetadata;
  elementMap: Map<number, IFCElement>;
}

export interface IFCMetadata {
  projectName: string;
  fileName: string;
  siteAddress?: string;
  description?: string;
  totalElements: number;
  schema: 'IFC2x3' | 'IFC4' | 'IFC4.3';
}

export interface IFCElement {
  expressId: number;
  globalId?: string;
  name: string;
  type: string;
  category: string;
  properties: Record<string, any>;
  mesh?: THREE.Mesh;
  color?: THREE.Color;
}

export class ProgressiveIFCLoader {
  private ifcLoader: IFCLoader;
  private onProgress: (update: IFCLoadProgress) => void;
  private parseWorker?: Worker;

  constructor(onProgress: (update: IFCLoadProgress) => void) {
    this.ifcLoader = new IFCLoader();
    this.onProgress = onProgress;

    // Initialize web-ifc WASM
    this.initializeWASM();
  }

  private async initializeWASM() {
    try {
      const result = await this.ifcLoader.ifcManager.setWasmPath(
        '/wasm/',
        true
      );
      console.log('IFC WASM initialized:', result);
    } catch (error) {
      console.error('Failed to initialize IFC WASM:', error);
    }
  }

  async loadIFC(
    file: File | ArrayBuffer,
    onProgress?: (event: ProgressEvent) => void
  ): Promise<IFCModel> {
    const startTime = performance.now();

    // Phase 1: Parse IFC structure
    this.onProgress({
      phase: 'parsing',
      progress: 10,
      trianglesLoaded: 0,
    });

    let ifcData: any;
    if (file instanceof File) {
      ifcData = await file.arrayBuffer();
    } else {
      ifcData = file;
    }

    // Phase 2: Load geometry (this is the expensive operation)
    this.onProgress({
      phase: 'geometry',
      progress: 30,
      trianglesLoaded: 0,
      totalTriangles: 5000000, // Estimate for typical building
    });

    const model = await this.ifcLoader.parse(ifcData as ArrayBuffer);
    const scene = model.scene;

    // Extract metadata
    const metadata = this.extractMetadata(model);

    // Phase 3: Process materials and colors
    this.onProgress({
      phase: 'materials',
      progress: 70,
      trianglesLoaded: this.countTriangles(scene),
    });

    // Build element map and apply categorization
    const elementMap = await this.buildElementMap(model);

    // Phase 4: Complete
    const totalTriangles = this.countTriangles(scene);
    this.onProgress({
      phase: 'complete',
      progress: 100,
      trianglesLoaded: totalTriangles,
    });

    console.log(
      `IFC loaded in ${(performance.now() - startTime).toFixed(0)}ms with ${totalTriangles} triangles`
    );

    return {
      scene,
      metadata,
      elementMap,
    };
  }

  private async buildElementMap(model: any): Promise<Map<number, IFCElement>> {
    const elementMap = new Map<number, IFCElement>();
    const manager = this.ifcLoader.ifcManager;

    try {
      // Query all elements of main types
      const mainTypes = [
        'IFCWALL',
        'IFCSLAB',
        'IFCCOLUMN',
        'IFCBEAM',
        'IFCDOOR',
        'IFCWINDOW',
        'IFCROOF',
        'IFCSTAIR',
        'IFCPROPERTYSET',
      ];

      for (const type of mainTypes) {
        const elements = await manager.getAllItemsOfType(model.modelID, type);
        for (const expressId of elements) {
          const properties = await manager.getItemProperties(
            model.modelID,
            expressId
          );
          elementMap.set(expressId, {
            expressId,
            globalId: properties.GlobalId?.value,
            name: properties.Name?.value || `${type}_${expressId}`,
            type,
            category: this.categorizeElement(type),
            properties: this.flattenProperties(properties),
          });
        }
      }
    } catch (error) {
      console.warn('Error building element map:', error);
    }

    return elementMap;
  }

  private categorizeElement(ifcType: string): string {
    const categories: Record<string, string> = {
      IFCWALL: 'Structural',
      IFCSLAB: 'Structural',
      IFCCOLUMN: 'Structural',
      IFCBEAM: 'Structural',
      IFCDOOR: 'Openings',
      IFCWINDOW: 'Openings',
      IFCROOF: 'Structural',
      IFCSTAIR: 'Vertical Circulation',
      IFCRAMP: 'Vertical Circulation',
      IFCFURNITURE: 'Furniture',
      IFCEQUIPMENT: 'MEP',
    };
    return categories[ifcType] || 'Other';
  }

  private flattenProperties(props: any): Record<string, any> {
    const flattened: Record<string, any> = {};
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === 'object' && value !== null) {
        flattened[key] = (value as any).value || String(value);
      } else {
        flattened[key] = value;
      }
    }
    return flattened;
  }

  private extractMetadata(model: any): IFCMetadata {
    return {
      projectName: 'IFC Project',
      fileName: 'model.ifc',
      description: 'Loaded from IFC',
      totalElements: 0,
      schema: 'IFC4',
    };
  }

  private countTriangles(scene: THREE.Object3D): number {
    let count = 0;
    scene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const geometry = node.geometry;
        if (geometry.index) {
          count += geometry.index.count / 3;
        } else {
          count += geometry.attributes.position.count / 3;
        }
      }
    });
    return count;
  }
}
```

### Step 3: Enhanced BIM Viewer Component

**File**: `src/components/BIMViewer/BIMViewer.tsx`

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { BIMScene } from './BIMScene';
import { PropertyPanel } from './PropertyPanel';
import { SectionPlane } from './SectionPlane';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ProgressiveIFCLoader, IFCModel, IFCLoadProgress } from '@/services/ifc/IFCProgressiveLoader';
import { createOptimalRenderer } from './WebGPURenderer';

interface BIMViewerProps {
  ifcFile?: File;
  projectId: string;
  onElementSelected?: (elementId: number) => void;
}

export const BIMViewer: React.FC<BIMViewerProps> = ({
  ifcFile,
  projectId,
  onElementSelected,
}) => {
  const [model, setModel] = useState<IFCModel | null>(null);
  const [loadProgress, setLoadProgress] = useState<IFCLoadProgress>({
    phase: 'parsing',
    progress: 0,
    trianglesLoaded: 0,
  });
  const [selectedElementId, setSelectedElementId] = useState<number | null>(
    null
  );
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [showSectionPlane, setShowSectionPlane] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const sceneRef = useRef<THREE.Group>(null);
  const loaderRef = useRef<ProgressiveIFCLoader | null>(null);

  // Initialize IFC loader
  useEffect(() => {
    loaderRef.current = new ProgressiveIFCLoader((progress) => {
      setLoadProgress(progress);
    });
  }, []);

  // Handle file upload
  useEffect(() => {
    if (!ifcFile || !loaderRef.current) return;

    const loadModel = async () => {
      setIsLoading(true);
      try {
        const loadedModel = await loaderRef.current!.loadIFC(ifcFile);
        setModel(loadedModel);
      } catch (error) {
        console.error('Failed to load IFC:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, [ifcFile]);

  const handleElementSelection = (elementId: number) => {
    setSelectedElementId(elementId);
    setShowPropertyPanel(true);
    onElementSelected?.(elementId);
  };

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 22, 41, 0.8)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: 'system-ui',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            {loadProgress.phase === 'parsing' && 'Parsing IFC structure...'}
            {loadProgress.phase === 'geometry' && 'Loading geometry...'}
            {loadProgress.phase === 'materials' && 'Processing materials...'}
          </div>
          <div
            style={{
              width: '200px',
              height: '4px',
              background: '#333',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: '#F47820',
                width: `${loadProgress.progress}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.8 }}>
            {loadProgress.trianglesLoaded.toLocaleString()} triangles loaded
          </div>
        </div>
      )}

      {/* Three.js Canvas */}
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          precision: 'highp',
          powerPreference: 'high-performance',
        }}
        camera={{ position: [50, 50, 50], near: 0.1, far: 10000 }}
      >
        {model && (
          <>
            <BIMScene
              model={model}
              selectedElementId={selectedElementId}
              onElementSelect={handleElementSelection}
              ref={sceneRef}
            />
            <OrbitControls
              makeDefault
              autoRotate={false}
              enablePan={true}
              enableZoom={true}
            />
            <PerspectiveCamera makeDefault position={[50, 50, 50]} />
            <ambientLight intensity={0.6} />
            <directionalLight
              position={[100, 100, 100]}
              intensity={0.8}
              castShadow
            />
            {showSectionPlane && <SectionPlane scene={sceneRef.current!} />}
            <PerformanceMonitor />
          </>
        )}
      </Canvas>

      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          display: 'flex',
          gap: '8px',
          zIndex: 5,
        }}
      >
        <ToolbarButton
          label="Properties"
          onClick={() => setShowPropertyPanel(!showPropertyPanel)}
          active={showPropertyPanel}
        />
        <ToolbarButton
          label="Section"
          onClick={() => setShowSectionPlane(!showSectionPlane)}
          active={showSectionPlane}
        />
        <ToolbarButton label="Fit All" onClick={() => {}} />
      </div>

      {/* Property Panel */}
      {showPropertyPanel && selectedElementId !== null && model && (
        <PropertyPanel
          element={model.elementMap.get(selectedElementId)}
          onClose={() => setShowPropertyPanel(false)}
        />
      )}
    </div>
  );
};

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  label,
  onClick,
  active,
}) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 12px',
      background: active ? '#F47820' : '#fff',
      color: active ? '#fff' : '#0F1629',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '500',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    }}
  >
    {label}
  </button>
);
```

### Step 4: Selection and Highlighting System

**File**: `src/components/BIMViewer/SelectionHandler.ts`

```typescript
import * as THREE from 'three';

export class SelectionHandler {
  private selectedObjects: Set<THREE.Object3D> = new Set();
  private originalMaterials: Map<THREE.Object3D, THREE.Material> = new Map();
  private highlightMaterial: THREE.MeshPhongMaterial;
  private outlineMaterial: THREE.LineBasicMaterial;

  constructor() {
    this.highlightMaterial = new THREE.MeshPhongMaterial({
      color: 0xf47820,
      emissive: 0xff6600,
      emissiveIntensity: 0.5,
      wireframe: false,
    });

    this.outlineMaterial = new THREE.LineBasicMaterial({
      color: 0xf47820,
      linewidth: 2,
    });
  }

  select(object: THREE.Object3D): void {
    if (this.selectedObjects.has(object)) {
      return;
    }

    // Store original material
    if (object instanceof THREE.Mesh) {
      const originalMaterial = Array.isArray(object.material)
        ? object.material[0]
        : object.material;
      this.originalMaterials.set(object, originalMaterial);

      // Apply highlight
      object.material = this.highlightMaterial;

      // Add outline
      const outline = this.createOutline(object);
      object.add(outline);
    }

    this.selectedObjects.add(object);
  }

  deselect(object: THREE.Object3D): void {
    if (!this.selectedObjects.has(object)) {
      return;
    }

    // Restore original material
    if (object instanceof THREE.Mesh) {
      const originalMaterial = this.originalMaterials.get(object);
      if (originalMaterial) {
        object.material = originalMaterial;
      }

      // Remove outline
      const outline = object.children.find(
        (child) => child instanceof THREE.LineSegments
      );
      if (outline) {
        object.remove(outline);
      }
    }

    this.selectedObjects.delete(object);
    this.originalMaterials.delete(object);
  }

  deselectAll(): void {
    this.selectedObjects.forEach((object) => this.deselect(object));
  }

  private createOutline(mesh: THREE.Mesh): THREE.LineSegments {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const edges = new THREE.EdgesGeometry(geometry);
    return new THREE.LineSegments(edges, this.outlineMaterial);
  }

  isSelected(object: THREE.Object3D): boolean {
    return this.selectedObjects.has(object);
  }

  getSelected(): THREE.Object3D[] {
    return Array.from(this.selectedObjects);
  }
}
```

### Step 5: Section Plane Tool

**File**: `src/components/BIMViewer/SectionPlane.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface SectionPlaneProps {
  scene: THREE.Group;
}

export const SectionPlane: React.FC<SectionPlaneProps> = ({ scene }) => {
  const [sectionPlanePosition, setSectionPlanePosition] = useState(0);
  const [sectionAxis, setSectionAxis] = useState<'X' | 'Y' | 'Z'>('Z');

  useFrame(() => {
    // Apply clipping plane to all meshes in scene
    const plane = new THREE.Plane(
      new THREE.Vector3(
        sectionAxis === 'X' ? 1 : 0,
        sectionAxis === 'Y' ? 1 : 0,
        sectionAxis === 'Z' ? 1 : 0
      ),
      -sectionPlanePosition
    );

    scene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        if (Array.isArray(node.material)) {
          node.material.forEach((mat: any) => {
            mat.clippingPlanes = [plane];
            mat.clipIntersection = false;
          });
        } else {
          (node.material as any).clippingPlanes = [plane];
          (node.material as any).clipIntersection = false;
        }
      }
    });
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        background: '#fff',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 5,
        minWidth: '200px',
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600 }}>
        Section Plane
      </h3>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
          Axis
        </label>
        <select
          value={sectionAxis}
          onChange={(e) => setSectionAxis(e.target.value as 'X' | 'Y' | 'Z')}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          <option value="X">X Axis</option>
          <option value="Y">Y Axis</option>
          <option value="Z">Z Axis</option>
        </select>
      </div>

      <div>
        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
          Position: {sectionPlanePosition.toFixed(1)}
        </label>
        <input
          type="range"
          min="-200"
          max="200"
          value={sectionPlanePosition}
          onChange={(e) => setSectionPlanePosition(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
};
```

### Step 6: Property Panel Component

**File**: `src/components/BIMViewer/PropertyPanel.tsx`

```typescript
import React from 'react';
import { IFCElement } from '@/services/ifc/IFCProgressiveLoader';

interface PropertyPanelProps {
  element?: IFCElement;
  onClose: () => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  element,
  onClose,
}) => {
  if (!element) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '50px',
        right: '12px',
        width: '300px',
        maxHeight: '500px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 6,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
          Properties
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#999',
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>
            Name
          </label>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{element.name}</div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>
            Type
          </label>
          <div style={{ fontSize: '13px' }}>{element.type}</div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>
            Category
          </label>
          <div style={{ fontSize: '13px' }}>{element.category}</div>
        </div>

        <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #eee' }} />

        <h4 style={{ fontSize: '11px', fontWeight: 600, margin: '8px 0', textTransform: 'uppercase' }}>
          IFC Properties
        </h4>

        {Object.entries(element.properties).map(([key, value]) => (
          <div key={key} style={{ marginBottom: '8px', fontSize: '12px' }}>
            <label style={{ color: '#999', display: 'block', marginBottom: '2px' }}>
              {key}
            </label>
            <div style={{ color: '#333', wordBreak: 'break-word' }}>
              {String(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Step 7: Performance Monitoring

**File**: `src/components/BIMViewer/PerformanceMonitor.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export const PerformanceMonitor: React.FC = () => {
  const [stats, setStats] = useState({ fps: 0, memory: '0 MB' });
  const { gl } = useThree();

  useFrame(({ clock }) => {
    // Update every second
    if (clock.getElapsedTime() % 1 < 0.016) {
      const pixelRatio = gl.getPixelRatio();
      const size = gl.getSize(new (window as any).THREE.Vector2());
      const numPixels = size.width * size.height * pixelRatio * pixelRatio;

      // Rough FPS estimate
      const fps = Math.round(1 / clock.getDelta());

      let memory = 'N/A';
      if ((performance as any).memory) {
        const mb = ((performance as any).memory.usedJSHeapSize / 1048576).toFixed(0);
        memory = `${mb} MB`;
      }

      setStats({ fps, memory });
    }
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 5,
      }}
    >
      <div>FPS: {stats.fps}</div>
      <div>Memory: {stats.memory}</div>
    </div>
  );
};
```

### Step 8: Supabase Cache Integration

**File**: `src/services/ifc/IFCCache.ts`

```typescript
import { supabase } from '@/lib/supabase';

export interface CachedModel {
  id: string;
  projectId: string;
  fileName: string;
  modelData: ArrayBuffer;
  metadata: any;
  createdAt: string;
  hash: string; // SHA256 of file
}

export class IFCCache {
  static async getCachedModel(
    projectId: string,
    fileHash: string
  ): Promise<ArrayBuffer | null> {
    try {
      const { data, error } = await supabase
        .from('ifc_models')
        .select('modelData')
        .eq('projectId', projectId)
        .eq('hash', fileHash)
        .single();

      if (error || !data) {
        return null;
      }

      // modelData is stored as base64 in Supabase
      const binaryString = atob(data.modelData as string);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.warn('Cache retrieval failed:', error);
      return null;
    }
  }

  static async setCachedModel(
    projectId: string,
    fileName: string,
    modelData: ArrayBuffer,
    metadata: any,
    fileHash: string
  ): Promise<boolean> {
    try {
      // Convert to base64 for storage
      const binaryString = String.fromCharCode.apply(
        null,
        Array.from(new Uint8Array(modelData)) as number[]
      );
      const base64 = btoa(binaryString);

      const { error } = await supabase.from('ifc_models').insert({
        projectId,
        fileName,
        modelData: base64,
        metadata,
        hash: fileHash,
      });

      if (error) {
        console.warn('Cache save failed:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.warn('Cache save error:', error);
      return false;
    }
  }

  static async computeFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
```

---

## Acceptance Criteria

- [ ] IFC files (2-10M triangles) load and render in under 5 seconds
- [ ] WebGPU detection works on all target browsers with graceful WebGL2 fallback
- [ ] Element selection highlights individual components with orange outline
- [ ] Property panel displays all IFC properties for selected element
- [ ] Section plane clipping works smoothly across X/Y/Z axes
- [ ] Performance monitor shows FPS and memory usage
- [ ] Progressive loading shows visual feedback (progress bar, triangle count)
- [ ] Models are cached in Supabase and retrieved on second load (90% faster)
- [ ] Responsive to window resize without memory leaks
- [ ] Mobile viewable via Capacitor (landscape mode optimized)

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| First triangles visible | <200ms | Progressive geometry loading |
| Full model loaded | <5s | Async asset streaming |
| Selection highlight | <16ms | GPU-resident selection |
| Section plane update | 60 FPS | GPU clipping planes |
| Memory footprint (10M tri) | <512MB | Indexed geometry + streaming |

---

## API Changes

**New Supabase tables**:
```sql
CREATE TABLE ifc_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  file_name TEXT NOT NULL,
  model_data BYTEA NOT NULL,
  metadata JSONB,
  hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, hash)
);
```
