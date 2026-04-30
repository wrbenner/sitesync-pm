import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { FC } from 'react'
import {
  MousePointer2,
  Circle as CircleIcon,
  Square,
  MoveUpRight,
  Pencil,
  Type,
  Undo2,
  Redo2,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  Canvas as FabricCanvas,
  Circle,
  Rect,
  Line,
  Group,
  Triangle,
  PencilBrush,
  IText,
  FabricImage,
  FabricObject,
  Point,
} from 'fabric'
import type { TPointerEventInfo } from 'fabric'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'

// ── Types ────────────────────────────────────────────────

export interface AnnotationData {
  id: string
  type: 'circle' | 'rect' | 'arrow' | 'freehand' | 'text'
  data: Record<string, unknown>
  color: string
  createdAt: string
  createdBy?: string
}

type Tool = 'select' | 'circle' | 'rect' | 'arrow' | 'freehand' | 'text'

export interface PhotoAnnotationProps {
  imageUrl: string
  annotations?: AnnotationData[]
  onSave?: (annotations: AnnotationData[]) => void
  readOnly?: boolean
  width?: number
  height?: number
}

// ── Constants ────────────────────────────────────────────

const ANNOTATION_COLORS = [
  { label: 'Red', value: '#EF4444' },
  { label: 'Yellow', value: '#EAB308' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Black', value: '#1A1A1A' },
] as const

const TOOLS: { id: Tool; label: string; icon: React.ReactNode; shortcut?: string }[] = [
  { id: 'select', label: 'Select / Move', icon: <MousePointer2 size={18} />, shortcut: 'V' },
  { id: 'circle', label: 'Circle', icon: <CircleIcon size={18} />, shortcut: 'C' },
  { id: 'rect', label: 'Rectangle', icon: <Square size={18} />, shortcut: 'R' },
  { id: 'arrow', label: 'Arrow', icon: <MoveUpRight size={18} />, shortcut: 'A' },
  { id: 'freehand', label: 'Freehand Draw', icon: <Pencil size={18} />, shortcut: 'D' },
  { id: 'text', label: 'Text Callout', icon: <Type size={18} />, shortcut: 'T' },
]

const MIN_ZOOM = 0.25
const MAX_ZOOM = 5
const ZOOM_STEP = 0.2

// Custom property keys stored on fabric objects
const CUSTOM_PROPS = ['_annotationType', '_annotationColor', '_annotationId'] as const

// ── Helpers ──────────────────────────────────────────────

function uid(): string {
  return `ann_${crypto.randomUUID().replace(/-/g, '').slice(0, 9)}`
}

function getMeta(obj: FabricObject, key: string): unknown {
  return (obj as unknown as Record<string, unknown>)[key]
}

function setMeta(obj: FabricObject, key: string, value: unknown) {
  ;(obj as unknown as Record<string, unknown>)[key] = value
}

function getAnnotationType(obj: FabricObject): AnnotationData['type'] {
  const custom = getMeta(obj, '_annotationType') as AnnotationData['type'] | undefined
  if (custom) return custom
  if (obj instanceof Circle) return 'circle'
  if (obj instanceof Rect) return 'rect'
  if (obj instanceof Group) return 'arrow'
  if (obj instanceof IText) return 'text'
  return 'freehand'
}

function getAnnotationColor(obj: FabricObject): string {
  return (getMeta(obj, '_annotationColor') as string) || (obj.stroke as string) || '#EF4444'
}

function getAnnotationId(obj: FabricObject): string {
  return (getMeta(obj, '_annotationId') as string) || uid()
}

/** Tag a fabric object with annotation metadata */
function tagObject(obj: FabricObject, type: AnnotationData['type'], color: string, id?: string) {
  setMeta(obj, '_annotationType', type)
  setMeta(obj, '_annotationColor', color)
  setMeta(obj, '_annotationId', id ?? uid())
}

/** Create an arrow (line + triangle head) as a Group */
function createArrow(x1: number, y1: number, x2: number, y2: number, color: string): Group {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  const line = new Line([0, 0, len, 0], {
    stroke: color,
    strokeWidth: 3,
    strokeLineCap: 'round',
  })

  const head = new Triangle({
    width: 16,
    height: 16,
    fill: color,
    left: len - 8,
    top: -8,
    angle: 90,
    originX: 'center',
    originY: 'center',
  })

  const group = new Group([line, head], {
    left: x1,
    top: y1,
    angle,
    originX: 'left',
    originY: 'center',
  })
  tagObject(group, 'arrow', color)
  return group
}

// ── Styles ───────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing['2'],
  padding: `${spacing['2']} ${spacing['3']}`,
  background: colors.surfaceRaised,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`,
  boxShadow: shadows.sm,
  flexWrap: 'wrap',
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize.sm,
  userSelect: 'none',
}

const separatorStyle: React.CSSProperties = {
  width: '1px',
  height: '24px',
  background: colors.borderDefault,
  margin: `0 ${spacing['1']}`,
  flexShrink: 0,
}

function btnStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: active ? `2px solid ${colors.primaryOrange}` : `1px solid ${colors.borderSubtle}`,
    borderRadius: borderRadius.base,
    background: active ? colors.orangeSubtle : colors.surfaceRaised,
    color: active ? colors.primaryOrange : colors.textPrimary,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: transitions.quick,
    padding: 0,
    outline: 'none',
  }
}

function colorSwatchStyle(color: string, active: boolean): React.CSSProperties {
  return {
    width: '22px',
    height: '22px',
    borderRadius: borderRadius.full,
    background: color,
    border: active
      ? `2.5px solid ${colors.primaryOrange}`
      : `1.5px solid ${colors.borderDefault}`,
    cursor: 'pointer',
    transition: transitions.quick,
    boxShadow: active ? `0 0 0 2px ${colors.orangeSubtle}` : 'none',
    flexShrink: 0,
  }
}

const canvasWrapperStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: `0 0 ${borderRadius.md} ${borderRadius.md}`,
  border: `1px solid ${colors.borderSubtle}`,
  borderTop: 'none',
  background: '#1a1a1a',
  touchAction: 'none',
}

// ── Component ────────────────────────────────────────────

export const PhotoAnnotation: FC<PhotoAnnotationProps> = ({
  imageUrl,
  annotations,
  onSave,
  readOnly = false,
  width: propWidth,
  height: propHeight,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)

  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [activeColor, setActiveColor] = useState('#EF4444')
  const [zoomLevel, setZoomLevel] = useState(1)
  // Force re-render when history changes (for button disabled states)
  const [, setHistoryTick] = useState(0)

  // History for undo / redo
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const isRestoringRef = useRef(false)

  // Drawing state for shape creation
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)
  const drawObjRef = useRef<FabricObject | null>(null)

  // Track container size
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({
    w: propWidth ?? 800,
    h: propHeight ?? 600,
  })

  // ── History helpers ─────────────────────────────────────

  const bumpHistoryTick = useCallback(() => {
    setHistoryTick((t) => t + 1)
  }, [])

  const saveHistory = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || isRestoringRef.current) return
    const json = JSON.stringify(canvas.toJSON([...CUSTOM_PROPS]))
    const idx = historyIndexRef.current
    // Trim future history if we've undone
    historyRef.current = historyRef.current.slice(0, idx + 1)
    historyRef.current.push(json)
    historyIndexRef.current = historyRef.current.length - 1
    bumpHistoryTick()
  }, [bumpHistoryTick])

  const restoreHistory = useCallback(
    (index: number) => {
      const canvas = fabricRef.current
      if (!canvas) return
      const json = historyRef.current[index]
      if (!json) return
      isRestoringRef.current = true
      canvas.loadFromJSON(json).then(() => {
        canvas.renderAll()
        historyIndexRef.current = index
        isRestoringRef.current = false
        bumpHistoryTick()
      })
    },
    [bumpHistoryTick],
  )

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      restoreHistory(historyIndexRef.current - 1)
    }
  }, [restoreHistory])

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      restoreHistory(historyIndexRef.current + 1)
    }
  }, [restoreHistory])

  // ── Serialize annotations ──────────────────────────────

  const serializeAnnotations = useCallback((): AnnotationData[] => {
    const canvas = fabricRef.current
    if (!canvas) return []
    const objects = canvas.getObjects()
    return objects
      .filter((obj) => getMeta(obj, '_annotationType'))
      .map((obj) => ({
        id: getAnnotationId(obj),
        type: getAnnotationType(obj),
        data: obj.toObject([...CUSTOM_PROPS]) as Record<string, unknown>,
        color: getAnnotationColor(obj),
        createdAt: new Date().toISOString(),
      }))
  }, [])

  const handleSave = useCallback(() => {
    if (onSave) onSave(serializeAnnotations())
  }, [onSave, serializeAnnotations])

  const handleClearAll = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const objs = canvas.getObjects().filter((o) => getMeta(o, '_annotationType'))
    objs.forEach((o) => canvas.remove(o))
    canvas.discardActiveObject()
    canvas.renderAll()
    saveHistory()
  }, [saveHistory])

  // ── Zoom helpers ───────────────────────────────────────

  const setZoom = useCallback((newZoom: number) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))
    const center = new Point(canvas.getWidth() / 2, canvas.getHeight() / 2)
    canvas.zoomToPoint(center, clamped)
    setZoomLevel(clamped)
  }, [])

  const zoomIn = useCallback(() => setZoom(zoomLevel + ZOOM_STEP), [setZoom, zoomLevel])
  const zoomOut = useCallback(() => setZoom(zoomLevel - ZOOM_STEP), [setZoom, zoomLevel])

  // ── Tool activation ────────────────────────────────────

  const activateTool = useCallback(
    (tool: Tool) => {
      const canvas = fabricRef.current
      if (!canvas) return
      setActiveTool(tool)

      // Reset canvas modes
      canvas.isDrawingMode = false
      canvas.selection = tool === 'select'
      canvas.defaultCursor = tool === 'select' ? 'default' : 'crosshair'

      canvas.forEachObject((obj) => {
        if (getMeta(obj, '_annotationType')) {
          obj.selectable = tool === 'select'
          obj.evented = tool === 'select'
        }
      })

      if (tool === 'freehand') {
        canvas.isDrawingMode = true
        const brush = new PencilBrush(canvas)
        brush.color = activeColor
        brush.width = 3
        canvas.freeDrawingBrush = brush
      }
    },
    [activeColor],
  )

  // ── Initialize fabric canvas ───────────────────────────

  useEffect(() => {
    const canvasEl = canvasElRef.current
    if (!canvasEl || fabricRef.current) return

    const canvas = new FabricCanvas(canvasEl, {
      width: containerSize.w,
      height: containerSize.h,
      backgroundColor: '#222',
      selection: true,
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas

    // Load background image
    FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img) => {
      if (!img || !fabricRef.current) return
      const cw = containerSize.w
      const ch = containerSize.h
      const iw = img.width ?? cw
      const ih = img.height ?? ch
      const scale = Math.min(cw / iw, ch / ih)
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (cw - iw * scale) / 2,
        top: (ch - ih * scale) / 2,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
      })
      canvas.insertAt(0, img)
      canvas.renderAll()

      // Load initial annotations if provided
      if (annotations?.length) {
        annotations.forEach((ann) => {
          FabricObject.fromObject(ann.data).then((obj) => {
            tagObject(obj, ann.type, ann.color, ann.id)
            if (readOnly) {
              obj.selectable = false
              obj.evented = false
            }
            canvas.add(obj)
            canvas.renderAll()
          }).catch(() => {
            // Skip malformed annotations silently
          })
        })
      }

      // Save initial history state
      saveHistory()
    })

    if (readOnly) {
      canvas.selection = false
      canvas.defaultCursor = 'default'
    }

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl])

  // ── Mouse event handlers for shape drawing ─────────────

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || readOnly) return

    const handleMouseDown = (opt: TPointerEventInfo) => {
      if (activeTool === 'select' || activeTool === 'freehand') return
      const pointer = opt.scenePoint

      if (activeTool === 'text') {
        const text = new IText('Text', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'Inter, sans-serif',
          fontSize: 20,
          fill: activeColor,
          stroke: activeColor === '#FFFFFF' || activeColor === '#EAB308' ? '#000' : undefined,
          strokeWidth: activeColor === '#FFFFFF' || activeColor === '#EAB308' ? 0.5 : 0,
          editable: true,
        })
        tagObject(text, 'text', activeColor)
        canvas.add(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        canvas.renderAll()
        drawStartRef.current = null
        saveHistory()
        return
      }

      drawStartRef.current = { x: pointer.x, y: pointer.y }

      let obj: FabricObject | null = null
      if (activeTool === 'circle') {
        obj = new Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 1,
          fill: 'transparent',
          stroke: activeColor,
          strokeWidth: 3,
          originX: 'center',
          originY: 'center',
        })
        tagObject(obj, 'circle', activeColor)
      } else if (activeTool === 'rect') {
        obj = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 1,
          height: 1,
          fill: 'transparent',
          stroke: activeColor,
          strokeWidth: 3,
        })
        tagObject(obj, 'rect', activeColor)
      } else if (activeTool === 'arrow') {
        obj = createArrow(pointer.x, pointer.y, pointer.x + 1, pointer.y + 1, activeColor)
      }

      if (obj) {
        canvas.add(obj)
        drawObjRef.current = obj
        canvas.renderAll()
      }
    }

    const handleMouseMove = (opt: TPointerEventInfo) => {
      if (!drawStartRef.current || !drawObjRef.current) return
      const pointer = opt.scenePoint
      const { x: sx, y: sy } = drawStartRef.current
      const obj = drawObjRef.current

      if (activeTool === 'circle') {
        const radius = Math.sqrt((pointer.x - sx) ** 2 + (pointer.y - sy) ** 2) / 2
        const cx = (sx + pointer.x) / 2
        const cy = (sy + pointer.y) / 2
        ;(obj as Circle).set({ radius, left: cx, top: cy })
      } else if (activeTool === 'rect') {
        const left = Math.min(sx, pointer.x)
        const top = Math.min(sy, pointer.y)
        ;(obj as Rect).set({
          left,
          top,
          width: Math.abs(pointer.x - sx),
          height: Math.abs(pointer.y - sy),
        })
      } else if (activeTool === 'arrow') {
        canvas.remove(obj)
        const arrow = createArrow(sx, sy, pointer.x, pointer.y, activeColor)
        canvas.add(arrow)
        drawObjRef.current = arrow
      }
      canvas.renderAll()
    }

    const handleMouseUp = () => {
      if (drawObjRef.current) {
        drawObjRef.current = null
        drawStartRef.current = null
        saveHistory()
      }
    }

    const handlePathCreated = () => {
      // Tag freehand path after PencilBrush creates it
      const objs = canvas.getObjects()
      const last = objs[objs.length - 1]
      if (last && !getMeta(last, '_annotationType')) {
        tagObject(last, 'freehand', activeColor)
      }
      saveHistory()
    }

    const handleObjectModified = () => {
      saveHistory()
    }

    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)
    canvas.on('path:created', handlePathCreated)
    canvas.on('object:modified', handleObjectModified)

    return () => {
      canvas.off('mouse:down', handleMouseDown)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', handleMouseUp)
      canvas.off('path:created', handlePathCreated)
      canvas.off('object:modified', handleObjectModified)
    }
  }, [activeTool, activeColor, readOnly, saveHistory])

  // ── Update freehand brush color when color changes ─────

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || activeTool !== 'freehand') return
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = activeColor
    }
  }, [activeColor, activeTool])

  // ── Keyboard shortcuts ─────────────────────────────────

  useEffect(() => {
    if (readOnly) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Don't intercept keys when typing in text inputs or IText
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      // Delete selected object
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canvas = fabricRef.current
        if (!canvas) return
        const active = canvas.getActiveObject()
        // Don't delete if editing text
        if (active instanceof IText && active.isEditing) return
        if (active && getMeta(active, '_annotationType')) {
          e.preventDefault()
          canvas.remove(active)
          canvas.discardActiveObject()
          canvas.renderAll()
          saveHistory()
        }
      }

      // Ctrl+Z / Cmd+Z = undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }

      // Escape = deselect
      if (e.key === 'Escape') {
        const canvas = fabricRef.current
        if (!canvas) return
        canvas.discardActiveObject()
        canvas.renderAll()
        activateTool('select')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [readOnly, undo, redo, saveHistory, activateTool])

  // ── ResizeObserver for responsive sizing ───────────────

  useEffect(() => {
    const container = containerRef.current
    if (!container || propWidth) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        if (width > 0) {
          const h = propHeight ?? Math.min(width * 0.75, 700)
          setContainerSize({ w: width, h })
          const canvas = fabricRef.current
          if (canvas) {
            canvas.setDimensions({ width, height: h })
            canvas.renderAll()
          }
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [propWidth, propHeight])

  // ── Render ─────────────────────────────────────────────

  const canW = propWidth ?? containerSize.w
  const canH = propHeight ?? containerSize.h

  return (
    <div
      ref={containerRef}
      style={{
        width: propWidth ? `${propWidth}px` : '100%',
        fontFamily: typography.fontFamily,
      }}
    >
      {/* Toolbar */}
      {!readOnly && (
        <div style={toolbarStyle} role="toolbar" aria-label="Annotation tools">
          {/* Drawing tools */}
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
              aria-label={t.label}
              aria-pressed={activeTool === t.id}
              style={btnStyle(activeTool === t.id, false)}
              onClick={() => activateTool(t.id)}
            >
              {t.icon}
            </button>
          ))}

          <div style={separatorStyle} aria-hidden="true" />

          {/* Color picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1.5'] }} role="radiogroup" aria-label="Annotation color">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                aria-label={`${c.label} color`}
                aria-checked={activeColor === c.value}
                role="radio"
                style={colorSwatchStyle(c.value, activeColor === c.value)}
                onClick={() => setActiveColor(c.value)}
              />
            ))}
          </div>

          <div style={separatorStyle} aria-hidden="true" />

          {/* Undo / Redo */}
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={historyIndexRef.current <= 0}
            style={btnStyle(false, historyIndexRef.current <= 0)}
            onClick={undo}
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={historyIndexRef.current >= historyRef.current.length - 1}
            style={btnStyle(false, historyIndexRef.current >= historyRef.current.length - 1)}
            onClick={redo}
          >
            <Redo2 size={18} />
          </button>

          <div style={separatorStyle} aria-hidden="true" />

          {/* Zoom */}
          <button
            type="button"
            title="Zoom Out"
            aria-label="Zoom out"
            disabled={zoomLevel <= MIN_ZOOM}
            style={btnStyle(false, zoomLevel <= MIN_ZOOM)}
            onClick={zoomOut}
          >
            <ZoomOut size={18} />
          </button>
          <span
            style={{
              fontSize: typography.fontSize.label,
              color: colors.textSecondary,
              minWidth: '40px',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-label={`Zoom level: ${Math.round(zoomLevel * 100)}%`}
          >
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            title="Zoom In"
            aria-label="Zoom in"
            disabled={zoomLevel >= MAX_ZOOM}
            style={btnStyle(false, zoomLevel >= MAX_ZOOM)}
            onClick={zoomIn}
          >
            <ZoomIn size={18} />
          </button>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Clear All */}
          <button
            type="button"
            title="Clear All Annotations"
            aria-label="Clear all annotations"
            style={{
              ...btnStyle(false, false),
              width: 'auto',
              padding: `0 ${spacing['3']}`,
              gap: spacing['1.5'],
              display: 'inline-flex',
              alignItems: 'center',
              color: colors.statusCritical,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily,
            }}
            onClick={handleClearAll}
          >
            <Trash2 size={15} />
            Clear
          </button>

          {/* Save */}
          {onSave && (
            <button
              type="button"
              title="Save Annotations"
              aria-label="Save annotations"
              style={{
                ...btnStyle(false, false),
                width: 'auto',
                padding: `0 ${spacing['4']}`,
                gap: spacing['1.5'],
                display: 'inline-flex',
                alignItems: 'center',
                background: colors.primaryOrange,
                color: colors.white,
                border: 'none',
                fontWeight: typography.fontWeight.semibold,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                borderRadius: borderRadius.base,
              }}
              onClick={handleSave}
            >
              <Save size={15} />
              Save
            </button>
          )}
        </div>
      )}

      {/* Canvas */}
      <div
        style={{
          ...canvasWrapperStyle,
          width: propWidth ? `${canW}px` : '100%',
          height: `${canH}px`,
        }}
      >
        <canvas ref={canvasElRef} />
      </div>
    </div>
  )
}

export default PhotoAnnotation
