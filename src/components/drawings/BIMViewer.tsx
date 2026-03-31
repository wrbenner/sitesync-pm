import React, { useState, useRef, useMemo, useCallback, Suspense, memo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { colors, spacing, typography, borderRadius, shadows, transitions, vizColors } from '../../styles/theme'
import {
  Layers, RotateCcw, Eye, TrendingUp, AlertTriangle, ShieldAlert,
  Calendar, Users, Camera, MapPin, Ruler, Bookmark, Share2, X,
} from 'lucide-react'
import { useDigitalTwin } from '../../hooks/useDigitalTwin'
import {
  RFIPinsLayer,
  SafetyHeatmapLayer,
  CrewLocationLayer,
  PhotoPinLayer,
  MarkupsLayer,
  getProgressColor,
} from './DigitalTwinOverlays'
import type { OverlayLayerId } from '../../types/digitalTwin'
import { OVERLAY_CONFIG, OVERLAY_LAYERS } from '../../types/digitalTwin'

// ── Types ─────────────────────────────────────────────────────

interface ElementInfo {
  id: string
  type: string
  material: string
  dimensions: string
  floor: string
  layer: string
  percentComplete?: number
}

interface BuildingProps {
  layers: Record<string, boolean>
  exploded: boolean
  xray: boolean
  showProgress: boolean
  progressData: Array<{ elementId: string; percentComplete: number; location: string }>
  onSelectElement: (info: ElementInfo | null) => void
  selectedId: string | null
}

// ── Constants ─────────────────────────────────────────────────

const FLOOR_HEIGHT = 3.5
const FLOOR_COUNT = 3
const EXPLODE_GAP = 4

const layerColors: Record<string, string> = {
  foundation: '#8B8680',
  structure: '#6B7B8D',
  floorplate: '#D0D0D0',
  walls: '#F0F0F0',
  mepHvac: '#E05252',
  mepPlumbing: '#4A9EE8',
  mepElectrical: '#E8C84A',
  roof: '#444444',
}

function makeElementInfo(
  id: string, type: string, material: string, dimensions: string, floor: string, layer: string, percentComplete?: number,
): ElementInfo {
  return { id, type, material, dimensions, floor, layer, percentComplete }
}

// ── Animated Floor Group ──────────────────────────────────────

const FloorGroup: React.FC<{
  floorIndex: number
  exploded: boolean
  children: React.ReactNode
}> = ({ floorIndex, exploded, children }) => {
  const groupRef = useRef<THREE.Group>(null!)
  const targetY = exploded ? floorIndex * EXPLODE_GAP : 0

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.08
  })

  return <group ref={groupRef}>{children}</group>
}

// ── Selectable Mesh ───────────────────────────────────────────

const SelectableMesh: React.FC<{
  info: ElementInfo
  selectedId: string | null
  onSelect: (info: ElementInfo | null) => void
  xray: boolean
  color: string
  position: [number, number, number]
  geometry: THREE.BufferGeometry
  opacity?: number
  progressOverride?: string | null
}> = ({ info, selectedId, onSelect, xray, color, position, geometry, opacity = 1, progressOverride }) => {
  const isSelected = selectedId === info.id
  const displayColor = progressOverride || (isSelected ? colors.primaryOrange : color)

  const mat = useMemo(() => {
    const baseOpacity = xray ? 0.3 : opacity
    return new THREE.MeshStandardMaterial({
      color: displayColor,
      transparent: baseOpacity < 1 || xray,
      opacity: baseOpacity,
      emissive: isSelected ? colors.primaryOrange : '#000000',
      emissiveIntensity: isSelected ? 0.3 : 0,
      side: THREE.DoubleSide,
    })
  }, [xray, isSelected, displayColor, opacity])

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      onSelect(isSelected ? null : info)
    },
    [info, isSelected, onSelect],
  )

  return (
    <mesh
      position={position}
      geometry={geometry}
      material={mat}
      onClick={handleClick}
      castShadow
      receiveShadow
    />
  )
}

// ── Column Grid via InstancedMesh ─────────────────────────────

const ColumnGrid: React.FC<{
  floorIndex: number
  xray: boolean
  selectedId: string | null
  onSelect: (info: ElementInfo | null) => void
}> = ({ floorIndex, xray, selectedId, onSelect }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const colGeo = useMemo(() => new THREE.CylinderGeometry(0.2, 0.2, FLOOR_HEIGHT, 12), [])
  const transform = useMemo(() => new THREE.Object3D(), [])
  const colPositions = useMemo(() => {
    const positions: [number, number, number][] = []
    for (let ix = 0; ix < 4; ix++) {
      for (let iz = 0; iz < 3; iz++) {
        positions.push([-12 + ix * 8, floorIndex * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25, -7 + iz * 7])
      }
    }
    return positions
  }, [floorIndex])

  useFrame(() => {
    if (!meshRef.current) return
    colPositions.forEach(([x, y, z], i) => {
      transform.position.set(x, y, z)
      transform.updateMatrix()
      meshRef.current.setMatrixAt(i, transform.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: layerColors.structure, transparent: xray, opacity: xray ? 0.3 : 1 }),
    [xray],
  )

  return (
    <>
      <instancedMesh ref={meshRef} args={[colGeo, mat, 12]} castShadow />
      {colPositions.map(([x, y, z], i) => {
        const id = `col-f${floorIndex}-${i}`
        const isSelected = selectedId === id
        return (
          <mesh
            key={id}
            position={[x, y, z]}
            geometry={colGeo}
            onClick={(e: { stopPropagation: () => void }) => {
              e.stopPropagation()
              onSelect(isSelected ? null : makeElementInfo(id, 'Steel Column', 'W14x30 Steel', '0.4m dia x 3.5m H', `Floor ${floorIndex + 1}`, 'structure'))
            }}
          >
            <meshStandardMaterial color={isSelected ? colors.primaryOrange : layerColors.structure} emissive={isSelected ? colors.primaryOrange : '#000000'} emissiveIntensity={isSelected ? 0.3 : 0} transparent opacity={isSelected ? 1 : 0} />
          </mesh>
        )
      })}
    </>
  )
}

// ── Sample Building ───────────────────────────────────────────

const SampleBuilding: React.FC<BuildingProps> = ({
  layers, exploded, xray, showProgress, progressData, onSelectElement, selectedId,
}) => {
  const foundationGeo = useMemo(() => new THREE.BoxGeometry(30, 0.5, 20), [])
  const floorPlateGeo = useMemo(() => new THREE.BoxGeometry(30, 0.2, 20), [])
  const roofGeo = useMemo(() => new THREE.BoxGeometry(31, 0.3, 21), [])
  const wallFrontGeo = useMemo(() => new THREE.BoxGeometry(30, FLOOR_HEIGHT, 0.15), [])
  const wallBackGeo = useMemo(() => new THREE.BoxGeometry(30, FLOOR_HEIGHT, 0.15), [])
  const wallLeftGeo = useMemo(() => new THREE.BoxGeometry(0.15, FLOOR_HEIGHT, 20), [])
  const wallRightGeo = useMemo(() => new THREE.BoxGeometry(0.15, FLOOR_HEIGHT, 20), [])
  const ductGeo = useMemo(() => new THREE.BoxGeometry(20, 0.4, 0.4), [])
  const pipeGeo = useMemo(() => new THREE.CylinderGeometry(0.08, 0.08, 10, 8), [])
  const conduitGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.04, 18, 6), [])

  // Map progress data to element colors
  const progressColorMap = useMemo(() => {
    if (!showProgress) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const p of progressData) {
      map.set(p.elementId, getProgressColor(p.percentComplete))
    }
    return map
  }, [showProgress, progressData])

  const getColorForElement = useCallback(
    (id: string): string | null => {
      if (!showProgress) return null
      return progressColorMap.get(id) || null
    },
    [showProgress, progressColorMap],
  )

  // Demo progress for floor plates when showProgress is on
  const floorProgress = useMemo(() => [95, 80, 55], [])

  return (
    <group>
      {layers.foundation && (
        <FloorGroup floorIndex={0} exploded={exploded}>
          <SelectableMesh
            info={makeElementInfo('foundation', 'Foundation Slab', 'Reinforced Concrete (4000 psi)', '30m x 20m x 0.5m', 'Ground', 'foundation', 100)}
            selectedId={selectedId} onSelect={onSelectElement} xray={xray}
            color={layerColors.foundation} position={[0, 0, 0]} geometry={foundationGeo}
            progressOverride={getColorForElement('foundation') || (showProgress ? getProgressColor(100) : null)}
          />
        </FloorGroup>
      )}

      {Array.from({ length: FLOOR_COUNT }).map((_, fi) => (
        <React.Fragment key={`floor-${fi}`}>
          {layers.structure && (
            <FloorGroup floorIndex={fi + 1} exploded={exploded}>
              <ColumnGrid floorIndex={fi} xray={xray} selectedId={selectedId} onSelect={onSelectElement} />
              <SelectableMesh
                info={makeElementInfo(`floorplate-${fi}`, 'Floor Plate', 'Composite Metal Deck', '30m x 20m x 0.2m', `Floor ${fi + 1}`, 'structure', floorProgress[fi])}
                selectedId={selectedId} onSelect={onSelectElement} xray={xray}
                color={layerColors.floorplate} position={[0, (fi + 1) * FLOOR_HEIGHT, 0]} geometry={floorPlateGeo} opacity={0.9}
                progressOverride={showProgress ? getProgressColor(floorProgress[fi]) : null}
              />
            </FloorGroup>
          )}

          {layers.walls && (
            <FloorGroup floorIndex={fi + 1} exploded={exploded}>
              {[
                { id: `wall-front-${fi}`, geo: wallFrontGeo, pos: [0, fi * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25, 10] as [number, number, number], label: 'Front' },
                { id: `wall-back-${fi}`, geo: wallBackGeo, pos: [0, fi * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25, -10] as [number, number, number], label: 'Back' },
                { id: `wall-left-${fi}`, geo: wallLeftGeo, pos: [-15, fi * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25, 0] as [number, number, number], label: 'Left' },
                { id: `wall-right-${fi}`, geo: wallRightGeo, pos: [15, fi * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25, 0] as [number, number, number], label: 'Right' },
              ].map((wall) => {
                const wallProgress = fi === 0 ? 90 : fi === 1 ? 60 : 20
                return (
                  <SelectableMesh
                    key={wall.id}
                    info={makeElementInfo(wall.id, `Exterior Wall (${wall.label})`, 'Curtain Wall Glass', '3.5m H', `Floor ${fi + 1}`, 'walls', wallProgress)}
                    selectedId={selectedId} onSelect={onSelectElement} xray={xray}
                    color={layerColors.walls} position={wall.pos} geometry={wall.geo} opacity={0.8}
                    progressOverride={showProgress ? getProgressColor(wallProgress) : null}
                  />
                )
              })}
            </FloorGroup>
          )}

          {layers.mep && (
            <FloorGroup floorIndex={fi + 1} exploded={exploded}>
              <SelectableMesh
                info={makeElementInfo(`duct-main-${fi}`, 'HVAC Supply Duct', 'Galvanized Sheet Metal', '20m x 0.4m x 0.4m', `Floor ${fi + 1}`, 'mep')}
                selectedId={selectedId} onSelect={onSelectElement} xray={xray}
                color={layerColors.mepHvac} position={[0, fi * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.85, 3]} geometry={ductGeo}
              />
              <SelectableMesh
                info={makeElementInfo(`duct-return-${fi}`, 'HVAC Return Duct', 'Galvanized Sheet Metal', '20m x 0.4m x 0.4m', `Floor ${fi + 1}`, 'mep')}
                selectedId={selectedId} onSelect={onSelectElement} xray={xray}
                color={layerColors.mepHvac} position={[0, fi * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.85, -3]} geometry={ductGeo}
              />
              <mesh position={[5, fi * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.7, 0]} rotation={[0, 0, Math.PI / 2]} geometry={conduitGeo}
                onClick={(e: { stopPropagation: () => void }) => {
                  e.stopPropagation()
                  onSelectElement(makeElementInfo(`conduit-${fi}`, 'Electrical Conduit', 'EMT Conduit', '18m x 0.08m dia', `Floor ${fi + 1}`, 'mep'))
                }}
              >
                <meshStandardMaterial color={selectedId === `conduit-${fi}` ? colors.primaryOrange : layerColors.mepElectrical} transparent={xray} opacity={xray ? 0.3 : 1}
                  emissive={selectedId === `conduit-${fi}` ? colors.primaryOrange : '#000000'} emissiveIntensity={selectedId === `conduit-${fi}` ? 0.3 : 0} />
              </mesh>
            </FloorGroup>
          )}
        </React.Fragment>
      ))}

      {layers.mep && (
        <group>
          {[-8, -4, 4, 8].map((xPos, i) => (
            <mesh key={`pipe-${i}`} position={[xPos, 5, -8]} geometry={pipeGeo}
              onClick={(e: { stopPropagation: () => void }) => {
                e.stopPropagation()
                onSelectElement(makeElementInfo(`pipe-${i}`, 'Plumbing Riser', 'Copper Type L', '0.16m dia x 10m H', 'All Floors', 'mep'))
              }}
            >
              <meshStandardMaterial color={selectedId === `pipe-${i}` ? colors.primaryOrange : layerColors.mepPlumbing} transparent={xray} opacity={xray ? 0.3 : 1}
                emissive={selectedId === `pipe-${i}` ? colors.primaryOrange : '#000000'} emissiveIntensity={selectedId === `pipe-${i}` ? 0.3 : 0} />
            </mesh>
          ))}
        </group>
      )}

      {layers.roof && (
        <FloorGroup floorIndex={FLOOR_COUNT + 1} exploded={exploded}>
          <SelectableMesh
            info={makeElementInfo('roof', 'Roof Assembly', 'TPO Membrane on Steel Deck', '31m x 21m x 0.3m', 'Roof', 'roof', 30)}
            selectedId={selectedId} onSelect={onSelectElement} xray={xray}
            color={layerColors.roof} position={[0, FLOOR_COUNT * FLOOR_HEIGHT + 0.4, 0]} geometry={roofGeo}
            progressOverride={showProgress ? getProgressColor(30) : null}
          />
        </FloorGroup>
      )}
    </group>
  )
}

// ── Loading Spinner ───────────────────────────────────────────

const LoadingSpinner: React.FC = () => (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: `linear-gradient(180deg, ${colors.surfaceInset} 0%, ${colors.surfaceRaised} 100%)`, gap: spacing['3'],
  }}>
    <div style={{ width: 40, height: 40, border: `3px solid ${colors.borderDefault}`, borderTopColor: colors.primaryOrange, borderRadius: '50%', animation: 'bimSpin 0.8s linear infinite' }} />
    <span style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Loading 3D Model...</span>
    <style>{`@keyframes bimSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

// ── Overlay Layer Icons ───────────────────────────────────────

const OVERLAY_ICONS: Record<OverlayLayerId, React.ElementType> = {
  progress: TrendingUp,
  rfis: AlertTriangle,
  safety: ShieldAlert,
  schedule: Calendar,
  crews: Users,
  photos: Camera,
}

// ── Main BIMViewer Component ──────────────────────────────────

export const BIMViewer: React.FC = () => {
  const [buildingLayers, setBuildingLayers] = useState<Record<string, boolean>>({
    structure: true, mep: true, walls: true, roof: true, foundation: true,
  })
  const [exploded, setExploded] = useState(false)
  const [xray, setXray] = useState(false)
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null)
  const [showOverlayPanel, setShowOverlayPanel] = useState(true)

  const dt = useDigitalTwin()

  const toggleBuildingLayer = useCallback((key: string) => {
    setBuildingLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const resetView = useCallback(() => {
    setExploded(false)
    setXray(false)
    setSelectedElement(null)
    setBuildingLayers({ structure: true, mep: true, walls: true, roof: true, foundation: true })
  }, [])

  const handlePinSelect = useCallback((id: string, type: OverlayLayerId) => {
    dt.selectPin(dt.selectedPinId === id ? null : id, dt.selectedPinId === id ? null : type)
  }, [dt])

  const buildingLayerConfig = [
    { key: 'structure', label: 'Structure', color: layerColors.structure },
    { key: 'walls', label: 'Walls', color: vizColors.neutral },
    { key: 'mep', label: 'MEP Systems', color: layerColors.mepHvac },
    { key: 'roof', label: 'Roof', color: layerColors.roof },
    { key: 'foundation', label: 'Foundation', color: layerColors.foundation },
  ]

  const progressForBuilding = useMemo(() =>
    dt.progressElements.map((p) => ({
      elementId: p.elementId,
      percentComplete: p.percentComplete,
      location: p.location,
    })),
    [dt.progressElements],
  )

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 500, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
      {/* 3D Canvas */}
      <Suspense fallback={<LoadingSpinner />}>
        <Canvas
          camera={{ position: [25, 20, 25], fov: 50 }}
          shadows
          style={{ width: '100%', height: '100%', minHeight: 500, background: `linear-gradient(180deg, ${colors.surfaceInset} 0%, ${colors.surfaceRaised} 100%)` }}
          onPointerMissed={() => { setSelectedElement(null); dt.selectPin(null, null) }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[15, 20, 10]} intensity={1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.1} minDistance={5} maxDistance={80} />
          <Grid position={[0, -0.26, 0]} args={[50, 50]} cellSize={1} cellColor="#ddd" sectionSize={5} sectionColor="#bbb" fadeDistance={60} />

          {/* Building */}
          <SampleBuilding
            layers={buildingLayers} exploded={exploded} xray={xray}
            showProgress={dt.activeLayers.has('progress')}
            progressData={progressForBuilding}
            onSelectElement={setSelectedElement}
            selectedId={selectedElement?.id || null}
          />

          {/* Overlay Layers */}
          {dt.activeLayers.has('rfis') && (
            <RFIPinsLayer pins={dt.rfiPins} selectedId={dt.selectedPinId} onSelect={(id) => handlePinSelect(id, 'rfis')} />
          )}
          {dt.activeLayers.has('safety') && (
            <SafetyHeatmapLayer zones={dt.safetyZones} />
          )}
          {dt.activeLayers.has('crews') && (
            <CrewLocationLayer crews={dt.crewLocations} selectedId={dt.selectedPinId} onSelect={(id) => handlePinSelect(id, 'crews')} />
          )}
          {dt.activeLayers.has('photos') && (
            <PhotoPinLayer pins={dt.photoPins} selectedId={dt.selectedPinId} onSelect={(id) => handlePinSelect(id, 'photos')} />
          )}
          <MarkupsLayer markups={dt.markups} />
        </Canvas>
      </Suspense>

      {/* ── Left Toolbar: Building Layers ──────────────────── */}
      <div style={{
        position: 'absolute', top: spacing['3'], left: spacing['3'],
        display: 'flex', flexDirection: 'column', gap: spacing['3'],
        backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: borderRadius.lg,
        padding: spacing['3'], boxShadow: shadows.dropdown, backdropFilter: 'blur(8px)', maxWidth: 200,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
          <Layers size={14} color={colors.textSecondary} />
          <span style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest }}>Building</span>
        </div>

        {buildingLayerConfig.map((lc) => (
          <label key={lc.key} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], cursor: 'pointer', fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, color: buildingLayers[lc.key] ? colors.textPrimary : colors.textTertiary, userSelect: 'none' }}>
            <div onClick={() => toggleBuildingLayer(lc.key)} style={{ width: 16, height: 16, borderRadius: borderRadius.sm, border: `1.5px solid ${buildingLayers[lc.key] ? lc.color : colors.borderDefault}`, backgroundColor: buildingLayers[lc.key] ? lc.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `all ${transitions.quick}`, cursor: 'pointer' }}>
              {buildingLayers[lc.key] && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            {lc.label}
          </label>
        ))}

        <div style={{ height: 1, backgroundColor: colors.borderSubtle }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[
            { label: exploded ? 'Collapse' : 'Explode', icon: <RotateCcw size={14} />, active: exploded, onClick: () => setExploded(!exploded) },
            { label: xray ? 'Solid' : 'X Ray', icon: <Eye size={14} />, active: xray, onClick: () => setXray(!xray) },
            { label: 'Reset', icon: <RotateCcw size={14} />, active: false, onClick: resetView },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`,
              border: `1px solid ${btn.active ? colors.primaryOrange : colors.borderDefault}`, borderRadius: borderRadius.base,
              backgroundColor: btn.active ? colors.orangeSubtle : colors.white, color: btn.active ? colors.orangeText : colors.textSecondary,
              fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
              cursor: 'pointer', transition: `all ${transitions.quick}`, whiteSpace: 'nowrap',
            }}>
              {btn.icon} {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right Panel: Data Overlays ─────────────────────── */}
      {showOverlayPanel && (
        <div style={{
          position: 'absolute', top: spacing['3'], right: spacing['3'],
          width: 220, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: borderRadius.lg,
          padding: spacing['3'], boxShadow: shadows.dropdown, backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
            <span style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest }}>
              Data Overlays
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {OVERLAY_LAYERS.map((layerId) => {
              const config = OVERLAY_CONFIG[layerId]
              const Icon = OVERLAY_ICONS[layerId]
              const isActive = dt.activeLayers.has(layerId)
              const accentColor = (colors as Record<string, string>)[config.color] || colors.textTertiary

              return (
                <button
                  key={layerId}
                  onClick={() => dt.toggleLayer(layerId)}
                  aria-label={`Toggle ${config.label} overlay`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['2'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    backgroundColor: isActive ? `${accentColor}12` : 'transparent',
                    border: `1px solid ${isActive ? accentColor : colors.borderSubtle}`,
                    borderRadius: borderRadius.base, cursor: 'pointer',
                    fontFamily: typography.fontFamily, textAlign: 'left',
                    transition: `all ${transitions.quick}`,
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: borderRadius.sm,
                    backgroundColor: isActive ? accentColor : colors.surfaceInset,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: `background-color ${transitions.quick}`,
                  }}>
                    <Icon size={11} color={isActive ? colors.white : colors.textTertiary} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: isActive ? colors.textPrimary : colors.textSecondary }}>{config.label}</p>
                    <p style={{ margin: 0, fontSize: '9px', color: colors.textTertiary, lineHeight: typography.lineHeight.snug }}>{config.description}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Progress Legend */}
          {dt.activeLayers.has('progress') && (
            <div style={{ marginTop: spacing['3'], paddingTop: spacing['3'], borderTop: `1px solid ${colors.borderSubtle}` }}>
              <p style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Progress Legend</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                {[
                  { label: '0%', color: colors.statusCritical },
                  { label: '25%', color: colors.primaryOrange },
                  { label: '50%', color: colors.statusPending },
                  { label: '75%', color: vizColors.success2 },
                  { label: '100%', color: colors.statusActive },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <div style={{ width: 12, height: 12, borderRadius: borderRadius.sm, backgroundColor: item.color }} />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom: Timeline Slider ────────────────────────── */}
      {dt.activeLayers.has('schedule') && (
        <div style={{
          position: 'absolute', bottom: spacing['3'], left: spacing['3'], right: spacing['3'],
          backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: borderRadius.lg,
          padding: `${spacing['3']} ${spacing['4']}`, boxShadow: shadows.dropdown, backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <Calendar size={14} color={colors.statusInfo} />
            <span style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, flexShrink: 0 }}>
              Timeline
            </span>
            <span style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, flexShrink: 0, minWidth: 90 }}>
              {new Date(dt.timeline.currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <input
              type="range"
              min={new Date(dt.timeline.projectStart).getTime()}
              max={new Date(dt.timeline.projectEnd).getTime()}
              value={new Date(dt.timeline.currentDate).getTime()}
              onChange={(e) => {
                const date = new Date(parseInt(e.target.value)).toISOString().split('T')[0]
                dt.setTimelineDate(date)
              }}
              aria-label="Timeline date slider"
              style={{ flex: 1, accentColor: colors.primaryOrange, cursor: 'pointer' }}
            />
            <span style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.caption, color: colors.textTertiary, flexShrink: 0 }}>
              {dt.scheduleElements.filter((e) => e.isBehind).length} behind
            </span>
          </div>
        </div>
      )}

      {/* ── Element Detail Panel ───────────────────────────── */}
      {selectedElement && !showOverlayPanel && (
        <div style={{
          position: 'absolute', top: spacing['3'], right: spacing['3'], width: 280,
          backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: borderRadius.lg,
          padding: spacing['4'], boxShadow: shadows.dropdown, backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
            <span style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest }}>Element Details</span>
            <button onClick={() => setSelectedElement(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.body, padding: 0, lineHeight: 1 }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, marginBottom: spacing['3'], lineHeight: typography.lineHeight.snug }}>{selectedElement.type}</div>
          {[
            { label: 'Material', value: selectedElement.material },
            { label: 'Dimensions', value: selectedElement.dimensions },
            { label: 'Location', value: selectedElement.floor },
            { label: 'Layer', value: selectedElement.layer.charAt(0).toUpperCase() + selectedElement.layer.slice(1) },
            ...(selectedElement.percentComplete != null ? [{ label: 'Progress', value: `${selectedElement.percentComplete}%` }] : []),
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <span style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{row.label}</span>
              <span style={{ fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, textAlign: 'right', maxWidth: 160 }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Toggle overlay panel button (when hidden) ──────── */}
      {!showOverlayPanel && (
        <button
          onClick={() => setShowOverlayPanel(true)}
          aria-label="Show data overlays"
          style={{
            position: 'absolute', top: spacing['3'], right: spacing['3'],
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: borderRadius.base,
            boxShadow: shadows.dropdown, cursor: 'pointer', backdropFilter: 'blur(8px)',
          }}
        >
          <TrendingUp size={16} color={colors.textSecondary} />
        </button>
      )}
    </div>
  )
}
