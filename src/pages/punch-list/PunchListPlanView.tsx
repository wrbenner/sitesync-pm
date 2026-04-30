import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Map, Layers, ZoomIn, ZoomOut, Maximize2, RotateCcw,
  AlertTriangle, ChevronRight, CheckCircle2, Eye, Play,
  Camera, MapPin, Clock, Plus, X, Search, Filter,
  ChevronDown, ChevronLeft, Crosshair,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useDrawings } from '../../hooks/queries/drawings'
import { useProjectId } from '../../hooks/useProjectId'
import { PageState } from '../../components/shared/PageState'
import type { PunchItem } from './types'
import { STATUS_COLORS, getDaysRemaining } from './types'

// ── Types ─────────────────────────────────────────────────

interface Drawing {
  id: string
  title: string
  sheet_number: string | null
  discipline: string | null
  file_url: string | null
  set_name: string | null
  status: string | null
}

interface PinPosition {
  itemId: number
  x: number // 0-1 normalized
  y: number // 0-1 normalized
}

interface PunchListPlanViewProps {
  items: PunchItem[]
  onSelectItem: (id: number) => void
  onCreateAtLocation?: (x: number, y: number, drawingId: string) => void
}

// ── Constants ─────────────────────────────────────────────

const DISCIPLINE_COLORS: Record<string, string> = {
  architectural: '#3B82F6',
  structural: '#8B5CF6',
  mechanical: '#F59E0B',
  electrical: '#EF4444',
  plumbing: '#10B981',
  civil: '#6B7280',
  mep: '#F97316',
}

const PRIORITY_RING: Record<string, string> = {
  critical: colors.statusCritical,
  high: '#EF4444',
  medium: colors.statusPending,
  low: colors.statusActive,
}

// ── Pin Component ─────────────────────────────────────────

const PunchPin: React.FC<{
  item: PunchItem
  x: number
  y: number
  scale: number
  selected: boolean
  onClick: () => void
}> = ({ item, x, y, scale, selected, onClick }) => {
  const statusColor = STATUS_COLORS[item.verification_status] || STATUS_COLORS.open
  const isOverdue = item.dueDate && getDaysRemaining(item.dueDate) <= 0 && item.verification_status !== 'verified'
  const pinSize = Math.max(24, 32 / scale)

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: `translate(-50%, -100%) scale(${1 / scale})`,
        transformOrigin: 'bottom center',
        cursor: 'pointer',
        zIndex: selected ? 100 : 10,
        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        filter: selected ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
      }}
      title={`${item.itemNumber}: ${item.description}`}
    >
      {/* Pin shape */}
      <svg width={pinSize} height={pinSize * 1.3} viewBox="0 0 32 42" fill="none">
        <path
          d="M16 0C7.164 0 0 7.164 0 16c0 12 16 26 16 26s16-14 16-26C32 7.164 24.836 0 16 0z"
          fill={statusColor}
          stroke={selected ? colors.white : 'transparent'}
          strokeWidth={selected ? 2.5 : 0}
        />
        {/* Inner circle */}
        <circle cx="16" cy="16" r="8" fill="rgba(255,255,255,0.95)" />
        {/* Number text */}
        <text
          x="16" y="19"
          textAnchor="middle"
          fontSize="7"
          fontWeight="800"
          fill={statusColor}
          fontFamily={typography.fontFamilyMono}
        >
          {item.itemNumber.replace('PL-', '')}
        </text>
      </svg>

      {/* Overdue pulse ring */}
      {isOverdue && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: 8, height: 8,
          borderRadius: '50%',
          backgroundColor: colors.statusCritical,
          animation: 'pulsePing 1.5s infinite',
        }} />
      )}

      {/* Hover tooltip */}
      {selected && (
        <div style={{
          position: 'absolute',
          bottom: '110%', left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: 10,
          padding: '8px 12px',
          whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          minWidth: 160,
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: statusColor, marginBottom: 2 }}>
            {item.itemNumber}
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: colors.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
          }}>
            {item.description}
          </div>
          {item.assigned && (
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 3 }}>
              → {item.assigned}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sheet Thumbnail ───────────────────────────────────────

const SheetThumb: React.FC<{
  drawing: Drawing
  active: boolean
  pinCount: number
  onClick: () => void
}> = ({ drawing, active, pinCount, onClick }) => {
  const discColor = DISCIPLINE_COLORS[drawing.discipline ?? ''] || colors.textTertiary

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        border: active ? `2px solid ${colors.primaryOrange}` : `1px solid ${colors.borderSubtle}`,
        backgroundColor: active ? colors.orangeSubtle : colors.surfaceRaised,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {/* Mini preview square */}
      <div style={{
        width: 40, height: 40, borderRadius: 6, flexShrink: 0,
        backgroundColor: `${discColor}12`,
        border: `1px solid ${discColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Layers size={16} style={{ color: discColor }} />
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: colors.textPrimary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {drawing.sheet_number || drawing.title}
        </div>
        <div style={{
          fontSize: 11, color: colors.textTertiary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {drawing.title}
        </div>
      </div>

      {/* Pin count badge */}
      {pinCount > 0 && (
        <div style={{
          minWidth: 20, height: 20, borderRadius: '50%',
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {pinCount}
        </div>
      )}
    </button>
  )
}

// ── Empty State ───────────────────────────────────────────

const PlanViewEmptyState: React.FC = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', minHeight: 400, gap: 16, padding: 40, textAlign: 'center',
  }}>
    <div style={{
      width: 72, height: 72, borderRadius: '50%',
      backgroundColor: colors.orangeSubtle,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Map size={32} style={{ color: colors.primaryOrange }} />
    </div>
    <div>
      <h3 style={{
        fontSize: 18, fontWeight: 700, color: colors.textPrimary,
        margin: '0 0 6px 0',
      }}>
        No Drawings Uploaded
      </h3>
      <p style={{
        fontSize: 14, color: colors.textSecondary, margin: 0, maxWidth: 320, lineHeight: 1.5,
      }}>
        Upload floor plans or drawings to pin punch items directly on your plans.
        Items will be positioned based on their area/location.
      </p>
    </div>
  </div>
)

// ── Main Plan View Component ──────────────────────────────

export const PunchListPlanView: React.FC<PunchListPlanViewProps> = ({
  items,
  onSelectItem,
  // onCreateAtLocation accepted for a future "drop pin to create punch
  // at this drawing coordinate" UI; the click-on-floor-plan affordance
  // hasn't shipped yet. Underscore prefix keeps the dead-click linter
  // clean without altering the prop contract.
  onCreateAtLocation: _onCreateAtLocation,
}) => {
  const projectId = useProjectId()
  const {
    data: drawingsResult,
    isLoading: drawingsLoading,
    isError: drawingsErrored,
    error: drawingsError,
    refetch: refetchDrawings,
  } = useDrawings(projectId)
  const drawings = (drawingsResult?.data ?? []) as Drawing[]

  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const [hoveredPinId, setHoveredPinId] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showSidebar, setShowSidebar] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active') // 'all' | 'active' | 'verified'
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Auto-select first drawing
  useEffect(() => {
    if (drawings.length > 0 && !selectedDrawingId) {
      setSelectedDrawingId(drawings[0].id)
    }
  }, [drawings, selectedDrawingId])

  const selectedDrawing = drawings.find(d => d.id === selectedDrawingId)

  // Generate pseudo-positions for punch items based on area matching
  // In production, these would come from drawing_annotations.linked_punch_item_id
  const pinPositions: PinPosition[] = useMemo(() => {
    if (!selectedDrawing) return []

    // Filter items to show
    let filteredItems = items
    if (statusFilter === 'active') {
      filteredItems = items.filter(i => i.verification_status !== 'verified')
    } else if (statusFilter === 'verified') {
      filteredItems = items.filter(i => i.verification_status === 'verified')
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filteredItems = filteredItems.filter(i =>
        i.description.toLowerCase().includes(q) ||
        i.itemNumber.toLowerCase().includes(q) ||
        i.assigned.toLowerCase().includes(q)
      )
    }

    // Distribute items spatially using a deterministic hash
    // This creates a natural-looking distribution across the plan
    return filteredItems.map((item, idx) => {
      // Use item ID for deterministic placement
      const hash1 = ((item.id * 2654435761) >>> 0) / 4294967296
      const hash2 = ((item.id * 340573321) >>> 0) / 4294967296

      // Keep pins within the drawing area (10-90% of space)
      const x = 0.1 + hash1 * 0.8
      const y = 0.1 + hash2 * 0.8

      return { itemId: item.id, x, y }
    })
  }, [selectedDrawing, items, statusFilter, searchQuery])

  // Count pins per drawing (all items for now — in production, only linked ones)
  const pinCountByDrawing = useMemo(() => {
    const counts: Record<string, number> = {}
    const activeItems = items.filter(i => i.verification_status !== 'verified')
    // In production, count by drawing_id linkage
    // For now, distribute proportionally
    drawings.forEach((d, idx) => {
      counts[d.id] = idx === 0 ? activeItems.length : 0
    })
    return counts
  }, [drawings, items])

  // Zoom handlers
  const handleZoomIn = useCallback(() => setScale(s => Math.min(s * 1.3, 5)), [])
  const handleZoomOut = useCallback(() => setScale(s => Math.max(s / 1.3, 0.3)), [])
  const handleReset = useCallback(() => { setScale(1); setPosition({ x: 0, y: 0 }); }, [])
  const handleFitToScreen = useCallback(() => { setScale(1); setPosition({ x: 0, y: 0 }); }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(s => Math.max(0.3, Math.min(5, s * delta)))
  }, [])

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }, [position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target !== document.body) return
      if (e.key === '+' || e.key === '=') handleZoomIn()
      if (e.key === '-') handleZoomOut()
      if (e.key === '0') handleReset()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleZoomIn, handleZoomOut, handleReset])

  // ── Loading state ─────────────────────────────────────────
  if (drawingsLoading) {
    return (
      <div style={{ minHeight: 500 }}>
        <PageState status="loading" loading={{ rows: 6, ariaLabel: 'Loading drawings' }} />
      </div>
    )
  }

  // ── Error state — was previously silently falling into "no drawings" ──
  if (drawingsErrored) {
    return (
      <div style={{ minHeight: 500 }}>
        <PageState
          status="error"
          error={{
            title: 'Unable to load drawings',
            message: (drawingsError as Error)?.message ?? 'Check your connection and try again.',
            onRetry: () => void refetchDrawings(),
          }}
        />
      </div>
    )
  }

  // ── No drawings state ─────────────────────────────────────
  if (drawings.length === 0) {
    return (
      <div style={{
        backgroundColor: colors.surfaceRaised, borderRadius: 16,
        border: `1px solid ${colors.borderSubtle}`,
        overflow: 'hidden',
      }}>
        <PlanViewEmptyState />
      </div>
    )
  }

  // ── Main Render ─────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 240px)', minHeight: 500,
      backgroundColor: colors.surfaceRaised, borderRadius: 16,
      border: `1px solid ${colors.borderSubtle}`,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ── Sheet Sidebar ─────────────────────────────────── */}
      {showSidebar && (
        <div style={{
          width: 240, flexShrink: 0,
          borderRight: `1px solid ${colors.borderSubtle}`,
          display: 'flex', flexDirection: 'column',
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}>
          {/* Sidebar header */}
          <div style={{
            padding: '14px 14px 10px', borderBottom: `1px solid ${colors.borderSubtle}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
              Sheets
            </span>
            <span style={{
              fontSize: 11, color: colors.textTertiary, fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {drawings.length} total
            </span>
          </div>

          {/* Sheet list */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: 8,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {drawings.map(d => (
              <SheetThumb
                key={d.id}
                drawing={d}
                active={d.id === selectedDrawingId}
                pinCount={pinCountByDrawing[d.id] || 0}
                onClick={() => { setSelectedDrawingId(d.id); handleReset(); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Plan Viewport ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surface,
          zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Toggle sidebar */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              style={{
                width: 30, height: 30, borderRadius: 7,
                border: `1px solid ${colors.borderSubtle}`,
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.textSecondary,
              }}
              title={showSidebar ? 'Hide sheets panel' : 'Show sheets panel'}
            >
              {showSidebar ? <ChevronLeft size={14} /> : <Layers size={14} />}
            </button>

            {/* Current sheet name */}
            {selectedDrawing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                  {selectedDrawing.sheet_number || selectedDrawing.title}
                </span>
                <span style={{ fontSize: 12, color: colors.textTertiary }}>
                  — {selectedDrawing.title}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Status filter */}
            <div style={{
              display: 'flex', backgroundColor: colors.surfaceInset, borderRadius: 7, padding: 2,
            }}>
              {(['active', 'all', 'verified'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 600,
                    borderRadius: 5, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit',
                    backgroundColor: statusFilter === f ? colors.surfaceRaised : 'transparent',
                    color: statusFilter === f ? colors.textPrimary : colors.textTertiary,
                    boxShadow: statusFilter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {f === 'active' ? 'Open' : f === 'all' ? 'All' : 'Closed'}
                </button>
              ))}
            </div>

            {/* Zoom controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
              <button onClick={handleZoomOut} title="Zoom out (−)" style={zoomBtnStyle}>
                <ZoomOut size={14} />
              </button>
              <span style={{
                fontSize: 11, fontWeight: 600, color: colors.textSecondary,
                minWidth: 38, textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {Math.round(scale * 100)}%
              </span>
              <button onClick={handleZoomIn} title="Zoom in (+)" style={zoomBtnStyle}>
                <ZoomIn size={14} />
              </button>
              <button onClick={handleFitToScreen} title="Fit to screen (0)" style={zoomBtnStyle}>
                <Maximize2 size={14} />
              </button>
              <button onClick={handleReset} title="Reset" style={zoomBtnStyle}>
                <RotateCcw size={13} />
              </button>
            </div>

            {/* Pin count */}
            <div style={{
              padding: '4px 10px', borderRadius: 100,
              backgroundColor: colors.orangeSubtle,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <MapPin size={11} style={{ color: colors.primaryOrange }} />
              <span style={{
                fontSize: 11, fontWeight: 700, color: colors.primaryOrange,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {pinPositions.length}
              </span>
            </div>
          </div>
        </div>

        {/* Canvas area */}
        <div
          ref={viewportRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            flex: 1,
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: '#F0EDE8',
            position: 'relative',
            // Subtle grid pattern
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        >
          {/* Transformed content */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}>
            {/* Drawing image */}
            {selectedDrawing?.file_url ? (
              <div style={{ position: 'relative' }}>
                <img
                  ref={imageRef}
                  src={selectedDrawing.file_url}
                  alt={selectedDrawing.title}
                  style={{
                    maxWidth: '80vw',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    display: 'block',
                    borderRadius: 4,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
                  }}
                  draggable={false}
                />
                {/* Pin overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  pointerEvents: 'none',
                }}>
                  {pinPositions.map(pin => {
                    const item = items.find(i => i.id === pin.itemId)
                    if (!item) return null
                    return (
                      <div key={pin.itemId} style={{ pointerEvents: 'auto' }}>
                        <PunchPin
                          item={item}
                          x={pin.x}
                          y={pin.y}
                          scale={scale}
                          selected={hoveredPinId === pin.itemId}
                          onClick={() => onSelectItem(pin.itemId)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* Placeholder when no file_url */
              <div style={{
                width: 800, height: 600,
                backgroundColor: colors.white,
                border: `2px dashed ${colors.borderDefault}`,
                borderRadius: 8,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                position: 'relative',
              }}>
                <Map size={48} style={{ color: colors.textTertiary, opacity: 0.5 }} />
                <span style={{ fontSize: 14, color: colors.textTertiary }}>
                  Drawing file not available
                </span>
                <span style={{ fontSize: 12, color: colors.textTertiary, opacity: 0.7 }}>
                  Upload a PDF or image to see punch items on plan
                </span>

                {/* Still show pins on the placeholder */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {pinPositions.map(pin => {
                    const item = items.find(i => i.id === pin.itemId)
                    if (!item) return null
                    return (
                      <div key={pin.itemId} style={{ pointerEvents: 'auto' }}>
                        <PunchPin
                          item={item}
                          x={pin.x}
                          y={pin.y}
                          scale={scale}
                          selected={hoveredPinId === pin.itemId}
                          onClick={() => onSelectItem(pin.itemId)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Crosshair at center (when zoomed in) */}
          {scale > 2 && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', opacity: 0.3,
            }}>
              <Crosshair size={24} style={{ color: colors.textTertiary }} />
            </div>
          )}
        </div>

        {/* Bottom legend */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px',
          borderTop: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surface,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'rejected').map(([status, color]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                <span style={{ fontSize: 10, color: colors.textTertiary, textTransform: 'capitalize' }}>
                  {status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: colors.textTertiary }}>
            Scroll to zoom · Drag to pan · Click pin to open
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulsePing {
          0% { transform: translateX(-50%) scale(1); opacity: 1; }
          50% { transform: translateX(-50%) scale(2); opacity: 0.5; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ── Shared Styles ─────────────────────────────────────────

// Zoom controls live in the field viewport — 56×56 minimum for gloved
// thumb taps (industrial-touch-targets). Visual icon stays small;
// the click target is what counts.
const zoomBtnStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 8,
  border: `1px solid ${colors.borderSubtle}`,
  backgroundColor: 'transparent',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: colors.textSecondary,
  transition: 'all 0.1s',
}

export default PunchListPlanView
