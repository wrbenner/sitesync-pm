import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  RotateCcw, Move, ZoomIn, Grid3X3, Eye, Maximize2, Layers,
  MousePointer, Box,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BIMLinkedItem {
  id: string;
  type: 'punch_item' | 'rfi' | 'submittal';
  label: string;
  position: { x: number; y: number; z: number };
  status: string;
  priority?: string;
}

export interface BIMViewerProps {
  modelUrl?: string;
  /** Pre-built Three.js objects (e.g. from an IFC loader). Takes precedence over modelUrl when provided. */
  meshes?: THREE.Object3D[];
  linkedItems?: BIMLinkedItem[];
  onElementClick?: (elementId: string) => void;
  height?: number | string;
}

// ── Constants ──────────────────────────────────────────────────────────────

type InteractionMode = 'orbit' | 'pan' | 'zoom';

const MARKER_COLORS: Record<BIMLinkedItem['type'], string> = {
  punch_item: '#E05252',
  rfi: '#3A7BC8',
  submittal: '#4EC896',
};

const MARKER_LABELS: Record<BIMLinkedItem['type'], string> = {
  punch_item: 'Punch',
  rfi: 'RFI',
  submittal: 'Submittal',
};

const FLOOR_HEIGHT = 3.5;
const NUM_FLOORS = 3;

// ── Toolbar Button ─────────────────────────────────────────────────────────

const ToolbarButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        border: 'none',
        borderRadius: borderRadius.md,
        background: active ? 'rgba(244,120,32,0.35)' : hovered ? 'rgba(255,255,255,0.15)' : 'transparent',
        color: active ? '#F47820' : '#fff',
        cursor: 'pointer',
        transition: `background ${transitions.quick}`,
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
};

// ── Demo Building ──────────────────────────────────────────────────────────

function createDemoBuilding(): THREE.Group {
  const building = new THREE.Group();
  building.name = 'DemoBuilding';

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd4c8b8, roughness: 0.8 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8c8580, roughness: 0.9 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x6bb8e8,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.6,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5c5550, roughness: 0.7 });

  const buildingWidth = 16;
  const buildingDepth = 10;
  const wallThickness = 0.3;

  for (let floor = 0; floor < NUM_FLOORS; floor++) {
    const yBase = floor * FLOOR_HEIGHT;
    const floorGroup = new THREE.Group();
    floorGroup.name = `Floor_${floor + 1}`;
    floorGroup.userData = { floor: floor + 1 };

    // Floor slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(buildingWidth, 0.25, buildingDepth),
      floorMat,
    );
    slab.position.set(0, yBase, 0);
    slab.name = `Slab_F${floor + 1}`;
    floorGroup.add(slab);

    // Front wall
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(buildingWidth, FLOOR_HEIGHT - 0.25, wallThickness),
      wallMat,
    );
    frontWall.position.set(0, yBase + FLOOR_HEIGHT / 2 + 0.125, buildingDepth / 2);
    frontWall.name = `FrontWall_F${floor + 1}`;
    floorGroup.add(frontWall);

    // Back wall
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(buildingWidth, FLOOR_HEIGHT - 0.25, wallThickness),
      wallMat,
    );
    backWall.position.set(0, yBase + FLOOR_HEIGHT / 2 + 0.125, -buildingDepth / 2);
    backWall.name = `BackWall_F${floor + 1}`;
    floorGroup.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, FLOOR_HEIGHT - 0.25, buildingDepth),
      wallMat,
    );
    leftWall.position.set(-buildingWidth / 2, yBase + FLOOR_HEIGHT / 2 + 0.125, 0);
    leftWall.name = `LeftWall_F${floor + 1}`;
    floorGroup.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, FLOOR_HEIGHT - 0.25, buildingDepth),
      wallMat,
    );
    rightWall.position.set(buildingWidth / 2, yBase + FLOOR_HEIGHT / 2 + 0.125, 0);
    rightWall.name = `RightWall_F${floor + 1}`;
    floorGroup.add(rightWall);

    // Windows on front wall
    const winWidth = 1.6;
    const winHeight = 1.4;
    const winCount = 5;
    const winSpacing = buildingWidth / (winCount + 1);
    for (let w = 0; w < winCount; w++) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(winWidth, winHeight, wallThickness + 0.05),
        windowMat,
      );
      win.position.set(
        -buildingWidth / 2 + winSpacing * (w + 1),
        yBase + FLOOR_HEIGHT / 2 + 0.3,
        buildingDepth / 2,
      );
      win.name = `Window_F${floor + 1}_${w + 1}`;
      floorGroup.add(win);
    }

    // Windows on back wall
    for (let w = 0; w < winCount; w++) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(winWidth, winHeight, wallThickness + 0.05),
        windowMat,
      );
      win.position.set(
        -buildingWidth / 2 + winSpacing * (w + 1),
        yBase + FLOOR_HEIGHT / 2 + 0.3,
        -buildingDepth / 2,
      );
      win.name = `Window_Back_F${floor + 1}_${w + 1}`;
      floorGroup.add(win);
    }

    building.add(floorGroup);
  }

  // Roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(buildingWidth + 0.6, 0.3, buildingDepth + 0.6),
    roofMat,
  );
  roof.position.set(0, NUM_FLOORS * FLOOR_HEIGHT + 0.15, 0);
  roof.name = 'Roof';
  building.add(roof);

  return building;
}

// ── Marker Sprite ──────────────────────────────────────────────────────────

function createMarkerSprite(item: BIMLinkedItem): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const color = MARKER_COLORS[item.type];

  // Background pill
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 56, 12);
  ctx.fill();

  // Text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const shortLabel = item.label.length > 12 ? item.label.slice(0, 11) + '...' : item.label;
  ctx.fillText(shortLabel, 64, 24);
  ctx.font = '14px sans-serif';
  ctx.fillText(MARKER_LABELS[item.type], 64, 46);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3, 1.5, 1);
  sprite.position.set(item.position.x, item.position.y, item.position.z);
  sprite.name = `marker_${item.id}`;
  sprite.userData = { linkedItem: item };
  return sprite;
}

// ── Main Component ─────────────────────────────────────────────────────────

export const BIMViewer: React.FC<BIMViewerProps> = ({
  modelUrl,
  meshes,
  linkedItems = [],
  onElementClick,
  height = 600,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number>(0);
  const buildingRef = useRef<THREE.Group | null>(null);
  const markersRef = useRef<THREE.Sprite[]>([]);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Orbit control state
  const isDragging = useRef(false);
  const dragButton = useRef<number>(-1);
  const lastMouse = useRef({ x: 0, y: 0 });
  const spherical = useRef({ theta: Math.PI / 4, phi: Math.PI / 3, radius: 30 });
  const target = useRef(new THREE.Vector3(0, 4, 0));

  const [mode, setMode] = useState<InteractionMode>('orbit');
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isolatedFloor, setIsolatedFloor] = useState<number | null>(null);
  const [hoveredItem, setHoveredItem] = useState<BIMLinkedItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<BIMLinkedItem | null>(null);

  // ── Initialize scene ───────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const h = typeof height === 'number' ? height : container.clientHeight || 600;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1629);
    scene.fog = new THREE.Fog(0x0f1629, 60, 120);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / h, 0.1, 500);
    cameraRef.current = camera;
    updateCameraFromSpherical();

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1.0);
    directional.position.set(15, 25, 10);
    directional.castShadow = true;
    directional.shadow.mapSize.set(1024, 1024);
    directional.shadow.camera.near = 0.5;
    directional.shadow.camera.far = 80;
    directional.shadow.camera.left = -20;
    directional.shadow.camera.right = 20;
    directional.shadow.camera.top = 20;
    directional.shadow.camera.bottom = -20;
    scene.add(directional);

    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.3);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1f30, roughness: 1.0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(50, 50, 0x2a3050, 0x1e2540);
    grid.position.y = 0;
    scene.add(grid);
    gridRef.current = grid;

    // Demo building (will be replaced if model loads)
    const building = createDemoBuilding();
    scene.add(building);
    buildingRef.current = building;

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
        if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Camera update ────────────────────────────────────────────────────

  const updateCameraFromSpherical = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const s = spherical.current;
    const t = target.current;
    camera.position.set(
      t.x + s.radius * Math.sin(s.phi) * Math.cos(s.theta),
      t.y + s.radius * Math.cos(s.phi),
      t.z + s.radius * Math.sin(s.phi) * Math.sin(s.theta),
    );
    camera.lookAt(t);
  }, []);

  // ── Load model if URL changes ────────────────────────────────────────

  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove demo building
    if (buildingRef.current) {
      scene.remove(buildingRef.current);
      buildingRef.current = null;
    }

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        model.name = 'LoadedModel';

        // Auto-scale to fit
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 20 / maxDim;
          model.scale.setScalar(scale);
        }

        // Center
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(model.scale.x));

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);
        buildingRef.current = model;

        // Fit camera
        target.current.set(0, size.y * model.scale.y / 2, 0);
        spherical.current.radius = maxDim * model.scale.x * 1.5;
        updateCameraFromSpherical();
      },
      undefined,
      (err) => {
        console.error('Failed to load model:', err);
      },
    );
  }, [modelUrl, updateCameraFromSpherical]);

  // ── Load pre-built meshes (e.g. from IFC loader) ─────────────────────

  useEffect(() => {
    if (!meshes || meshes.length === 0 || !sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove demo building or previously-loaded content
    if (buildingRef.current) {
      scene.remove(buildingRef.current);
      buildingRef.current = null;
    }

    const group = new THREE.Group();
    group.name = 'IFCModel';
    for (const obj of meshes) group.add(obj);

    // Auto-scale & center to match viewer conventions (building ≈ 20 units wide)
    const box = new THREE.Box3().setFromObject(group);
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 20 / maxDim;
        group.scale.setScalar(scale);
      }
      const center = box.getCenter(new THREE.Vector3()).multiplyScalar(group.scale.x);
      group.position.sub(center);
      // Lift so the model sits on the ground plane
      const scaledBox = new THREE.Box3().setFromObject(group);
      group.position.y -= scaledBox.min.y;
    }

    scene.add(group);
    buildingRef.current = group;

    // Fit camera
    const finalBox = new THREE.Box3().setFromObject(group);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    target.current.set(0, finalSize.y / 2, 0);
    spherical.current.radius = Math.max(finalSize.x, finalSize.y, finalSize.z) * 1.5;
    updateCameraFromSpherical();

    return () => {
      scene.remove(group);
      if (buildingRef.current === group) buildingRef.current = null;
    };
  }, [meshes, updateCameraFromSpherical]);

  // ── Linked item markers ──────────────────────────────────────────────

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old markers
    markersRef.current.forEach((s) => {
      scene.remove(s);
      s.material.map?.dispose();
      s.material.dispose();
    });
    markersRef.current = [];

    // Add new markers
    linkedItems.forEach((item) => {
      const sprite = createMarkerSprite(item);
      scene.add(sprite);
      markersRef.current.push(sprite);
    });
  }, [linkedItems]);

  // ── Wireframe toggle ─────────────────────────────────────────────────

  useEffect(() => {
    const building = buildingRef.current;
    if (!building) return;
    building.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.wireframe = wireframe;
      }
    });
  }, [wireframe]);

  // ── Grid toggle ──────────────────────────────────────────────────────

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // ── Floor isolation ──────────────────────────────────────────────────

  useEffect(() => {
    const building = buildingRef.current;
    if (!building) return;
    building.traverse((child) => {
      if (child instanceof THREE.Group && child.userData.floor != null) {
        child.visible = isolatedFloor === null || child.userData.floor === isolatedFloor;
      }
    });
  }, [isolatedFloor]);

  // ── Resize handler ───────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onResize = () => {
      const w = container.clientWidth;
      const h2 = typeof height === 'number' ? height : container.clientHeight || 600;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      if (camera && renderer) {
        camera.aspect = w / h2;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h2);
      }
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [height]);

  // ── Mouse interaction ────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    dragButton.current = e.button;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    // Update mouse for raycasting
    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Hover detection for markers
    if (!isDragging.current && cameraRef.current && sceneRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const hits = raycasterRef.current.intersectObjects(markersRef.current);
      if (hits.length > 0) {
        const linked = hits[0].object.userData.linkedItem as BIMLinkedItem | undefined;
        setHoveredItem(linked ?? null);
        container.style.cursor = 'pointer';
      } else {
        setHoveredItem(null);
        container.style.cursor = mode === 'orbit' ? 'grab' : mode === 'pan' ? 'move' : 'zoom-in';
      }
    }

    if (!isDragging.current) return;

    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    const s = spherical.current;
    const effectiveMode = dragButton.current === 2 ? 'pan' : mode;

    if (effectiveMode === 'orbit') {
      s.theta -= dx * 0.005;
      s.phi -= dy * 0.005;
      s.phi = Math.max(0.1, Math.min(Math.PI - 0.1, s.phi));
    } else if (effectiveMode === 'pan') {
      const camera = cameraRef.current;
      if (camera) {
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        camera.getWorldDirection(new THREE.Vector3());
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        up.setFromMatrixColumn(camera.matrixWorld, 1);
        const panSpeed = s.radius * 0.002;
        target.current.addScaledVector(right, -dx * panSpeed);
        target.current.addScaledVector(up, dy * panSpeed);
      }
    } else if (effectiveMode === 'zoom') {
      s.radius *= 1 - dy * 0.005;
      s.radius = Math.max(2, Math.min(150, s.radius));
    }

    updateCameraFromSpherical();
  }, [mode, updateCameraFromSpherical]);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    dragButton.current = -1;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const s = spherical.current;
    s.radius *= 1 + e.deltaY * 0.001;
    s.radius = Math.max(2, Math.min(150, s.radius));
    updateCameraFromSpherical();
  }, [updateCameraFromSpherical]);

  const onClick = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!container || !camera || !scene) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );

    raycasterRef.current.setFromCamera(mouse, camera);

    // Check markers first
    const markerHits = raycasterRef.current.intersectObjects(markersRef.current);
    if (markerHits.length > 0) {
      const item = markerHits[0].object.userData.linkedItem as BIMLinkedItem | undefined;
      if (item) {
        setSelectedItem(item);
        onElementClick?.(item.id);
        return;
      }
    }

    // Check building meshes
    if (buildingRef.current) {
      const meshes: THREE.Mesh[] = [];
      buildingRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
      const hits = raycasterRef.current.intersectObjects(meshes);
      if (hits.length > 0) {
        const hit = hits[0].object;
        setSelectedItem(null);
        onElementClick?.(hit.name || hit.uuid);
      }
    }
  }, [onElementClick]);

  // ── Toolbar actions ──────────────────────────────────────────────────

  const resetView = useCallback(() => {
    spherical.current = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 30 };
    target.current.set(0, 4, 0);
    updateCameraFromSpherical();
    setIsolatedFloor(null);
  }, [updateCameraFromSpherical]);

  const fitToView = useCallback(() => {
    const building = buildingRef.current;
    if (!building) return;
    const box = new THREE.Box3().setFromObject(building);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    target.current.copy(center);
    spherical.current.radius = maxDim * 1.5;
    updateCameraFromSpherical();
  }, [updateCameraFromSpherical]);

  // ── Info Panel item ──────────────────────────────────────────────────

  const displayItem = selectedItem ?? hoveredItem;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0F1629 0%, #1a2744 50%, #0F1629 100%)',
        cursor: mode === 'orbit' ? 'grab' : mode === 'pan' ? 'move' : 'zoom-in',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── Toolbar (top-left) ─────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: spacing['2'],
          background: 'rgba(15, 22, 41, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: borderRadius.lg,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: shadows.dropdown,
          zIndex: 10,
        }}
      >
        <ToolbarButton
          icon={<MousePointer size={16} />}
          label="Orbit"
          active={mode === 'orbit'}
          onClick={() => setMode('orbit')}
        />
        <ToolbarButton
          icon={<Move size={16} />}
          label="Pan"
          active={mode === 'pan'}
          onClick={() => setMode('pan')}
        />
        <ToolbarButton
          icon={<ZoomIn size={16} />}
          label="Zoom"
          active={mode === 'zoom'}
          onClick={() => setMode('zoom')}
        />

        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

        <ToolbarButton
          icon={<RotateCcw size={16} />}
          label="Reset View"
          onClick={resetView}
        />
        <ToolbarButton
          icon={<Maximize2 size={16} />}
          label="Fit to View"
          onClick={fitToView}
        />
        <ToolbarButton
          icon={<Eye size={16} />}
          label="Toggle Wireframe"
          active={wireframe}
          onClick={() => setWireframe((w) => !w)}
        />
        <ToolbarButton
          icon={<Grid3X3 size={16} />}
          label="Toggle Grid"
          active={showGrid}
          onClick={() => setShowGrid((g) => !g)}
        />

        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

        {/* Floor isolation */}
        <ToolbarButton
          icon={<Layers size={16} />}
          label="Show All Floors"
          active={isolatedFloor === null}
          onClick={() => setIsolatedFloor(null)}
        />
        {Array.from({ length: NUM_FLOORS }, (_, i) => (
          <ToolbarButton
            key={i}
            icon={<Box size={14} />}
            label={`Floor ${i + 1}`}
            active={isolatedFloor === i + 1}
            onClick={() => setIsolatedFloor(isolatedFloor === i + 1 ? null : i + 1)}
          />
        ))}
      </div>

      {/* ── Mode label (top-center) ───────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: `${spacing['1']} ${spacing['3']}`,
          background: 'rgba(15, 22, 41, 0.75)',
          backdropFilter: 'blur(8px)',
          borderRadius: borderRadius.full,
          color: 'rgba(255,255,255,0.6)',
          fontSize: typography.fontSize.caption,
          fontFamily: typography.fontFamily,
          letterSpacing: typography.letterSpacing.wider,
          textTransform: 'uppercase' as const,
          border: '1px solid rgba(255,255,255,0.06)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {mode === 'orbit' ? 'Orbit Mode' : mode === 'pan' ? 'Pan Mode' : 'Zoom Mode'}
        {isolatedFloor ? ` | Floor ${isolatedFloor}` : ''}
      </div>

      {/* ── Info panel (bottom-right) ─────────────────────── */}
      {displayItem && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 260,
            padding: spacing['4'],
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: borderRadius.lg,
            boxShadow: shadows.dropdown,
            zIndex: 10,
            fontFamily: typography.fontFamily,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: borderRadius.full,
                background: MARKER_COLORS[displayItem.type],
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.semibold,
                color: colors.darkNavy,
                textTransform: 'uppercase' as const,
                letterSpacing: typography.letterSpacing.wider,
              }}
            >
              {MARKER_LABELS[displayItem.type]}
            </span>
          </div>
          <div
            style={{
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.semibold,
              color: colors.darkNavy,
              marginBottom: spacing['1'],
            }}
          >
            {displayItem.label}
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' as const }}>
            <span
              style={{
                fontSize: typography.fontSize.caption,
                padding: `${spacing['0.5']} ${spacing['2']}`,
                borderRadius: borderRadius.full,
                background: displayItem.status === 'open' ? colors.statusInfoSubtle : displayItem.status === 'closed' ? colors.statusActiveSubtle : colors.statusPendingSubtle,
                color: displayItem.status === 'open' ? '#3A7BC8' : displayItem.status === 'closed' ? '#4EC896' : '#D97706',
                fontWeight: typography.fontWeight.medium,
              }}
            >
              {displayItem.status}
            </span>
            {displayItem.priority && (
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  padding: `${spacing['0.5']} ${spacing['2']}`,
                  borderRadius: borderRadius.full,
                  background: displayItem.priority === 'high' ? colors.statusCriticalSubtle : colors.statusNeutralSubtle,
                  color: displayItem.priority === 'high' ? '#E05252' : '#8B8680',
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                {displayItem.priority}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: typography.fontSize.caption,
              color: '#8B8680',
              marginTop: spacing['2'],
              fontFamily: typography.fontFamilyMono,
            }}
          >
            ({displayItem.position.x.toFixed(1)}, {displayItem.position.y.toFixed(1)}, {displayItem.position.z.toFixed(1)})
          </div>
        </div>
      )}

      {/* ── Legend (bottom-left) ───────────────────────────── */}
      {linkedItems.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 12,
            display: 'flex',
            gap: spacing['3'],
            padding: `${spacing['2']} ${spacing['3']}`,
            background: 'rgba(15, 22, 41, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: borderRadius.md,
            border: '1px solid rgba(255,255,255,0.06)',
            zIndex: 10,
            fontFamily: typography.fontFamily,
            fontSize: typography.fontSize.caption,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          {(['punch_item', 'rfi', 'submittal'] as const).map((type) => {
            const count = linkedItems.filter((i) => i.type === type).length;
            if (count === 0) return null;
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: MARKER_COLORS[type],
                  }}
                />
                {MARKER_LABELS[type]} ({count})
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BIMViewer;
