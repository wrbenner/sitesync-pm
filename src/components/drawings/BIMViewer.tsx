import React, { useState, useRef, useMemo, useCallback, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import { Layers, RotateCcw, Eye } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface ElementInfo {
  id: string
  type: string
  material: string
  dimensions: string
  floor: string
  layer: string
}

interface BuildingProps {
  layers: Record<string, boolean>
  exploded: boolean
  xray: boolean
  onSelectElement: (info: ElementInfo | null) => void
  selectedId: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
  id: string,
  type: string,
  material: string,
  dimensions: string,
  floor: string,
  layer: string,
): ElementInfo {
  return { id, type, material, dimensions, floor, layer }
}

// ── Animated Floor Group ───────────────────────────────────────────────────

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

// ── Selectable Mesh ────────────────────────────────────────────────────────

const SelectableMesh: React.FC<{
  info: ElementInfo
  selectedId: string | null
  onSelect: (info: ElementInfo | null) => void
  xray: boolean
  color: string
  position: [number, number, number]
  geometry: THREE.BufferGeometry
  opacity?: number
}> = ({ info, selectedId, onSelect, xray, color, position, geometry, opacity = 1 }) => {
  const isSelected = selectedId === info.id
  const meshRef = useRef<THREE.Mesh>(null!)

  const mat = useMemo(() => {
    const baseOpacity = xray ? 0.3 : opacity
    const col = isSelected ? colors.primaryOrange : color
    return new THREE.MeshStandardMaterial({
      color: col,
      transparent: baseOpacity < 1 || xray,
      opacity: baseOpacity,
      emissive: isSelected ? colors.primaryOrange : '#000000',
      emissiveIntensity: isSelected ? 0.3 : 0,
      side: THREE.DoubleSide,
    })
  }, [xray, isSelected, color, opacity])

  const handleClick = useCallback(
    (e: React.MouseEvent<MouseEvent>) => {
      e.stopPropagation()
      onSelect(isSelected ? null : info)
    },
    [info, isSelected, onSelect],
  )

  return (
    <mesh
      ref={meshRef}
      position={position}
      geometry={geometry}
      material={mat}
      onClick={handleClick}
      castShadow
      receiveShadow
    />
  )
}

// ── Columns via InstancedMesh ──────────────────────────────────────────────

const ColumnGrid: React.FC<{
  floorIndex: number
  xray: boolean
  selectedId: string | null
  onSelect: (info: ElementInfo | null) => void
}> = ({ floorIndex, xray, selectedId, onSelect }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const colGeo = useMemo(() => new THREE.CylinderGeometry(0.2, 0.2, FLOOR_HEIGHT, 12), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colPositions = useMemo(() => {
    const positions: [number, number, number][] = []
    for (let ix = 0; ix < 4; ix++) {
      for (let iz = 0; iz < 3; iz++) {
        const x = -12 + ix * 8
        const z = -7 + iz * 7
        const y = floorIndex * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25
        positions.push([x, y, z])
      }
    }
    return positions
  }, [floorIndex])

  useFrame(() => {
    if (!meshRef.current) return
    colPositions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  const mat = useMemo(() => {
    const baseOpacity = xray ? 0.3 : 1
    return new THREE.MeshStandardMaterial({
      color: layerColors.structure,
      transparent: xray,
      opacity: baseOpacity,
    })
  }, [xray])

  // Invisible click targets for each column
  const clickTargets = colPositions.map(([x, y, z], i) => {
    const id = `col-f${floorIndex}-${i}`
    const isSelected = selectedId === id
    const clickMat = new THREE.MeshStandardMaterial({
      color: isSelected ? colors.primaryOrange : layerColors.structure,
      emissive: isSelected ? colors.primaryOrange : '#000000',
      emissiveIntensity: isSelected ? 0.3 : 0,
      transparent: true,
      opacity: isSelected ? 1 : 0,
    })
    return (
      <mesh
        key={id}
        position={[x, y, z]}
        geometry={colGeo}
        material={clickMat}
        onClick={(e: React.MouseEvent<MouseEvent>) => {
          e.stopPropagation()
          const info = makeElementInfo(
            id,
            'Steel Column',
            'W14x30 Steel',
            '0.4m dia x 3.5m H',
            `Floor ${floorIndex + 1}`,
            'structure',
          )
          onSelect(isSelected ? null : info)
        }}
      />
    )
  })

  return (
    <>
      <instancedMesh ref={meshRef} args={[colGeo, mat, 12]} castShadow />
      {clickTargets}
    </>
  )
}

// ── Sample Building ────────────────────────────────────────────────────────

const SampleBuilding: React.FC<BuildingProps> = ({
  layers,
  exploded,
  xray,
  onSelectElement,
  selectedId,
}) => {
  // Geometries (memoized)
  const foundationGeo = useMemo(() => new THREE.BoxGeometry(30, 0.5, 20), [])
  const floorPlateGeo = useMemo(() => new THREE.BoxGeometry(30, 0.2, 20), [])
  const roofGeo = useMemo(() => new THREE.BoxGeometry(31, 0.3, 21), [])

  // Wall geometries per side
  const wallFrontGeo = useMemo(() => new THREE.BoxGeometry(30, FLOOR_HEIGHT, 0.15), [])
  const wallBackGeo = useMemo(() => new THREE.BoxGeometry(30, FLOOR_HEIGHT, 0.15), [])
  const wallLeftGeo = useMemo(() => new THREE.BoxGeometry(0.15, FLOOR_HEIGHT, 20), [])
  const wallRightGeo = useMemo(() => new THREE.BoxGeometry(0.15, FLOOR_HEIGHT, 20), [])

  // MEP geometries
  const ductGeo = useMemo(() => new THREE.BoxGeometry(20, 0.4, 0.4), [])
  const pipeGeo = useMemo(() => new THREE.CylinderGeometry(0.08, 0.08, 10, 8), [])
  const conduitGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.04, 18, 6), [])

  return (
    <group>
      {/* Foundation */}
      {layers.foundation && (
        <FloorGroup floorIndex={0} exploded={exploded}>
          <SelectableMesh
            info={makeElementInfo('foundation', 'Foundation Slab', 'Reinforced Concrete (4000 psi)', '30m x 20m x 0.5m', 'Ground', 'foundation')}
            selectedId={selectedId}
            onSelect={onSelectElement}
            xray={xray}
            color={layerColors.foundation}
            position={[0, 0, 0]}
            geometry={foundationGeo}
          />
        </FloorGroup>
      )}

      {/* Floors */}
      {Array.from({ length: FLOOR_COUNT }).map((_, fi) => (
        <React.Fragment key={`floor-${fi}`}>
          {/* Structure: columns + floor plates */}
          {layers.structure && (
            <FloorGroup floorIndex={fi + 1} exploded={exploded}>
              <ColumnGrid
                floorIndex={fi}
                xray={xray}
                selectedId={selectedId}
                onSelect={onSelectElement}
              />
              <SelectableMesh
                info={makeElementInfo(
                  `floorplate-${fi}`,
                  'Floor Plate',
                  'Composite Metal Deck',
                  '30m x 20m x 0.2m',
                  `Floor ${fi + 1}`,
                  'structure',
                )}
                selectedId={selectedId}
                onSelect={onSelectElement}
                xray={xray}
                color={layerColors.floorplate}
                position={[0, (fi + 1) * FLOOR_HEIGHT, 0]}
                geometry={floorPlateGeo}
                opacity={0.9}
              />
            </FloorGroup>
          )}

          {/* Walls */}
          {layers.walls && (
            <FloorGroup floorIndex={fi + 1} exploded={exploded}>
              {/* Front */}
              <SelectableMesh
                info={makeElementInfo(`wall-front-${fi}`, 'Exterior Wall (Front)', 'Curtain Wall Glass', '30m x 3.5m x 0.15m', `Floor ${fi + 1}`, 'walls')}
                selectedId={selectedId}
                onSelect={onSelectElement}
                xray={xray}
                color={layerColors.walls}
                position={[0, fi * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25, 10]}
                geometry={wallFrontGeo}
                opacity={0.8}
              />
              {/* Back */}
              <SelectableMesh
                info={makeElementInfo(`wall-back-${fi}`, 'Exterior Wall (Back)', 'Curtain Wall Glass', '30m x 3.5m x 0.15m', `Floor ${fi + 1}`, 'walls')}
                selectedId={selectedId}
                onSelect={onSelectElement}
                xray={xray}
                color={layerColors.walls}
                position={[0, fi * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25, -10]}
                geometry={wallBackGeo}
                opacity={0.8}
              />
              {/* Left */}
              <SelectableMesh
                info={makeElementInfo(`wall-left-${fi}`, 'Exterior Wall (Left)', 'Curtain Wall Glass', '0.15m x 3.5m x 20m', `Floor ${fi + 1}`, 'walls')}
                selectedId={selectedId}
                onSelect={onSelectElement}
                xray={xray}
                color={layerColors.walls}
                position={[-15, fi * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25, 0]}
                geometry={wallLeftGeo}
                opacity={0.8}
              />
              {/* Right */}
              <SelectableMesh
                info={makeElementInfo(`wall-right-${fi}`, 'Exterior Wall (Right)', 'Curtain Wall Glass', '0.15m x 3.5m x 20m', `Floor ${fi + 1}`, 'walls')}
                selectedId={selectedId}
                onSelect={onSelectElement}
                xray={xray}
                color={layerColors.walls}
                position={[15, fi * FLOOR_HEIGHT + FLOOR_HEIGHT / 2 + 0.25, 0]}
                geometry={wallRightGeo}
                opacity={0.8}
              />
            </FloorGroup>
          )}

          {/* MEP: HVAC ducts */}
          {layers.mep && (
            <FloorGroup floorIndex={fi + 1} exploded={exploded}>
              <SelectableMesh
                info={makeElementInfo(`duct-main-${fi}`, 'HVAC Supply Duct', 'Galvanized Sheet Metal', '20m x 0.4m x 0.4m', `Floor ${fi + 1}`, 'mep')}
                selectedId={selectedId}
                onSelect={onSelectElement}
                xray={xray}
                color={layerColors.mepHvac}
                position={[0, fi * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.85, 3]}
                geometry={ductGeo}
              />
              <SelectableMesh
                info={makeElementInfo(`duct-return-${fi}`, 'HVAC Return Duct', 'Galvanized Sheet Metal', '20m x 0.4m x 0.4m', `Floor ${fi + 1}`, 'mep')}
                selectedId={selectedId}
                onSelect={onSelectElement}
                xray={xray}
                color={layerColors.mepHvac}
                position={[0, fi * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.85, -3]}
                geometry={ductGeo}
              />
            </FloorGroup>
          )}

          {/* MEP: Electrical conduit */}
          {layers.mep && (
            <FloorGroup floorIndex={fi + 1} exploded={exploded}>
              <mesh
                position={[5, fi * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.7, 0]}
                rotation={[0, 0, Math.PI / 2]}
                geometry={conduitGeo}
                onClick={(e: React.MouseEvent<MouseEvent>) => {
                  e.stopPropagation()
                  onSelectElement(
                    makeElementInfo(
                      `conduit-${fi}`,
                      'Electrical Conduit',
                      'EMT Conduit',
                      '18m x 0.08m dia',
                      `Floor ${fi + 1}`,
                      'mep',
                    ),
                  )
                }}
              >
                <meshStandardMaterial
                  color={selectedId === `conduit-${fi}` ? colors.primaryOrange : layerColors.mepElectrical}
                  transparent={xray}
                  opacity={xray ? 0.3 : 1}
                  emissive={selectedId === `conduit-${fi}` ? colors.primaryOrange : '#000000'}
                  emissiveIntensity={selectedId === `conduit-${fi}` ? 0.3 : 0}
                />
              </mesh>
            </FloorGroup>
          )}
        </React.Fragment>
      ))}

      {/* MEP: Plumbing risers (vertical, span all floors) */}
      {layers.mep && (
        <group>
          {[-8, -4, 4, 8].map((xPos, i) => (
            <mesh
              key={`pipe-${i}`}
              position={[xPos, 5, -8]}
              geometry={pipeGeo}
              onClick={(e: React.MouseEvent<MouseEvent>) => {
                e.stopPropagation()
                onSelectElement(
                  makeElementInfo(
                    `pipe-${i}`,
                    'Plumbing Riser',
                    'Copper Type L',
                    '0.16m dia x 10m H',
                    'All Floors',
                    'mep',
                  ),
                )
              }}
            >
              <meshStandardMaterial
                color={selectedId === `pipe-${i}` ? colors.primaryOrange : layerColors.mepPlumbing}
                transparent={xray}
                opacity={xray ? 0.3 : 1}
                emissive={selectedId === `pipe-${i}` ? colors.primaryOrange : '#000000'}
                emissiveIntensity={selectedId === `pipe-${i}` ? 0.3 : 0}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Roof */}
      {layers.roof && (
        <FloorGroup floorIndex={FLOOR_COUNT + 1} exploded={exploded}>
          <SelectableMesh
            info={makeElementInfo('roof', 'Roof Assembly', 'TPO Membrane on Steel Deck', '31m x 21m x 0.3m', 'Roof', 'roof')}
            selectedId={selectedId}
            onSelect={onSelectElement}
            xray={xray}
            color={layerColors.roof}
            position={[0, FLOOR_COUNT * FLOOR_HEIGHT + 0.4, 0]}
            geometry={roofGeo}
          />
        </FloorGroup>
      )}
    </group>
  )
}

// ── Loading Spinner ────────────────────────────────────────────────────────

const LoadingSpinner: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #E8F0FE 0%, #FFFFFF 100%)',
      gap: spacing['3'],
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        border: `3px solid ${colors.borderDefault}`,
        borderTopColor: colors.primaryOrange,
        borderRadius: '50%',
        animation: 'bimSpin 0.8s linear infinite',
      }}
    />
    <span
      style={{
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        letterSpacing: typography.letterSpacing.wide,
      }}
    >
      Loading 3D Model...
    </span>
    <style>{`@keyframes bimSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

// ── Layer Toggle ───────────────────────────────────────────────────────────

const LayerToggle: React.FC<{
  label: string
  active: boolean
  color: string
  onToggle: () => void
}> = ({ label, active, color, onToggle }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing['2'],
      cursor: 'pointer',
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize.sm,
      color: active ? colors.textPrimary : colors.textTertiary,
      userSelect: 'none',
    }}
  >
    <div
      onClick={onToggle}
      style={{
        width: 16,
        height: 16,
        borderRadius: borderRadius.sm,
        border: `1.5px solid ${active ? color : colors.borderDefault}`,
        backgroundColor: active ? color : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 160ms ease',
        cursor: 'pointer',
      }}
    >
      {active && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
    {label}
  </label>
)

// ── Toolbar Button ─────────────────────────────────────────────────────────

const ToolbarButton: React.FC<{
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing['2'],
      padding: `${spacing['2']} ${spacing['3']}`,
      border: `1px solid ${active ? colors.primaryOrange : colors.borderDefault}`,
      borderRadius: borderRadius.base,
      backgroundColor: active ? colors.orangeSubtle : colors.white,
      color: active ? colors.primaryOrange : colors.textSecondary,
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      cursor: 'pointer',
      transition: 'all 160ms ease',
      whiteSpace: 'nowrap',
    }}
  >
    {icon}
    {label}
  </button>
)

// ── Main BIMViewer Component ───────────────────────────────────────────────

export const BIMViewer: React.FC = () => {
  const [layers, setLayers] = useState<Record<string, boolean>>({
    structure: true,
    mep: true,
    walls: true,
    roof: true,
    foundation: true,
  })
  const [exploded, setExploded] = useState(false)
  const [xray, setXray] = useState(false)
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null)

  const toggleLayer = useCallback((key: string) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const resetView = useCallback(() => {
    setExploded(false)
    setXray(false)
    setSelectedElement(null)
    setLayers({
      structure: true,
      mep: true,
      walls: true,
      roof: true,
      foundation: true,
    })
  }, [])

  const layerConfig = [
    { key: 'structure', label: 'Structure', color: layerColors.structure },
    { key: 'walls', label: 'Walls', color: '#B0B0B0' },
    { key: 'mep', label: 'MEP Systems', color: layerColors.mepHvac },
    { key: 'roof', label: 'Roof', color: layerColors.roof },
    { key: 'foundation', label: 'Foundation', color: layerColors.foundation },
  ]

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 500, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
      {/* Canvas */}
      <Suspense fallback={<LoadingSpinner />}>
        <Canvas
          camera={{ position: [25, 20, 25], fov: 50 }}
          shadows
          style={{
            width: '100%',
            height: '100%',
            minHeight: 500,
            background: 'linear-gradient(180deg, #E8F0FE 0%, #FFFFFF 100%)',
          }}
          onPointerMissed={() => setSelectedElement(null)}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[15, 20, 10]} intensity={1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.1}
            minDistance={5}
            maxDistance={80}
          />
          <Grid
            position={[0, -0.26, 0]}
            args={[50, 50]}
            cellSize={1}
            cellColor="#ddd"
            sectionSize={5}
            sectionColor="#bbb"
            fadeDistance={60}
          />
          <SampleBuilding
            layers={layers}
            exploded={exploded}
            xray={xray}
            onSelectElement={setSelectedElement}
            selectedId={selectedElement?.id || null}
          />
        </Canvas>
      </Suspense>

      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: spacing['3'],
          left: spacing['3'],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['3'],
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: borderRadius.lg,
          padding: spacing['3'],
          boxShadow: shadows.dropdown,
          backdropFilter: 'blur(8px)',
          maxWidth: 200,
        }}
      >
        {/* Layer section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
          <Layers size={14} color={colors.textSecondary} />
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.widest,
            }}
          >
            Layers
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {layerConfig.map((lc) => (
            <LayerToggle
              key={lc.key}
              label={lc.label}
              active={layers[lc.key]}
              color={lc.color}
              onToggle={() => toggleLayer(lc.key)}
            />
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: colors.borderSubtle }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          <ToolbarButton
            icon={<RotateCcw size={14} />}
            label={exploded ? 'Collapse View' : 'Explode View'}
            active={exploded}
            onClick={() => setExploded(!exploded)}
          />
          <ToolbarButton
            icon={<Eye size={14} />}
            label={xray ? 'Solid' : 'X Ray'}
            active={xray}
            onClick={() => setXray(!xray)}
          />
          <ToolbarButton
            icon={<RotateCcw size={14} />}
            label="Reset View"
            onClick={resetView}
          />
        </div>

        <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing['2'], marginTop: spacing['2'] }}>
          <button
            onClick={() => {
              // Placeholder for Uppy upload integration
              alert('IFC upload coming soon. Supported formats: .ifc, .glb, .gltf')
            }}
            style={{
              width: '100%',
              padding: `${spacing['2']} ${spacing['3']}`,
              backgroundColor: colors.primaryOrange,
              color: 'white',
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
            }}
          >
            Upload IFC Model
          </button>
        </div>
      </div>

      {/* Selection Panel */}
      <div
        style={{
          position: 'absolute',
          top: spacing['3'],
          right: selectedElement ? spacing['3'] : '-320px',
          width: 280,
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: borderRadius.lg,
          padding: spacing['4'],
          boxShadow: shadows.dropdown,
          backdropFilter: 'blur(8px)',
          transition: 'right 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {selectedElement && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <span
                style={{
                  fontFamily: typography.fontFamily,
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: typography.letterSpacing.widest,
                }}
              >
                Element Details
              </span>
              <button
                onClick={() => setSelectedElement(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.textTertiary,
                  fontSize: typography.fontSize.body,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold,
                color: colors.primaryOrange,
                marginBottom: spacing['3'],
                lineHeight: typography.lineHeight.snug,
              }}
            >
              {selectedElement.type}
            </div>

            {[
              { label: 'Material', value: selectedElement.material },
              { label: 'Dimensions', value: selectedElement.dimensions },
              { label: 'Location', value: selectedElement.floor },
              { label: 'Layer', value: selectedElement.layer.charAt(0).toUpperCase() + selectedElement.layer.slice(1) },
              { label: 'Element ID', value: selectedElement.id },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                <span
                  style={{
                    fontFamily: typography.fontFamily,
                    fontSize: typography.fontSize.sm,
                    color: colors.textTertiary,
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontFamily: typography.fontFamily,
                    fontSize: typography.fontSize.sm,
                    color: colors.textPrimary,
                    fontWeight: typography.fontWeight.medium,
                    textAlign: 'right',
                    maxWidth: 160,
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
