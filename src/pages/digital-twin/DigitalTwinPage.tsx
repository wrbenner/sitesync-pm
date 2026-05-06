// DigitalTwinPage — 4D Visualization combining 3D BIM model, schedule timeline,
// and progress photos. Data is driven by real schedule_phases for the active
// project; the Three.js scene colors building groups by phase status at the
// current timeline-scrubber date.

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { PageContainer } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import {
  Play, Pause, SkipBack, SkipForward, Maximize2, Calendar,
  AlertTriangle, TrendingUp, Users, Clock,
  Columns, BarChart3, GitCompare,
  Building2, Layers,
} from 'lucide-react';
import { useProjectId } from '../../hooks/useProjectId';
import { useSchedulePhases } from '../../hooks/queries/schedule-phases';
import type { SchedulePhase } from '../../types/database';

// ── Types ─────────────────────────────────────────────────────────────────

type PhaseStatus = 'complete' | 'in-progress' | 'not-started' | 'behind';

interface TwinPhase {
  id: string;
  name: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart: Date | null;
  actualEnd: Date | null;
  percentComplete: number;
  dbStatus: string;
  trade: string;
  elementGroup: string | null;
}

type ViewMode = '3d' | 'split' | 'timeline';

const STATUS_COLORS: Record<PhaseStatus, string> = {
  'complete': '#4EC896',
  'in-progress': '#F47820',
  'not-started': '#8B8680',
  'behind': '#E05252',
};

const STATUS_THREE_COLORS: Record<PhaseStatus, number> = {
  'complete': 0x4EC896,
  'in-progress': 0xF47820,
  'not-started': 0x8B8680,
  'behind': 0xE05252,
};

function parseDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// ── Phase → building element mapping ───────────────────────────────────────

const ELEMENT_KEYWORDS: Array<{ group: string; patterns: RegExp[] }> = [
  { group: 'foundation', patterns: [/\bfoundation\b/i, /\bsite\s*prep/i, /\bgrading\b/i, /\bexcavat/i, /\bfooting/i, /\bslab\b/i] },
  { group: 'floor1',     patterns: [/\bfloor\s*1\b/i, /\blevel\s*1\b/i, /\b1st\s*floor/i, /\bground\s*floor/i] },
  { group: 'floor2',     patterns: [/\bfloor\s*2\b/i, /\blevel\s*2\b/i, /\b2nd\s*floor/i, /\bsecond\s*floor/i] },
  { group: 'floor3',     patterns: [/\bfloor\s*3\b/i, /\blevel\s*3\b/i, /\b3rd\s*floor/i, /\bthird\s*floor/i] },
  { group: 'roof',       patterns: [/\broof/i] },
  { group: 'exterior',   patterns: [/\bexterior\b/i, /\benvelope\b/i, /\bcladding\b/i, /\bfacade\b/i, /\bsiding\b/i, /\bstructur/i, /\bsteel\b/i, /\bframing\b/i] },
];

type DBPhase = SchedulePhase & { wbs?: string | null };

function elementGroupFor(p: DBPhase): string | null {
  const hay = `${p.name ?? ''} ${p.wbs ?? ''} ${p.description ?? ''}`;
  for (const { group, patterns } of ELEMENT_KEYWORDS) {
    if (patterns.some((re) => re.test(hay))) return group;
  }
  return null;
}

function normalizeStatus(p: DBPhase): string {
  return (p.status ?? 'upcoming').toString();
}

function tradeFor(p: DBPhase): string {
  const name = (p.name ?? '').toLowerCase();
  if (name.includes('mep') || name.includes('plumb') || name.includes('electric') || name.includes('hvac')) return 'MEP';
  if (name.includes('concrete') || name.includes('foundation') || name.includes('slab')) return 'Concrete';
  if (name.includes('framing') || name.includes('steel') || name.includes('structur')) return 'Structural';
  if (name.includes('drywall') || name.includes('interior')) return 'Interiors';
  if (name.includes('roof')) return 'Roofing';
  if (name.includes('exterior') || name.includes('facade') || name.includes('cladding')) return 'Envelope';
  return 'General';
}

function toTwinPhase(p: DBPhase): TwinPhase | null {
  const plannedStart = parseDateOrNull(p.start_date);
  const plannedEnd = parseDateOrNull(p.end_date);
  if (!plannedStart || !plannedEnd) return null;
  return {
    id: p.id,
    name: p.name ?? 'Untitled',
    plannedStart,
    plannedEnd,
    actualStart: parseDateOrNull(p.actual_start),
    actualEnd: parseDateOrNull(p.actual_end),
    percentComplete: Math.max(0, Math.min(100, Math.round(p.percent_complete ?? 0))),
    dbStatus: normalizeStatus(p),
    trade: tradeFor(p),
    elementGroup: elementGroupFor(p),
  };
}

function phaseStatusAtDate(phase: TwinPhase, date: Date): PhaseStatus {
  const ps = phase.plannedStart;
  const pe = phase.plannedEnd;

  // Database status takes precedence when the schedule date is today or later.
  if (phase.dbStatus === 'completed' && phase.percentComplete >= 100 && date >= pe) return 'complete';

  if (date < ps) return 'not-started';
  if (date > pe) {
    if (phase.percentComplete >= 100) return 'complete';
    return 'behind';
  }

  // Within the planned window — compare expected vs actual progress.
  const elapsed = Math.max(0, daysBetween(ps, date));
  const planned = Math.max(1, daysBetween(ps, pe));
  const expectedPct = Math.min(100, (elapsed / planned) * 100);
  const actualPct = phase.percentComplete;

  if (actualPct >= 100) return 'complete';
  if (actualPct < expectedPct * 0.6) return 'behind';
  return 'in-progress';
}

// ── Three.js Building Scene ────────────────────────────────────────────────

const FLOOR_HEIGHT = 3.5;
const NUM_FLOORS = 3;
const BUILDING_WIDTH = 16;
const BUILDING_DEPTH = 10;

interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  buildingElements: Record<string, THREE.Mesh[]>;
  cleanup: () => void;
}

function createBuildingScene(
  container: HTMLDivElement,
  onReady: (ctx: SceneContext) => void,
) {
  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 50, 120);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
  camera.position.set(25, 20, 30);
  camera.lookAt(0, 5, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(20, 30, 15);
  directional.castShadow = true;
  directional.shadow.mapSize.width = 1024;
  directional.shadow.mapSize.height = 1024;
  scene.add(directional);

  const fill = new THREE.DirectionalLight(0x6688cc, 0.3);
  fill.position.set(-10, 10, -10);
  scene.add(fill);

  const groundGeo = new THREE.PlaneGeometry(60, 60);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(60, 30, 0x3a3a5e, 0x2a2a4e);
  scene.add(grid);

  const buildingElements: Record<string, THREE.Mesh[]> = {
    foundation: [],
    floor1: [],
    floor2: [],
    floor3: [],
    exterior: [],
    roof: [],
  };

  const foundGeo = new THREE.BoxGeometry(BUILDING_WIDTH + 2, 0.5, BUILDING_DEPTH + 2);
  const foundMat = new THREE.MeshStandardMaterial({ color: 0x8B8680, roughness: 0.8 });
  const foundation = new THREE.Mesh(foundGeo, foundMat);
  foundation.position.set(0, 0.25, 0);
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  scene.add(foundation);
  buildingElements.foundation.push(foundation);

  for (let f = 0; f < NUM_FLOORS; f++) {
    const floorKey = `floor${f + 1}` as keyof typeof buildingElements;
    const baseY = f * FLOOR_HEIGHT + 0.5;

    const slabGeo = new THREE.BoxGeometry(BUILDING_WIDTH, 0.3, BUILDING_DEPTH);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x8B8680, roughness: 0.7 });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(0, baseY, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    scene.add(slab);
    buildingElements[floorKey].push(slab);

    const wallThickness = 0.3;
    const wallHeight = FLOOR_HEIGHT - 0.3;

    for (let w = 0; w < 3; w++) {
      const segWidth = (BUILDING_WIDTH - 2) / 3 - 1;
      const wallGeo = new THREE.BoxGeometry(segWidth, wallHeight, wallThickness);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x8B8680, roughness: 0.6 });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(-BUILDING_WIDTH / 2 + 1.5 + w * (BUILDING_WIDTH - 2) / 3 + segWidth / 2, baseY + 0.15 + wallHeight / 2, BUILDING_DEPTH / 2);
      wall.castShadow = true;
      scene.add(wall);
      buildingElements[floorKey].push(wall);
    }

    const backGeo = new THREE.BoxGeometry(BUILDING_WIDTH, wallHeight, wallThickness);
    const backMat = new THREE.MeshStandardMaterial({ color: 0x8B8680, roughness: 0.6 });
    const backWall = new THREE.Mesh(backGeo, backMat);
    backWall.position.set(0, baseY + 0.15 + wallHeight / 2, -BUILDING_DEPTH / 2);
    backWall.castShadow = true;
    scene.add(backWall);
    buildingElements[floorKey].push(backWall);

    for (const side of [-1, 1]) {
      const sideGeo = new THREE.BoxGeometry(wallThickness, wallHeight, BUILDING_DEPTH);
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x8B8680, roughness: 0.6 });
      const sideWall = new THREE.Mesh(sideGeo, sideMat);
      sideWall.position.set(side * BUILDING_WIDTH / 2, baseY + 0.15 + wallHeight / 2, 0);
      sideWall.castShadow = true;
      scene.add(sideWall);
      buildingElements[floorKey].push(sideWall);
    }

    // Glass panes — tagged via userData so updateBuildingColors leaves them alone.
    for (let w = 0; w < 3; w++) {
      const winGeo = new THREE.BoxGeometry(1.5, 1.2, 0.05);
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
        metalness: 0.8,
      });
      const win = new THREE.Mesh(winGeo, winMat);
      win.userData.isGlass = true;
      win.position.set(
        -BUILDING_WIDTH / 2 + 1.5 + w * (BUILDING_WIDTH - 2) / 3 + (BUILDING_WIDTH - 2) / 6,
        baseY + 0.15 + wallHeight / 2,
        BUILDING_DEPTH / 2 + 0.02,
      );
      scene.add(win);
      buildingElements[floorKey].push(win);
    }
  }

  // Enable transparency on every structural mesh so updateBuildingColors can
  // animate opacity based on phase status without re-creating materials.
  for (const meshes of Object.values(buildingElements)) {
    for (const mesh of meshes) {
      if (mesh.userData.isGlass) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.opacity = 1;
    }
  }

  const roofGeo = new THREE.BoxGeometry(BUILDING_WIDTH + 1, 0.4, BUILDING_DEPTH + 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8B8680, roughness: 0.8 });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.set(0, NUM_FLOORS * FLOOR_HEIGHT + 0.5 + 0.2, 0);
  roofMesh.castShadow = true;
  scene.add(roofMesh);
  buildingElements.roof.push(roofMesh);

  for (let i = 0; i < 4; i++) {
    const pillarGeo = new THREE.BoxGeometry(0.4, NUM_FLOORS * FLOOR_HEIGHT + 0.5, 0.4);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8B8680, roughness: 0.5, metalness: 0.3 });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    const px = (i % 2 === 0 ? -1 : 1) * (BUILDING_WIDTH / 2 + 0.5);
    const pz = (i < 2 ? 1 : -1) * (BUILDING_DEPTH / 2 + 0.5);
    pillar.position.set(px, (NUM_FLOORS * FLOOR_HEIGHT + 0.5) / 2, pz);
    pillar.castShadow = true;
    scene.add(pillar);
    buildingElements.exterior.push(pillar);
  }

  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  const spherical = new THREE.Spherical().setFromVector3(camera.position);

  const onPointerDown = (e: PointerEvent) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    spherical.theta -= deltaX * 0.005;
    spherical.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, spherical.phi - deltaY * 0.005));
    camera.position.setFromSpherical(spherical);
    camera.lookAt(0, 5, 0);
    previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = () => {
    isDragging = false;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    spherical.radius = Math.max(15, Math.min(60, spherical.radius + e.deltaY * 0.05));
    camera.position.setFromSpherical(spherical);
    camera.lookAt(0, 5, 0);
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  let animId = 0;
  const animate = () => {
    animId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };
  animate();

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  const ctx: SceneContext = {
    scene,
    camera,
    renderer,
    buildingElements,
    cleanup: () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    },
  };

  onReady(ctx);
}

function opacityFor(status: PhaseStatus, progressPct: number): number {
  switch (status) {
    case 'not-started': return 0.25;
    case 'in-progress': return 0.4 + Math.max(0, Math.min(1, progressPct / 100)) * 0.6;
    case 'complete':
    case 'behind':
      return 1;
  }
}

function updateBuildingColors(
  elements: Record<string, THREE.Mesh[]>,
  phases: TwinPhase[],
  currentDate: Date,
) {
  const statusPriority: Record<PhaseStatus, number> = {
    'behind': 3, 'in-progress': 2, 'complete': 1, 'not-started': 0,
  };

  const groupStatus: Record<string, PhaseStatus> = {};
  const groupProgress: Record<string, number> = {};

  for (const phase of phases) {
    if (!phase.elementGroup) continue;
    const status = phaseStatusAtDate(phase, currentDate);
    const existing = groupStatus[phase.elementGroup];
    if (!existing || statusPriority[status] > statusPriority[existing]) {
      groupStatus[phase.elementGroup] = status;
      groupProgress[phase.elementGroup] = phase.percentComplete;
    }
  }

  for (const [group, meshes] of Object.entries(elements)) {
    const status = groupStatus[group] ?? 'not-started';
    const progress = groupProgress[group] ?? 0;
    const color = STATUS_THREE_COLORS[status];
    const opacity = opacityFor(status, progress);
    for (const mesh of meshes) {
      if (mesh.userData.isGlass) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(color);
      mat.transparent = true;
      mat.opacity = opacity;
      mat.needsUpdate = true;
    }
  }
}

// ── Sub-Components ─────────────────────────────────────────────────────────

const ToolbarBtn: React.FC<{
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
        gap: spacing['2'],
        padding: `${spacing['1.5']} ${spacing['3']}`,
        border: active ? '1px solid rgba(244,120,32,0.4)' : '1px solid ' + colors.borderSubtle,
        borderRadius: borderRadius.md,
        background: active ? 'rgba(244,120,32,0.12)' : hovered ? colors.surfaceHover : colors.surfaceRaised,
        color: active ? '#F47820' : colors.textPrimary,
        cursor: 'pointer',
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily,
        transition: `all ${transitions.quick}`,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing['3'],
      padding: `${spacing['3']} ${spacing['4']}`,
      background: colors.surfaceRaised,
      border: '1px solid ' + colors.borderSubtle,
      borderRadius: borderRadius.lg,
      flex: 1,
      minWidth: 0,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        background: color + '18',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
        {value}
      </div>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────

const DigitalTwinPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneCtxRef = useRef<SceneContext | null>(null);

  const projectId = useProjectId();
  const { data: dbPhases = [], isLoading: loading } = useSchedulePhases(projectId);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [timelineDay, setTimelineDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [compareBaseline, setCompareBaseline] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const twinPhases = useMemo<TwinPhase[]>(() => {
    return (dbPhases as DBPhase[])
      .map(toTwinPhase)
      .filter((p): p is TwinPhase => p !== null);
  }, [dbPhases]);

  // Derive timeline bounds from the real schedule. Fall back to a 180d window
  // starting today when the project has no phases yet.
  const { scheduleStart, totalDays } = useMemo(() => {
    if (twinPhases.length === 0) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 180);
      return { scheduleStart: start, scheduleEnd: end, totalDays: 180 };
    }
    let minMs = Infinity;
    let maxMs = -Infinity;
    for (const p of twinPhases) {
      if (p.plannedStart.getTime() < minMs) minMs = p.plannedStart.getTime();
      if (p.plannedEnd.getTime() > maxMs) maxMs = p.plannedEnd.getTime();
    }
    const start = new Date(minMs);
    const end = new Date(maxMs);
    return { scheduleStart: start, scheduleEnd: end, totalDays: Math.max(1, daysBetween(start, end)) };
  }, [twinPhases]);

  // Jump the scrubber to "today" when the schedule first loads.
  const initializedScrubberRef = useRef(false);
  useEffect(() => {
    if (initializedScrubberRef.current) return;
    if (twinPhases.length === 0) return;
    const todayOffset = Math.max(0, Math.min(totalDays, daysBetween(scheduleStart, new Date())));
    setTimelineDay(todayOffset);
    initializedScrubberRef.current = true;
  }, [twinPhases.length, scheduleStart, totalDays]);

  const currentDate = useMemo(() => {
    const d = new Date(scheduleStart);
    d.setDate(d.getDate() + timelineDay);
    return d;
  }, [scheduleStart, timelineDay]);

  useEffect(() => {
    if (!containerRef.current) return;
    const existing = containerRef.current.querySelector('canvas');
    if (existing) existing.remove();

    createBuildingScene(containerRef.current, (ctx) => {
      sceneCtxRef.current = ctx;
      updateBuildingColors(ctx.buildingElements, twinPhases, currentDate);
    });

    return () => {
      sceneCtxRef.current?.cleanup();
      sceneCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  useEffect(() => {
    if (sceneCtxRef.current) {
      updateBuildingColors(sceneCtxRef.current.buildingElements, twinPhases, currentDate);
    }
  }, [currentDate, twinPhases]);

  // Auto-advance the timeline from the current position to the end over ~10s.
  // Uses rAF so the run time is constant regardless of schedule length.
  useEffect(() => {
    if (!isPlaying || totalDays <= 0) return;
    const PLAY_DURATION_MS = 10000;
    const startDay = timelineDay >= totalDays ? 0 : timelineDay;
    const remainingDays = Math.max(1, totalDays - startDay);
    const durationMs = (remainingDays / totalDays) * PLAY_DURATION_MS;
    let startTs: number | null = null;
    let raf = 0;
    const tick = (ts: number) => {
      if (startTs == null) startTs = ts;
      const progress = Math.min(1, (ts - startTs) / durationMs);
      setTimelineDay(Math.round(startDay + progress * remainingDays));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, totalDays]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((f) => !f);
  }, []);

  // Stats driven by real data at the scrubber's current date.
  const { overallProgress, phaseStatusesNow, activeTradesCount, daysBehindMax, deviations } = useMemo(() => {
    if (twinPhases.length === 0) {
      return {
        overallProgress: 0,
        phaseStatusesNow: [] as Array<{ phase: TwinPhase; status: PhaseStatus }>,
        activeTradesCount: 0,
        daysBehindMax: 0,
        deviations: [] as Array<{ phase: TwinPhase; status: PhaseStatus; daysBehind: number; expectedPct: number }>,
      };
    }

    const rows = twinPhases.map((phase) => ({
      phase,
      status: phaseStatusAtDate(phase, currentDate),
    }));

    const totalPct = rows.reduce((s, r) => s + r.phase.percentComplete, 0);
    const overall = Math.round(totalPct / rows.length);

    const activeTrades = new Set(
      rows.filter((r) => r.status === 'in-progress' || r.status === 'behind').map((r) => r.phase.trade)
    );

    let maxBehind = 0;
    const devs: Array<{ phase: TwinPhase; status: PhaseStatus; daysBehind: number; expectedPct: number }> = [];
    for (const { phase, status } of rows) {
      if (status !== 'behind') continue;
      const planned = Math.max(1, daysBetween(phase.plannedStart, phase.plannedEnd));
      const elapsed = Math.max(0, daysBetween(phase.plannedStart, currentDate));
      const expectedPct = Math.min(100, Math.round((elapsed / planned) * 100));
      const behindPct = Math.max(0, expectedPct - phase.percentComplete);
      const daysBehind = Math.round((behindPct / 100) * planned);
      if (daysBehind > maxBehind) maxBehind = daysBehind;
      devs.push({ phase, status, daysBehind, expectedPct });
    }
    devs.sort((a, b) => b.daysBehind - a.daysBehind);

    return {
      overallProgress: overall,
      phaseStatusesNow: rows,
      activeTradesCount: activeTrades.size,
      daysBehindMax: maxBehind,
      deviations: devs.slice(0, 5),
    };
  }, [twinPhases, currentDate]);

  const show3D = viewMode === '3d' || viewMode === 'split';
  const showTimeline = viewMode === 'timeline' || viewMode === 'split';

  const emptyState = !loading && twinPhases.length === 0;

  return (
    <PageContainer title="Digital Twin" subtitle="4D construction visualization" aria-label="Digital Twin">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          marginBottom: spacing['5'],
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['4']}`,
            background: colors.surfaceRaised,
            border: '1px solid ' + colors.borderSubtle,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}
        >
          <Calendar size={16} style={{ color: '#F47820' }} />
          {formatDate(currentDate)}, {currentDate.getFullYear()}
        </div>

        <div style={{ display: 'flex', gap: spacing['1'] }}>
          <ToolbarBtn
            icon={<Building2 size={15} />}
            label="3D Model"
            active={viewMode === '3d'}
            onClick={() => setViewMode('3d')}
          />
          <ToolbarBtn
            icon={<Columns size={15} />}
            label="Split View"
            active={viewMode === 'split'}
            onClick={() => setViewMode('split')}
          />
          <ToolbarBtn
            icon={<BarChart3 size={15} />}
            label="Timeline Only"
            active={viewMode === 'timeline'}
            onClick={() => setViewMode('timeline')}
          />
        </div>

        <div style={{ flex: 1 }} />

        <ToolbarBtn
          icon={<GitCompare size={15} />}
          label="Compare to Baseline"
          active={compareBaseline}
          onClick={() => setCompareBaseline(!compareBaseline)}
        />

        <ToolbarBtn
          icon={<Maximize2 size={15} />}
          label="Fullscreen"
          onClick={toggleFullscreen}
        />
      </div>

      <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['5'], flexWrap: 'wrap' }}>
        <StatCard icon={<TrendingUp size={18} />} label="Overall Progress" value={`${overallProgress}%`} color="#4EC896" />
        <StatCard icon={<Clock size={18} />} label="Schedule Variance" value={daysBehindMax > 0 ? `${daysBehindMax} days behind` : 'On track'} color={daysBehindMax > 0 ? '#E05252' : '#4EC896'} />
        <StatCard icon={<Users size={18} />} label="Active Trades" value={`${activeTradesCount}`} color="#3A7BC8" />
        <StatCard icon={<Layers size={18} />} label="Tracked Phases" value={`${twinPhases.length}`} color="#F47820" />
      </div>

      {emptyState && (
        <div
          style={{
            padding: spacing['6'],
            marginBottom: spacing['5'],
            background: colors.surfaceRaised,
            border: '1px solid ' + colors.borderSubtle,
            borderRadius: borderRadius.xl,
            color: colors.textSecondary,
            fontSize: typography.fontSize.body,
          }}
        >
          No schedule phases found for this project yet — add phases on the Schedule page to see the 4D twin animate.
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: spacing['5'],
          height: isFullscreen ? 'calc(100vh - 200px)' : '640px',
          transition: `height ${transitions.smooth}`,
        }}
      >
        {show3D && (
          <div
            style={{
              flex: viewMode === '3d' ? 1 : 0.6,
              display: 'flex',
              flexDirection: 'column',
              background: colors.surfaceRaised,
              border: '1px solid ' + colors.borderSubtle,
              borderRadius: borderRadius.xl,
              overflow: 'hidden',
              position: 'relative',
              minWidth: 0,
            }}
          >
            <div
              ref={containerRef}
              style={{
                flex: 1,
                minHeight: 0,
                cursor: 'grab',
              }}
            />

            <div
              style={{
                position: 'absolute',
                top: spacing['3'],
                left: spacing['3'],
                display: 'flex',
                flexDirection: 'column',
                gap: spacing['1.5'],
                padding: spacing['3'],
                background: 'rgba(0,0,0,0.6)',
                borderRadius: borderRadius.md,
                backdropFilter: 'blur(8px)',
              }}
            >
              {(Object.keys(STATUS_COLORS) as unknown as PhaseStatus[]).map((status) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: STATUS_COLORS[status],
                    }}
                  />
                  <span style={{ fontSize: typography.fontSize.caption, color: '#ccc', textTransform: 'capitalize' }}>
                    {status.replace('-', ' ')}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: `${spacing['3']} ${spacing['4']}`,
                background: 'rgba(0,0,0,0.4)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
              }}
            >
              <button
                onClick={() => setTimelineDay(0)}
                title="Go to start"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ccc',
                  cursor: 'pointer',
                  padding: spacing['1'],
                  display: 'flex',
                }}
              >
                <SkipBack size={16} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? 'Pause' : 'Play'}
                style={{
                  background: isPlaying ? 'rgba(244,120,32,0.3)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: isPlaying ? '#F47820' : '#fff',
                  cursor: 'pointer',
                  padding: spacing['2'],
                  borderRadius: borderRadius.full,
                  display: 'flex',
                  transition: `all ${transitions.quick}`,
                }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                onClick={() => setTimelineDay(totalDays)}
                title="Go to end"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ccc',
                  cursor: 'pointer',
                  padding: spacing['1'],
                  display: 'flex',
                }}
              >
                <SkipForward size={16} />
              </button>
              <input
                type="range"
                min={0}
                max={totalDays}
                value={timelineDay}
                onChange={(e) => {
                  setTimelineDay(Number(e.target.value));
                  setIsPlaying(false);
                }}
                style={{
                  flex: 1,
                  accentColor: '#F47820',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: typography.fontSize.caption, color: '#aaa', whiteSpace: 'nowrap', minWidth: 90, textAlign: 'right' }}>
                {formatDate(currentDate)}, {currentDate.getFullYear()}
              </span>
            </div>
          </div>
        )}

        {showTimeline && (
          <div
            style={{
              flex: viewMode === 'timeline' ? 1 : 0.4,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['4'],
              overflow: 'auto',
              minWidth: 0,
            }}
          >
            <div
              style={{
                background: colors.surfaceRaised,
                border: '1px solid ' + colors.borderSubtle,
                borderRadius: borderRadius.xl,
                padding: spacing['4'],
                flex: '0 0 auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
                <Layers size={16} style={{ color: '#F47820' }} />
                <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  Schedule Phases
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {phaseStatusesNow.slice(0, 30).map(({ phase, status }) => {
                  const statusColor = STATUS_COLORS[status];
                  const isActive = status === 'in-progress' || status === 'behind';
                  const planned = Math.max(1, daysBetween(phase.plannedStart, phase.plannedEnd));
                  const elapsed = Math.max(0, daysBetween(phase.plannedStart, currentDate));
                  const plannedPct = Math.min(100, Math.round((elapsed / planned) * 100));

                  return (
                    <div
                      key={phase.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing['3'],
                        padding: `${spacing['2.5']} ${spacing['3']}`,
                        background: isActive ? statusColor + '0a' : 'transparent',
                        border: isActive ? `1px solid ${statusColor}25` : '1px solid transparent',
                        borderRadius: borderRadius.md,
                        transition: `all ${transitions.quick}`,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: statusColor,
                          flexShrink: 0,
                        }}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: typography.fontSize.sm,
                            fontWeight: typography.fontWeight.medium,
                            color: colors.textPrimary,
                            marginBottom: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {phase.name}
                        </div>
                        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {formatDate(phase.plannedStart)} - {formatDate(phase.plannedEnd)}
                        </div>
                      </div>

                      <div style={{ width: 60, flexShrink: 0 }}>
                        <div
                          style={{
                            height: 4,
                            borderRadius: 2,
                            background: colors.surfaceInset,
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          {compareBaseline && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: `${plannedPct}%`,
                                background: 'rgba(255,255,255,0.15)',
                                borderRadius: 2,
                              }}
                            />
                          )}
                          <div
                            style={{
                              height: '100%',
                              width: `${phase.percentComplete}%`,
                              background: statusColor,
                              borderRadius: 2,
                              transition: `width ${transitions.smooth}`,
                              position: 'relative',
                            }}
                          />
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.semibold,
                          color: statusColor,
                          minWidth: 32,
                          textAlign: 'right',
                        }}
                      >
                        {phase.percentComplete}%
                      </span>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: typography.fontWeight.semibold,
                          color: statusColor,
                          background: statusColor + '18',
                          padding: `2px ${spacing['2']}`,
                          borderRadius: borderRadius.full,
                          textTransform: 'uppercase',
                          letterSpacing: typography.letterSpacing.wider,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {status.replace('-', ' ')}
                      </span>
                    </div>
                  );
                })}

                {phaseStatusesNow.length === 0 && (
                  <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, padding: spacing['3'] }}>
                    No phases in this project.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                background: colors.surfaceRaised,
                border: '1px solid ' + colors.borderSubtle,
                borderRadius: borderRadius.xl,
                padding: spacing['4'],
                flex: '0 0 auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
                <AlertTriangle size={16} style={{ color: '#E05252' }} />
                <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  Deviation Alerts
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {deviations.length === 0 && (
                  <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                    No phases are currently behind their planned pace.
                  </div>
                )}
                {deviations.map((dev) => {
                  const sevColor = dev.daysBehind > 14 ? '#E05252' : dev.daysBehind > 7 ? '#FB923C' : '#3A7BC8';
                  return (
                    <div
                      key={dev.phase.id}
                      style={{
                        padding: spacing['3'],
                        background: sevColor + '08',
                        border: `1px solid ${sevColor}20`,
                        borderRadius: borderRadius.md,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: spacing['1.5'],
                        }}
                      >
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                          {dev.phase.name}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: typography.fontWeight.semibold,
                            color: sevColor,
                            background: sevColor + '18',
                            padding: `2px ${spacing['2']}`,
                            borderRadius: borderRadius.full,
                            textTransform: 'uppercase',
                          }}
                        >
                          {dev.daysBehind}d behind
                        </span>
                      </div>
                      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        {dev.phase.percentComplete}% actual vs {dev.expectedPct}% planned
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: spacing['1'],
                          marginTop: spacing['2'],
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: colors.surfaceInset, overflow: 'hidden', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${dev.expectedPct}%`, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }} />
                          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${dev.phase.percentComplete}%`, background: sevColor, borderRadius: 2 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default DigitalTwinPage;
