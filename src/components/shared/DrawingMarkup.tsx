import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Cloud,
  ArrowRight,
  MapPin,
  Type,
  Pencil,
  Ruler,
  Square,
  MousePointer,
  Palette,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Trash2,
} from 'lucide-react'
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,

} from '../../styles/theme'

// ── Types ─────────────────────────────────────────────────

export interface DrawingAnnotation {
  id: string
  type: 'cloud' | 'arrow' | 'pin' | 'text' | 'freehand' | 'dimension' | 'rectangle'
  data: Record<string, unknown>
  color: string
  label?: string
  createdAt: string
  createdBy?: string
}

export interface LinkedItem {
  id: string
  type: 'punch_item' | 'rfi' | 'submittal'
  label: string
  x: number
  y: number
  status: string
  priority?: string
}

export interface DrawingMarkupProps {
  imageUrl: string
  drawingName?: string
  annotations?: DrawingAnnotation[]
  linkedItems?: LinkedItem[]
  onSave?: (annotations: DrawingAnnotation[]) => void
  onPinItem?: (x: number, y: number) => void
  readOnly?: boolean
}

type ToolType = 'select' | 'cloud' | 'arrow' | 'pin' | 'text' | 'freehand' | 'dimension' | 'rectangle'

interface Point {
  x: number
  y: number
}

const MARKUP_COLORS = [
  { name: 'Red', value: '#E05252' },
  { name: 'Blue', value: '#3A7BC8' },
  { name: 'Green', value: '#4EC896' },
  { name: 'Yellow', value: '#D97706' },
  { name: 'Black', value: '#1A1613' },
] as const

const TOOLS: { type: ToolType; icon: React.ElementType; label: string; shortcut?: string }[] = [
  { type: 'select', icon: MousePointer, label: 'Select / Move', shortcut: 'V' },
  { type: 'cloud', icon: Cloud, label: 'Revision Cloud', shortcut: 'C' },
  { type: 'arrow', icon: ArrowRight, label: 'Arrow', shortcut: 'A' },
  { type: 'pin', icon: MapPin, label: 'Pin', shortcut: 'P' },
  { type: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { type: 'freehand', icon: Pencil, label: 'Freehand', shortcut: 'F' },
  { type: 'dimension', icon: Ruler, label: 'Dimension Line', shortcut: 'D' },
  { type: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R' },
]

const LINKED_ITEM_COLORS: Record<string, { bg: string; border: string }> = {
  punch_item: { bg: '#E05252', border: '#C93B3B' },
  rfi: { bg: '#3A7BC8', border: '#2D62A3' },
  submittal: { bg: '#4EC896', border: '#3BAF7D' },
}

function generateId(): string {
  return `ann_${Date.now()}_${crypto.randomUUID().slice(0, 7)}`
}

// ── Canvas Drawing Helpers ────────────────────────────────

function drawRevisionCloud(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number = 2
) {
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)

  if (width < 4 || height < 4) return

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const arcRadius = Math.min(12, width / 4, height / 4)
  const perimeter = 2 * (width + height)
  const arcCount = Math.max(8, Math.round(perimeter / (arcRadius * 1.8)))

  ctx.beginPath()

  // Walk around the rectangle perimeter drawing small bumpy arcs
  const points: Point[] = []
  const sides = [
    { sx: left, sy: top, ex: left + width, ey: top },           // top
    { sx: left + width, sy: top, ex: left + width, ey: top + height }, // right
    { sx: left + width, sy: top + height, ex: left, ey: top + height }, // bottom
    { sx: left, sy: top + height, ex: left, ey: top },           // left
  ]

  const totalLen = 2 * width + 2 * height
  const segLen = totalLen / arcCount

  // Generate equidistant points along perimeter
  let remaining = 0
  for (const side of sides) {
    const dx = side.ex - side.sx
    const dy = side.ey - side.sy
    const sideLen = Math.sqrt(dx * dx + dy * dy)
    const ux = dx / sideLen
    const uy = dy / sideLen
    let dist = remaining
    while (dist < sideLen) {
      points.push({ x: side.sx + ux * dist, y: side.sy + uy * dist })
      dist += segLen
    }
    remaining = dist - sideLen
  }

  if (points.length < 3) {
    ctx.restore()
    return
  }

  // Draw arcs between consecutive points (bumps outward)
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i]
    const p1 = points[(i + 1) % points.length]
    const mx = (p0.x + p1.x) / 2
    const my = (p0.y + p1.y) / 2
    // Offset control point outward from center
    const cx = (left + width / 2)
    const cy = (top + height / 2)
    const dx = mx - cx
    const dy = my - cy
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const bulge = arcRadius * 0.6
    const cpx = mx + (dx / len) * bulge
    const cpy = my + (dy / len) * bulge

    if (i === 0) {
      ctx.moveTo(p0.x, p0.y)
    }
    ctx.quadraticCurveTo(cpx, cpy, p1.x, p1.y)
  }

  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number = 2
) {
  const headLen = Math.min(20, Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 0.3)
  const angle = Math.atan2(y2 - y1, x2 - x1)

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  label?: string
) {
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 2

  // Pin body
  ctx.beginPath()
  ctx.arc(x, y - 14, 10, Math.PI, 0, false)
  ctx.quadraticCurveTo(x + 10, y - 4, x, y)
  ctx.quadraticCurveTo(x - 10, y - 4, x - 10, y - 14)
  ctx.fill()
  ctx.stroke()

  // Inner dot
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(x, y - 14, 4, 0, Math.PI * 2)
  ctx.fill()

  if (label) {
    ctx.fillStyle = color
    ctx.font = `600 11px ${typography.fontFamily}`
    ctx.textAlign = 'center'
    ctx.fillText(label, x, y - 28)
  }

  ctx.restore()
}

function drawTextAnnotation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize: number = 14
) {
  ctx.save()
  ctx.fillStyle = color
  ctx.font = `600 ${fontSize}px ${typography.fontFamily}`
  ctx.textBaseline = 'top'

  // Background
  const metrics = ctx.measureText(text)
  const pad = 4
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fillRect(x - pad, y - pad, metrics.width + pad * 2, fontSize + pad * 2)

  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

function drawFreehand(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  lineWidth: number = 2
) {
  if (points.length < 2) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
  ctx.restore()
}

function drawDimension(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  label?: string
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)
  const tickLen = 8

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'

  // Main line
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  // Tick marks at each end (perpendicular)
  const perpX = -Math.sin(angle)
  const perpY = Math.cos(angle)
  for (const [px, py] of [[x1, y1], [x2, y2]]) {
    ctx.beginPath()
    ctx.moveTo(px + perpX * tickLen, py + perpY * tickLen)
    ctx.lineTo(px - perpX * tickLen, py - perpY * tickLen)
    ctx.stroke()
  }

  // Label
  const displayLabel = label || `${Math.round(len)}px`
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  ctx.font = `500 11px ${typography.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'

  ctx.save()
  ctx.translate(mx, my)
  let textAngle = angle
  if (textAngle > Math.PI / 2) textAngle -= Math.PI
  if (textAngle < -Math.PI / 2) textAngle += Math.PI
  ctx.rotate(textAngle)

  const tm = ctx.measureText(displayLabel)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fillRect(-tm.width / 2 - 3, -14, tm.width + 6, 14)
  ctx.fillStyle = color
  ctx.fillText(displayLabel, 0, -2)
  ctx.restore()

  ctx.restore()
}

function drawRectangle(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number = 2
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.strokeRect(
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.abs(x2 - x1),
    Math.abs(y2 - y1)
  )
  ctx.restore()
}

function drawAnnotation(ctx: CanvasRenderingContext2D, ann: DrawingAnnotation) {
  const d = ann.data as Record<string, unknown>
  switch (ann.type) {
    case 'cloud':
      drawRevisionCloud(
        ctx,
        d.x1 as number, d.y1 as number,
        d.x2 as number, d.y2 as number,
        ann.color
      )
      break
    case 'arrow':
      drawArrow(
        ctx,
        d.x1 as number, d.y1 as number,
        d.x2 as number, d.y2 as number,
        ann.color
      )
      break
    case 'pin':
      drawPin(ctx, d.x as number, d.y as number, ann.color, ann.label)
      break
    case 'text':
      drawTextAnnotation(
        ctx,
        d.x as number, d.y as number,
        d.text as string || '',
        ann.color
      )
      break
    case 'freehand':
      drawFreehand(ctx, d.points as Point[], ann.color)
      break
    case 'dimension':
      drawDimension(
        ctx,
        d.x1 as number, d.y1 as number,
        d.x2 as number, d.y2 as number,
        ann.color,
        ann.label
      )
      break
    case 'rectangle':
      drawRectangle(
        ctx,
        d.x1 as number, d.y1 as number,
        d.x2 as number, d.y2 as number,
        ann.color
      )
      break
  }
}

// ── Highlight selected annotation ─────────────────────────

function drawSelectionHighlight(ctx: CanvasRenderingContext2D, ann: DrawingAnnotation) {
  const d = ann.data as Record<string, unknown>
  ctx.save()
  ctx.strokeStyle = '#3A7BC8'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])

  const pad = 6

  switch (ann.type) {
    case 'cloud':
    case 'rectangle': {
      const x1 = Math.min(d.x1 as number, d.x2 as number) - pad
      const y1 = Math.min(d.y1 as number, d.y2 as number) - pad
      const w = Math.abs((d.x2 as number) - (d.x1 as number)) + pad * 2
      const h = Math.abs((d.y2 as number) - (d.y1 as number)) + pad * 2
      ctx.strokeRect(x1, y1, w, h)
      break
    }
    case 'arrow':
    case 'dimension': {
      const x1 = Math.min(d.x1 as number, d.x2 as number) - pad
      const y1 = Math.min(d.y1 as number, d.y2 as number) - pad
      const w = Math.abs((d.x2 as number) - (d.x1 as number)) + pad * 2
      const h = Math.abs((d.y2 as number) - (d.y1 as number)) + pad * 2
      ctx.strokeRect(x1, y1, w, h)
      break
    }
    case 'pin': {
      ctx.strokeRect((d.x as number) - 14, (d.y as number) - 28, 28, 32)
      break
    }
    case 'text': {
      ctx.strokeRect((d.x as number) - 4, (d.y as number) - 4, 100, 22)
      break
    }
    case 'freehand': {
      const pts = d.points as Point[]
      if (pts.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const p of pts) {
          if (p.x < minX) minX = p.x
          if (p.y < minY) minY = p.y
          if (p.x > maxX) maxX = p.x
          if (p.y > maxY) maxY = p.y
        }
        ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2)
      }
      break
    }
  }

  ctx.restore()
}

// ── Hit Testing ───────────────────────────────────────────

function hitTest(ann: DrawingAnnotation, px: number, py: number, tolerance: number = 8): boolean {
  const d = ann.data as Record<string, unknown>
  switch (ann.type) {
    case 'cloud':
    case 'rectangle': {
      const x1 = Math.min(d.x1 as number, d.x2 as number) - tolerance
      const y1 = Math.min(d.y1 as number, d.y2 as number) - tolerance
      const x2 = Math.max(d.x1 as number, d.x2 as number) + tolerance
      const y2 = Math.max(d.y1 as number, d.y2 as number) + tolerance
      return px >= x1 && px <= x2 && py >= y1 && py <= y2
    }
    case 'arrow':
    case 'dimension': {
      const ax = d.x1 as number, ay = d.y1 as number
      const bx = d.x2 as number, by = d.y2 as number
      const lenSq = (bx - ax) ** 2 + (by - ay) ** 2
      if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2) < tolerance
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lenSq))
      const projX = ax + t * (bx - ax)
      const projY = ay + t * (by - ay)
      return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2) < tolerance
    }
    case 'pin': {
      const dx = px - (d.x as number)
      const dy = py - (d.y as number) + 14
      return dx * dx + dy * dy < 16 * 16
    }
    case 'text': {
      const tx = d.x as number
      const ty = d.y as number
      return px >= tx - 4 && px <= tx + 120 && py >= ty - 4 && py <= ty + 20
    }
    case 'freehand': {
      const pts = d.points as Point[]
      for (const p of pts) {
        if (Math.sqrt((px - p.x) ** 2 + (py - p.y) ** 2) < tolerance) return true
      }
      return false
    }
  }
  return false
}

// ── Main Component ────────────────────────────────────────

export default function DrawingMarkup({
  imageUrl,
  drawingName,
  annotations: initialAnnotations = [],
  linkedItems = [],
  onSave,
  onPinItem,
  readOnly = false,
}: DrawingMarkupProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const animFrameRef = useRef<number>(0)

  const [activeTool, setActiveTool] = useState<ToolType>('select')
  const [activeColor, setActiveColor] = useState<string>(MARKUP_COLORS[0].value)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [annotations, setAnnotations] = useState<DrawingAnnotation[]>(initialAnnotations)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<DrawingAnnotation[][]>([])
  const [hoveredLinkedItem, setHoveredLinkedItem] = useState<string | null>(null)
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false })
  const [textValue, setTextValue] = useState('')

  // Viewport / pan-zoom state
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  // Drawing state refs (not reactive, to avoid re-renders during drag)
  const drawingRef = useRef(false)
  const startPointRef = useRef<Point>({ x: 0, y: 0 })
  const currentPointRef = useRef<Point>({ x: 0, y: 0 })
  const freehandPointsRef = useRef<Point[]>([])
  const isPanningRef = useRef(false)
  const panStartRef = useRef<Point>({ x: 0, y: 0 })
  const lastTouchDistRef = useRef<number>(0)

  // ── Image loading ─────────────────────────────────────

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
      setImageLoaded(true)
    }
    img.onerror = () => {
      setImageLoaded(false)
    }
    img.src = imageUrl
  }, [imageUrl])

  // ── Sync initial annotations ──────────────────────────

  useEffect(() => {
    setAnnotations(initialAnnotations)
  }, [initialAnnotations])

  // ── Canvas coordinate helpers ─────────────────────────

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Point => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const x = (screenX - rect.left - viewTransform.x) / viewTransform.scale
      const y = (screenY - rect.top - viewTransform.y) / viewTransform.scale
      return { x, y }
    },
    [viewTransform]
  )

  // ── Render loop ───────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const container = containerRef.current
    if (!container) return

    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Checkerboard background
    ctx.fillStyle = '#F0F0F0'
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(viewTransform.x, viewTransform.y)
    ctx.scale(viewTransform.scale, viewTransform.scale)

    // Draw image
    if (imageRef.current && imageLoaded) {
      ctx.drawImage(imageRef.current, 0, 0)
    }

    // Draw existing annotations
    for (const ann of annotations) {
      drawAnnotation(ctx, ann)
      if (ann.id === selectedId) {
        drawSelectionHighlight(ctx, ann)
      }
    }

    // Draw in-progress annotation
    if (drawingRef.current && activeTool !== 'select' && activeTool !== 'pin') {
      const sp = startPointRef.current
      const cp = currentPointRef.current
      switch (activeTool) {
        case 'cloud':
          drawRevisionCloud(ctx, sp.x, sp.y, cp.x, cp.y, activeColor)
          break
        case 'arrow':
          drawArrow(ctx, sp.x, sp.y, cp.x, cp.y, activeColor)
          break
        case 'freehand':
          drawFreehand(ctx, freehandPointsRef.current, activeColor)
          break
        case 'dimension':
          drawDimension(ctx, sp.x, sp.y, cp.x, cp.y, activeColor)
          break
        case 'rectangle':
          drawRectangle(ctx, sp.x, sp.y, cp.x, cp.y, activeColor)
          break
      }
    }

    ctx.restore()
  }, [annotations, selectedId, viewTransform, activeTool, activeColor, imageLoaded])

  // ── Animation frame scheduling ────────────────────────

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(render)
  }, [render])

  useEffect(() => {
    scheduleRender()
  }, [scheduleRender])

  // ── Resize observer ───────────────────────────────────

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver(() => {
      scheduleRender()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [scheduleRender])

  // ── Fit image on load ─────────────────────────────────

  useEffect(() => {
    if (!imageLoaded || !containerRef.current) return
    const container = containerRef.current
    const cw = container.clientWidth
    const ch = container.clientHeight
    const iw = imageSize.width
    const ih = imageSize.height
    if (iw === 0 || ih === 0) return

    const scale = Math.min(cw / iw, ch / ih, 1) * 0.95
    const x = (cw - iw * scale) / 2
    const y = (ch - ih * scale) / 2
    setViewTransform({ x, y, scale })
  }, [imageLoaded, imageSize])

  // ── Cleanup ───────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // ── Undo ──────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-30), annotations])
  }, [annotations])

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setAnnotations(last)
      setSelectedId(null)
      return prev.slice(0, -1)
    })
  }, [])

  // ── Delete selected ───────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    pushUndo()
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, pushUndo])

  // ── Keyboard shortcuts ────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (readOnly) return
      // Ignore when typing in text input
      if (textInput.visible) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault()
          deleteSelected()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
      if (e.key === 'Escape') {
        setSelectedId(null)
        setActiveTool('select')
        setTextInput((prev) => ({ ...prev, visible: false }))
        drawingRef.current = false
      }
      // Tool shortcuts (single key, no modifier)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = TOOLS.find((t) => t.shortcut?.toLowerCase() === e.key.toLowerCase())
        if (tool) {
          setActiveTool(tool.type)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [readOnly, selectedId, deleteSelected, undo, textInput.visible])

  // ── Mouse handlers ────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Middle button or space+click = pan
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanningRef.current = true
        panStartRef.current = { x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y }
        canvas.setPointerCapture(e.pointerId)
        return
      }

      if (e.button !== 0) return

      const pt = screenToCanvas(e.clientX, e.clientY)

      if (readOnly) return

      if (activeTool === 'select') {
        // Hit test annotations (reverse order for top-first)
        let found = false
        for (let i = annotations.length - 1; i >= 0; i--) {
          if (hitTest(annotations[i], pt.x, pt.y)) {
            setSelectedId(annotations[i].id)
            found = true
            break
          }
        }
        if (!found) setSelectedId(null)
        return
      }

      if (activeTool === 'pin') {
        pushUndo()
        const ann: DrawingAnnotation = {
          id: generateId(),
          type: 'pin',
          data: { x: pt.x, y: pt.y },
          color: activeColor,
          createdAt: new Date().toISOString(),
        }
        setAnnotations((prev) => [...prev, ann])
        if (onPinItem) {
          // Normalize to 0-1 based on image size
          const nx = imageSize.width > 0 ? pt.x / imageSize.width : 0
          const ny = imageSize.height > 0 ? pt.y / imageSize.height : 0
          onPinItem(nx, ny)
        }
        return
      }

      if (activeTool === 'text') {
        setTextInput({ x: pt.x, y: pt.y, visible: true })
        setTextValue('')
        return
      }

      // Start drawing
      drawingRef.current = true
      startPointRef.current = pt
      currentPointRef.current = pt
      freehandPointsRef.current = [pt]
      canvas.setPointerCapture(e.pointerId)
    },
    [activeTool, activeColor, annotations, readOnly, screenToCanvas, viewTransform, pushUndo, onPinItem, imageSize]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanningRef.current) {
        setViewTransform((prev) => ({
          ...prev,
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        }))
        return
      }

      if (!drawingRef.current) return

      const pt = screenToCanvas(e.clientX, e.clientY)
      currentPointRef.current = pt

      if (activeTool === 'freehand') {
        freehandPointsRef.current.push(pt)
      }

      scheduleRender()
    },
    [activeTool, screenToCanvas, scheduleRender]
  )

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false
        return
      }

      if (!drawingRef.current) return
      drawingRef.current = false

      if (readOnly) return

      const sp = startPointRef.current
      const cp = currentPointRef.current

      pushUndo()

      let ann: DrawingAnnotation | null = null

      switch (activeTool) {
        case 'cloud':
          if (Math.abs(cp.x - sp.x) > 4 && Math.abs(cp.y - sp.y) > 4) {
            ann = {
              id: generateId(),
              type: 'cloud',
              data: { x1: sp.x, y1: sp.y, x2: cp.x, y2: cp.y },
              color: activeColor,
              createdAt: new Date().toISOString(),
            }
          }
          break
        case 'arrow':
          if (Math.sqrt((cp.x - sp.x) ** 2 + (cp.y - sp.y) ** 2) > 8) {
            ann = {
              id: generateId(),
              type: 'arrow',
              data: { x1: sp.x, y1: sp.y, x2: cp.x, y2: cp.y },
              color: activeColor,
              createdAt: new Date().toISOString(),
            }
          }
          break
        case 'freehand':
          if (freehandPointsRef.current.length > 2) {
            ann = {
              id: generateId(),
              type: 'freehand',
              data: { points: [...freehandPointsRef.current] },
              color: activeColor,
              createdAt: new Date().toISOString(),
            }
          }
          break
        case 'dimension':
          if (Math.sqrt((cp.x - sp.x) ** 2 + (cp.y - sp.y) ** 2) > 8) {
            ann = {
              id: generateId(),
              type: 'dimension',
              data: { x1: sp.x, y1: sp.y, x2: cp.x, y2: cp.y },
              color: activeColor,
              createdAt: new Date().toISOString(),
            }
          }
          break
        case 'rectangle':
          if (Math.abs(cp.x - sp.x) > 4 && Math.abs(cp.y - sp.y) > 4) {
            ann = {
              id: generateId(),
              type: 'rectangle',
              data: { x1: sp.x, y1: sp.y, x2: cp.x, y2: cp.y },
              color: activeColor,
              createdAt: new Date().toISOString(),
            }
          }
          break
      }

      if (ann) {
        setAnnotations((prev) => [...prev, ann!])
      }

      freehandPointsRef.current = []
      scheduleRender()
    },
    [activeTool, activeColor, readOnly, pushUndo, scheduleRender]
  )

  // ── Wheel zoom ────────────────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
      const newScale = Math.min(5, Math.max(0.1, viewTransform.scale * zoomFactor))

      // Zoom toward mouse position
      const scaleChange = newScale / viewTransform.scale
      const newX = mouseX - (mouseX - viewTransform.x) * scaleChange
      const newY = mouseY - (mouseY - viewTransform.y) * scaleChange

      setViewTransform({ x: newX, y: newY, scale: newScale })
    },
    [viewTransform]
  )

  // ── Touch support for pinch-zoom ──────────────────────

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastTouchDistRef.current = Math.sqrt(dx * dx + dy * dy)
      }
    },
    []
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const prevDist = lastTouchDistRef.current

        if (prevDist > 0) {
          const scale = dist / prevDist
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2

          const canvas = canvasRef.current
          if (canvas) {
            const rect = canvas.getBoundingClientRect()
            const cx = midX - rect.left
            const cy = midY - rect.top

            setViewTransform((prev) => {
              const newScale = Math.min(5, Math.max(0.1, prev.scale * scale))
              const scaleChange = newScale / prev.scale
              return {
                x: cx - (cx - prev.x) * scaleChange,
                y: cy - (cy - prev.y) * scaleChange,
                scale: newScale,
              }
            })
          }
        }
        lastTouchDistRef.current = dist
      }
    },
    []
  )

  // ── Zoom controls ─────────────────────────────────────

  const zoomIn = useCallback(() => {
    setViewTransform((prev) => ({ ...prev, scale: Math.min(5, prev.scale * 1.25) }))
  }, [])

  const zoomOut = useCallback(() => {
    setViewTransform((prev) => ({ ...prev, scale: Math.max(0.1, prev.scale / 1.25) }))
  }, [])

  const fitToView = useCallback(() => {
    if (!containerRef.current || !imageLoaded) return
    const cw = containerRef.current.clientWidth
    const ch = containerRef.current.clientHeight
    const scale = Math.min(cw / imageSize.width, ch / imageSize.height, 1) * 0.95
    const x = (cw - imageSize.width * scale) / 2
    const y = (ch - imageSize.height * scale) / 2
    setViewTransform({ x, y, scale })
  }, [imageLoaded, imageSize])

  // ── Save ──────────────────────────────────────────────

  const handleSave = useCallback(() => {
    onSave?.(annotations)
  }, [onSave, annotations])

  // ── Text input submit ─────────────────────────────────

  const submitText = useCallback(() => {
    if (textValue.trim()) {
      pushUndo()
      const ann: DrawingAnnotation = {
        id: generateId(),
        type: 'text',
        data: { x: textInput.x, y: textInput.y, text: textValue.trim() },
        color: activeColor,
        createdAt: new Date().toISOString(),
      }
      setAnnotations((prev) => [...prev, ann])
    }
    setTextInput((prev) => ({ ...prev, visible: false }))
    setTextValue('')
  }, [textValue, textInput, activeColor, pushUndo])

  // ── Linked item position helpers ──────────────────────

  const getLinkedItemScreenPos = useCallback(
    (item: LinkedItem) => {
      const ix = item.x * imageSize.width
      const iy = item.y * imageSize.height
      return {
        x: ix * viewTransform.scale + viewTransform.x,
        y: iy * viewTransform.scale + viewTransform.y,
      }
    },
    [viewTransform, imageSize]
  )

  // ── Zoom percentage display ───────────────────────────

  const zoomPct = useMemo(() => Math.round(viewTransform.scale * 100), [viewTransform.scale])

  // ── Styles ────────────────────────────────────────────

  const toolbarStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing['3'],
    left: spacing['3'],
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['1'],
    background: colors.panelBg,
    backdropFilter: 'blur(12px)',
    borderRadius: borderRadius.lg,
    padding: spacing['2'],
    boxShadow: shadows.dropdown,
    zIndex: 10,
    userSelect: 'none',
  }

  const toolBtnStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    background: isActive ? colors.primaryOrange : 'transparent',
    color: isActive ? colors.white : colors.textSecondary,
    transition: transitions.quick,
  })

  const colorSwatchStyle = (c: string, isActive: boolean): React.CSSProperties => ({
    width: '20px',
    height: '20px',
    borderRadius: borderRadius.full,
    border: isActive ? `2px solid ${colors.textPrimary}` : '2px solid transparent',
    background: c,
    cursor: 'pointer',
    outline: isActive ? `2px solid ${colors.white}` : 'none',
    outlineOffset: '-4px',
  })

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '400px',
        overflow: 'hidden',
        background: '#E8E8E8',
        borderRadius: borderRadius.lg,
        fontFamily: typography.fontFamily,
      }}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: activeTool === 'select'
            ? 'default'
            : activeTool === 'text'
              ? 'text'
              : 'crosshair',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      />

      {/* Linked item badges */}
      {linkedItems.map((item) => {
        const pos = getLinkedItemScreenPos(item)
        const palette = LINKED_ITEM_COLORS[item.type] || LINKED_ITEM_COLORS.punch_item
        const isHovered = hoveredLinkedItem === item.id
        return (
          <div
            key={item.id}
            onMouseEnter={() => setHoveredLinkedItem(item.id)}
            onMouseLeave={() => setHoveredLinkedItem(null)}
            style={{
              position: 'absolute',
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: isHovered ? 20 : 5,
              pointerEvents: 'auto',
            }}
          >
            {/* Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                background: palette.bg,
                color: colors.white,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                padding: `${spacing['0.5']} ${spacing['2']}`,
                borderRadius: borderRadius.full,
                border: `2px solid ${palette.border}`,
                boxShadow: shadows.card,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: transitions.quick,
                ...(isHovered ? { transform: 'scale(1.1)' } : {}),
              }}
            >
              {item.label}
            </div>

            {/* Connector dot */}
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: borderRadius.full,
                background: palette.bg,
                margin: '0 auto',
              }}
            />

            {/* Tooltip */}
            {isHovered && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: spacing['2'],
                  background: colors.surfaceRaised,
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.md,
                  padding: `${spacing['2']} ${spacing['3']}`,
                  boxShadow: shadows.dropdown,
                  fontSize: typography.fontSize.label,
                  fontFamily: typography.fontFamily,
                  color: colors.textPrimary,
                  whiteSpace: 'nowrap',
                  zIndex: 30,
                }}
              >
                <div style={{ fontWeight: typography.fontWeight.semibold }}>{item.label}</div>
                <div style={{ color: colors.textSecondary, marginTop: spacing['0.5'] }}>
                  {item.type.replace('_', ' ').toUpperCase()} &middot; {item.status}
                </div>
                {item.priority && (
                  <div style={{ color: colors.textTertiary, marginTop: spacing['0.5'] }}>
                    Priority: {item.priority}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Text input overlay */}
      {textInput.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${textInput.x * viewTransform.scale + viewTransform.x}px`,
            top: `${textInput.y * viewTransform.scale + viewTransform.y}px`,
            zIndex: 25,
          }}
        >
          <input
            autoFocus
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitText()
              if (e.key === 'Escape') {
                setTextInput((prev) => ({ ...prev, visible: false }))
                setTextValue('')
              }
            }}
            onBlur={submitText}
            placeholder="Type annotation..."
            style={{
              fontFamily: typography.fontFamily,
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.semibold,
              color: activeColor,
              background: 'rgba(255,255,255,0.9)',
              border: `2px solid ${activeColor}`,
              borderRadius: borderRadius.sm,
              padding: `${spacing['1']} ${spacing['2']}`,
              outline: 'none',
              minWidth: '120px',
            }}
          />
        </div>
      )}

      {/* Left toolbar */}
      {!readOnly && (
        <div style={toolbarStyle}>
          {TOOLS.map((tool) => (
            <button
              key={tool.type}
              title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
              onClick={() => {
                setActiveTool(tool.type)
                setSelectedId(null)
              }}
              style={toolBtnStyle(activeTool === tool.type)}
            >
              <tool.icon size={18} />
            </button>
          ))}

          {/* Divider */}
          <div
            style={{
              height: '1px',
              background: colors.borderSubtle,
              margin: `${spacing['1']} 0`,
            }}
          />

          {/* Color picker toggle */}
          <div style={{ position: 'relative' }}>
            <button
              title="Color"
              onClick={() => setShowColorPicker(!showColorPicker)}
              style={{
                ...toolBtnStyle(false),
                position: 'relative',
              }}
            >
              <Palette size={18} />
              <div
                style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '4px',
                  width: '8px',
                  height: '8px',
                  borderRadius: borderRadius.full,
                  background: activeColor,
                  border: `1px solid ${colors.white}`,
                }}
              />
            </button>

            {showColorPicker && (
              <div
                style={{
                  position: 'absolute',
                  left: 'calc(100% + 8px)',
                  top: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing['1.5'],
                  background: colors.panelBg,
                  backdropFilter: 'blur(12px)',
                  borderRadius: borderRadius.md,
                  padding: spacing['2'],
                  boxShadow: shadows.dropdown,
                }}
              >
                {MARKUP_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.name}
                    onClick={() => {
                      setActiveColor(c.value)
                      setShowColorPicker(false)
                    }}
                    style={{
                      ...colorSwatchStyle(c.value, activeColor === c.value),
                      border: activeColor === c.value
                        ? `2px solid ${colors.textPrimary}`
                        : `2px solid ${colors.borderSubtle}`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              background: colors.borderSubtle,
              margin: `${spacing['1']} 0`,
            }}
          />

          {/* Undo */}
          <button
            title="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={undoStack.length === 0}
            style={{
              ...toolBtnStyle(false),
              opacity: undoStack.length === 0 ? 0.35 : 1,
            }}
          >
            <Undo2 size={18} />
          </button>

          {/* Delete selected */}
          <button
            title="Delete selected (Delete)"
            onClick={deleteSelected}
            disabled={!selectedId}
            style={{
              ...toolBtnStyle(false),
              opacity: selectedId ? 1 : 0.35,
              color: selectedId ? '#E05252' : colors.textSecondary,
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}

      {/* Top bar — drawing name + save */}
      <div
        style={{
          position: 'absolute',
          top: spacing['3'],
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: spacing['4'],
          background: colors.panelBg,
          backdropFilter: 'blur(12px)',
          borderRadius: borderRadius.lg,
          padding: `${spacing['2']} ${spacing['4']}`,
          boxShadow: shadows.dropdown,
          zIndex: 10,
          userSelect: 'none',
        }}
      >
        {drawingName && (
          <span
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              fontFamily: typography.fontFamily,
            }}
          >
            {drawingName}
          </span>
        )}

        {onSave && !readOnly && (
          <button
            onClick={handleSave}
            title="Save annotations"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1.5'],
              background: colors.primaryOrange,
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.md,
              padding: `${spacing['1.5']} ${spacing['3']}`,
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              transition: transitions.quick,
            }}
          >
            <Save size={14} />
            Save
          </button>
        )}
      </div>

      {/* Bottom-right zoom controls */}
      <div
        style={{
          position: 'absolute',
          bottom: spacing['3'],
          right: spacing['3'],
          display: 'flex',
          alignItems: 'center',
          gap: spacing['1'],
          background: colors.panelBg,
          backdropFilter: 'blur(12px)',
          borderRadius: borderRadius.lg,
          padding: spacing['1.5'],
          boxShadow: shadows.dropdown,
          zIndex: 10,
          userSelect: 'none',
        }}
      >
        <button onClick={zoomOut} title="Zoom out" style={toolBtnStyle(false)}>
          <ZoomOut size={16} />
        </button>
        <span
          style={{
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.medium,
            color: colors.textSecondary,
            fontFamily: typography.fontFamily,
            minWidth: '40px',
            textAlign: 'center',
          }}
        >
          {zoomPct}%
        </span>
        <button onClick={zoomIn} title="Zoom in" style={toolBtnStyle(false)}>
          <ZoomIn size={16} />
        </button>
        <div
          style={{
            width: '1px',
            height: '20px',
            background: colors.borderSubtle,
            margin: `0 ${spacing['0.5']}`,
          }}
        />
        <button onClick={fitToView} title="Fit to view" style={toolBtnStyle(false)}>
          <Maximize size={16} />
        </button>
      </div>

      {/* Bottom-left annotation count */}
      <div
        style={{
          position: 'absolute',
          bottom: spacing['3'],
          left: spacing['3'],
          background: colors.panelBg,
          backdropFilter: 'blur(12px)',
          borderRadius: borderRadius.md,
          padding: `${spacing['1.5']} ${spacing['3']}`,
          boxShadow: shadows.card,
          fontSize: typography.fontSize.caption,
          fontFamily: typography.fontFamily,
          color: colors.textSecondary,
          zIndex: 10,
          userSelect: 'none',
        }}
      >
        {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
        {linkedItems.length > 0 && ` · ${linkedItems.length} linked`}
      </div>
    </div>
  )
}
