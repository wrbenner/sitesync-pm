// ── Digital Twin 3D Overlay Components ─────────────────────────
// These components render INSIDE the Three.js Canvas and provide
// visual overlays for project data on top of the BIM model.

import React, { useMemo, useRef, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { colors, spacing, typography, borderRadius, shadows, vizColors, tradeColors } from '../../styles/theme'
import type {
  RFIPin,
  SafetyZone,
  CrewLocation,
  PhotoPin,
  Markup3D,
} from '../../types/digitalTwin'

// ── Progress Color Helper ─────────────────────────────────────

export function getProgressColor(percent: number): string {
  if (percent >= 100) return colors.statusActive
  if (percent >= 75) return vizColors.success2
  if (percent >= 50) return colors.statusPending
  if (percent >= 25) return colors.primaryOrange
  return colors.statusCritical
}

// ── RFI Pin Markers ───────────────────────────────────────────

interface RFIPinMarkerProps {
  pin: RFIPin
  isSelected: boolean
  onSelect: (id: string) => void
}

const RFIPinMarker = memo<RFIPinMarkerProps>(({ pin, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const baseY = useRef(pin.position.y)

  const pinColor = pin.isOverdue
    ? colors.statusCritical
    : pin.status === 'answered'
      ? colors.statusActive
      : colors.primaryOrange

  // Gentle bobbing animation
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.position.y = baseY.current + Math.sin(clock.elapsedTime * 2 + pin.position.x) * 0.15
  })

  const geo = useMemo(() => new THREE.SphereGeometry(0.3, 16, 16), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: pinColor,
        emissive: pinColor,
        emissiveIntensity: isSelected ? 0.8 : 0.3,
      }),
    [pinColor, isSelected],
  )

  return (
    <group>
      {/* Pin sphere */}
      <mesh
        ref={meshRef}
        position={[pin.position.x, pin.position.y, pin.position.z]}
        geometry={geo}
        material={mat}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(pin.id)
        }}
      />

      {/* Vertical line to ground */}
      <Line
        points={[
          [pin.position.x, 0, pin.position.z],
          [pin.position.x, pin.position.y - 0.3, pin.position.z],
        ]}
        color={pinColor}
        lineWidth={1}
        opacity={0.4}
        transparent
      />

      {/* Label */}
      {isSelected && (
        <Html
          position={[pin.position.x, pin.position.y + 0.8, pin.position.z]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              backgroundColor: colors.panelBg,
              borderRadius: borderRadius.md,
              padding: `${spacing['2']} ${spacing['3']}`,
              boxShadow: shadows.dropdown,
              minWidth: 160,
              fontFamily: typography.fontFamily,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                color: pinColor,
                marginBottom: spacing['1'],
              }}
            >
              {pin.rfiNumber}
            </div>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textPrimary,
                fontWeight: typography.fontWeight.medium,
                marginBottom: spacing['1'],
                lineHeight: typography.lineHeight.snug,
              }}
            >
              {pin.subject}
            </div>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {pin.daysOpen} days open
              {pin.isOverdue && (
                <span style={{ color: colors.statusCritical, fontWeight: typography.fontWeight.semibold }}>
                  {' '}· Overdue
                </span>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
})
RFIPinMarker.displayName = 'RFIPinMarker'

// ── RFI Pins Layer ────────────────────────────────────────────

export const RFIPinsLayer = memo<{
  pins: RFIPin[]
  selectedId: string | null
  onSelect: (id: string) => void
}>(({ pins, selectedId, onSelect }) => (
  <group>
    {pins.map((pin) => (
      <RFIPinMarker
        key={pin.id}
        pin={pin}
        isSelected={selectedId === pin.id}
        onSelect={onSelect}
      />
    ))}
  </group>
))
RFIPinsLayer.displayName = 'RFIPinsLayer'

// ── Safety Heatmap Zones ──────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  low: colors.statusPending,
  medium: colors.primaryOrange,
  high: colors.statusCritical,
  critical: colors.chartRed,
}

export const SafetyHeatmapLayer = memo<{ zones: SafetyZone[] }>(({ zones }) => (
  <group>
    {zones.map((zone) => {
      const zoneColor = SEVERITY_COLORS[zone.severity] || colors.statusCritical
      return (
        <group key={zone.id}>
          {/* Ground disc */}
          <mesh
            position={[zone.center.x, 0.05, zone.center.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[zone.radius, 32]} />
            <meshStandardMaterial
              color={zoneColor}
              transparent
              opacity={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Vertical cylinder (subtle) */}
          <mesh position={[zone.center.x, zone.center.y, zone.center.z]}>
            <cylinderGeometry args={[zone.radius, zone.radius, 0.1, 32]} />
            <meshStandardMaterial
              color={zoneColor}
              transparent
              opacity={0.15}
            />
          </mesh>

          {/* Incident count label */}
          <Html
            position={[zone.center.x, zone.center.y + zone.radius + 0.5, zone.center.z]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                backgroundColor: zoneColor,
                color: colors.white,
                borderRadius: borderRadius.full,
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.bold,
                fontFamily: typography.fontFamily,
                boxShadow: `0 2px 8px ${zoneColor}80`,
              }}
            >
              {zone.incidentCount}
            </div>
          </Html>
        </group>
      )
    })}
  </group>
))
SafetyHeatmapLayer.displayName = 'SafetyHeatmapLayer'

// ── Crew Location Dots ────────────────────────────────────────

const TRADE_COLORS: Record<string, string> = {
  Concrete: tradeColors.concrete,
  Electrical: tradeColors.electrical,
  Plumbing: tradeColors.plumbing,
  'Structural Steel': tradeColors.structural,
  Mechanical: tradeColors.mechanical,
  Drywall: tradeColors.finishing,
  Painting: tradeColors.painting,
  General: tradeColors.general,
}

const CrewDot = memo<{
  crew: CrewLocation
  isSelected: boolean
  onSelect: (id: string) => void
}>(({ crew, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const tradeColor = TRADE_COLORS[crew.trade] || TRADE_COLORS.General

  // Pulse animation
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.1
    meshRef.current.scale.setScalar(isSelected ? scale * 1.3 : scale)
  })

  const geo = useMemo(() => new THREE.SphereGeometry(0.25, 12, 12), [])

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[crew.position.x, crew.position.y, crew.position.z]}
        geometry={geo}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(crew.id)
        }}
      >
        <meshStandardMaterial
          color={tradeColor}
          emissive={tradeColor}
          emissiveIntensity={isSelected ? 0.6 : 0.2}
        />
      </mesh>

      {/* Label */}
      <Html
        position={[crew.position.x, crew.position.y + 0.6, crew.position.z]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            backgroundColor: colors.overlayHeavy,
            color: colors.white,
            borderRadius: borderRadius.sm,
            padding: `${spacing['0.5']} ${spacing['2']}`,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            whiteSpace: 'nowrap',
            borderLeft: `2px solid ${tradeColor}`,
          }}
        >
          {crew.crewName} ({crew.headcount})
        </div>
      </Html>

      {/* Detail card when selected */}
      {isSelected && (
        <Html
          position={[crew.position.x, crew.position.y + 1.5, crew.position.z]}
          center
        >
          <div
            style={{
              backgroundColor: colors.panelBg,
              borderRadius: borderRadius.md,
              padding: spacing['3'],
              boxShadow: shadows.dropdown,
              minWidth: 180,
              fontFamily: typography.fontFamily,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                marginBottom: spacing['1'],
              }}
            >
              {crew.crewName}
            </div>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Trade: {crew.trade} · {crew.headcount} workers
            </div>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Foreman: {crew.foreman}
            </div>
            {crew.currentTask && (
              <div
                style={{
                  fontSize: typography.fontSize.caption,
                  color: colors.statusInfo,
                  marginTop: spacing['1'],
                }}
              >
                Task: {crew.currentTask}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
})
CrewDot.displayName = 'CrewDot'

export const CrewLocationLayer = memo<{
  crews: CrewLocation[]
  selectedId: string | null
  onSelect: (id: string) => void
}>(({ crews, selectedId, onSelect }) => (
  <group>
    {crews.map((crew) => (
      <CrewDot
        key={crew.id}
        crew={crew}
        isSelected={selectedId === crew.id}
        onSelect={onSelect}
      />
    ))}
  </group>
))
CrewLocationLayer.displayName = 'CrewLocationLayer'

// ── Photo Pin Layer ───────────────────────────────────────────

const PhotoPinMarker = memo<{
  pin: PhotoPin
  isSelected: boolean
  onSelect: (id: string) => void
}>(({ pin, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null!)

  const geo = useMemo(() => {
    // Camera-shaped icon (box with lens bump)
    const shape = new THREE.BoxGeometry(0.4, 0.3, 0.15)
    return shape
  }, [])

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[pin.position.x, pin.position.y, pin.position.z]}
        geometry={geo}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(pin.id)
        }}
      >
        <meshStandardMaterial
          color={colors.statusPending}
          emissive={colors.statusPending}
          emissiveIntensity={isSelected ? 0.6 : 0.2}
        />
      </mesh>

      {/* Photo tooltip */}
      {isSelected && (
        <Html
          position={[pin.position.x, pin.position.y + 0.8, pin.position.z]}
          center
        >
          <div
            style={{
              backgroundColor: colors.panelBg,
              borderRadius: borderRadius.md,
              padding: spacing['2'],
              boxShadow: shadows.dropdown,
              minWidth: 200,
              fontFamily: typography.fontFamily,
              backdropFilter: 'blur(8px)',
            }}
          >
            {pin.thumbnailUrl && (
              <img
                src={pin.thumbnailUrl}
                alt="Site photo"
                style={{
                  width: '100%',
                  height: 100,
                  objectFit: 'cover',
                  borderRadius: borderRadius.sm,
                  marginBottom: spacing['2'],
                }}
              />
            )}
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {new Date(pin.takenAt).toLocaleDateString()} · {pin.takenBy}
            </div>
            {pin.description && (
              <div
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textPrimary,
                  marginTop: spacing['1'],
                }}
              >
                {pin.description}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
})
PhotoPinMarker.displayName = 'PhotoPinMarker'

export const PhotoPinLayer = memo<{
  pins: PhotoPin[]
  selectedId: string | null
  onSelect: (id: string) => void
}>(({ pins, selectedId, onSelect }) => (
  <group>
    {pins.map((pin) => (
      <PhotoPinMarker
        key={pin.id}
        pin={pin}
        isSelected={selectedId === pin.id}
        onSelect={onSelect}
      />
    ))}
  </group>
))
PhotoPinLayer.displayName = 'PhotoPinLayer'

// ── 3D Markup Rendering ───────────────────────────────────────

export const MarkupsLayer = memo<{ markups: Markup3D[] }>(({ markups }) => (
  <group>
    {markups.map((markup) => {
      if (markup.type === 'pin') {
        return (
          <group key={markup.id}>
            <mesh position={[markup.position.x, markup.position.y, markup.position.z]}>
              <coneGeometry args={[0.2, 0.5, 8]} />
              <meshStandardMaterial color={markup.color} />
            </mesh>
            {markup.label && (
              <Html
                position={[markup.position.x, markup.position.y + 0.8, markup.position.z]}
                center
                style={{ pointerEvents: 'none' }}
              >
                <div
                  style={{
                    backgroundColor: colors.overlayHeavy,
                    color: colors.white,
                    borderRadius: borderRadius.sm,
                    padding: `${spacing['0.5']} ${spacing['2']}`,
                    fontSize: typography.fontSize.caption,
                    fontFamily: typography.fontFamily,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {markup.label}
                </div>
              </Html>
            )}
          </group>
        )
      }

      if (markup.type === 'dimension' && markup.endPosition) {
        return (
          <group key={markup.id}>
            <Line
              points={[
                [markup.position.x, markup.position.y, markup.position.z],
                [markup.endPosition.x, markup.endPosition.y, markup.endPosition.z],
              ]}
              color={markup.color}
              lineWidth={2}
            />
            {/* Midpoint label */}
            <Html
              position={[
                (markup.position.x + markup.endPosition.x) / 2,
                (markup.position.y + markup.endPosition.y) / 2 + 0.3,
                (markup.position.z + markup.endPosition.z) / 2,
              ]}
              center
              style={{ pointerEvents: 'none' }}
            >
              <div
                style={{
                  backgroundColor: markup.color,
                  color: colors.white,
                  borderRadius: borderRadius.sm,
                  padding: `${spacing['0.5']} ${spacing['2']}`,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                }}
              >
                {markup.label}
              </div>
            </Html>
          </group>
        )
      }

      if (markup.type === 'cloud') {
        return (
          <mesh
            key={markup.id}
            position={[markup.position.x, markup.position.y, markup.position.z]}
          >
            <torusGeometry args={[1.2, 0.08, 8, 32]} />
            <meshStandardMaterial
              color={markup.color}
              transparent
              opacity={0.6}
            />
          </mesh>
        )
      }

      return null
    })}
  </group>
))
MarkupsLayer.displayName = 'MarkupsLayer'
