import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  MousePointer,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Pencil,
  Type,
  StickyNote,
  Eraser,
  Undo2,
  Redo2,
  Grid3X3,
  Download,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
} from '../../styles/theme'

// ── Types ─────────────────────────────────────────────────

export interface WhiteboardElement {
  id: string
  type: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'text' | 'image' | 'sticky_note'
  x: number
  y: number
  width?: number
  height?: number
  points?: Array<{ x: number; y: number }>
  text?: string
  color: string
  strokeWidth: number
  fill?: string
  fontSize?: number
  rotation?: number
}

export interface WhiteboardData {
  elements: WhiteboardElement[]
  viewportX: number
  viewportY: number
  zoom: number
}

export interface WhiteboardProps {
  initialData?: WhiteboardData
  onSave?: (data: WhiteboardData) => void
  readOnly?: boolean
  height?: number | string
  collaborators?: Array<{ name: string; color: string; cursorX?: number; cursorY?: number }>
}

type ToolType = 'select' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'text' | 'sticky_note' | 'eraser'

interface HistoryEntry {
  elements: WhiteboardElement[]
}

// ── Constants ─────────────────────────────────────────────

const PALETTE_COLORS = [
  '#000000', '#FFFFFF', '#E05252', '#3A7BC8',
  '#4EC896', '#F5D245', '#F47820', '#7C5DC7',
] as const

const STROKE_WIDTHS = [1, 2, 4, 8] as const

const STICKY_COLORS = [
  { name: 'Yellow', value: '#FEF9C3' },
  { name: 'Pink', value: '#FCE7F3' },
  { name: 'Blue', value: '#DBEAFE' },
  { name: 'Green', value: '#DCFCE7' },
] as const

const GRID_SIZE = 20
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5

const TOOL_ITEMS: Array<{ tool: ToolType; icon: React.ReactNode; label: string }> = [
  { tool: 'select', icon: <MousePointer size={18} />, label: 'Select (V)' },
  { tool: 'rectangle', icon: <Square size={18} />, label: 'Rectangle (R)' },
  { tool: 'ellipse', icon: <Circle size={18} />, label: 'Ellipse (E)' },
  { tool: 'line', icon: <Minus size={18} />, label: 'Line (L)' },
  { tool: 'arrow', icon: <ArrowRight size={18} />, label: 'Arrow (A)' },
  { tool: 'freehand', icon: <Pencil size={18} />, label: 'Freehand (P)' },
  { tool: 'text', icon: <Type size={18} />, label: 'Text (T)' },
  { tool: 'sticky_note', icon: <StickyNote size={18} />, label: 'Sticky Note (S)' },
  { tool: 'eraser', icon: <Eraser size={18} />, label: 'Eraser (X)' },
]

// ── Helpers ───────────────────────────────────────────────

function generateId(): string {
  return `wb_${crypto.randomUUID().replace(/-/g, '').slice(0, 7)}`
}

function snapToGrid(val: number, enabled: boolean): number {
  return enabled ? Math.round(val / GRID_SIZE) * GRID_SIZE : val
}

function pointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const x1 = Math.min(rx, rx + rw)
  const x2 = Math.max(rx, rx + rw)
  const y1 = Math.min(ry, ry + rh)
  const y2 = Math.max(ry, ry + rh)
  return px >= x1 && px <= x2 && py >= y1 && py <= y2
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function hitTestElement(el: WhiteboardElement, wx: number, wy: number): boolean {
  const threshold = Math.max(el.strokeWidth * 2, 8)

  switch (el.type) {
    case 'rectangle':
    case 'image':
    case 'sticky_note':
    case 'text':
      return pointInRect(wx, wy, el.x, el.y, el.width ?? 100, el.height ?? 40)

    case 'ellipse': {
      const cx = el.x + (el.width ?? 100) / 2
      const cy = el.y + (el.height ?? 100) / 2
      const rx = (el.width ?? 100) / 2
      const ry = (el.height ?? 100) / 2
      if (rx === 0 || ry === 0) return false
      const dx = (wx - cx) / rx
      const dy = (wy - cy) / ry
      return dx * dx + dy * dy <= 1
    }

    case 'line':
    case 'arrow': {
      const x1 = el.x
      const y1 = el.y
      const x2 = el.x + (el.width ?? 0)
      const y2 = el.y + (el.height ?? 0)
      return distToSegment(wx, wy, x1, y1, x2, y2) <= threshold
    }

    case 'freehand': {
      if (!el.points || el.points.length < 2) return false
      for (let i = 0; i < el.points.length - 1; i++) {
        const p1 = el.points[i]
        const p2 = el.points[i + 1]
        if (distToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y) <= threshold) return true
      }
      return false
    }

    default:
      return false
  }
}

// ── Component ─────────────────────────────────────────────

export const Whiteboard: React.FC<WhiteboardProps> = ({
  initialData,
  onSave,
  readOnly = false,
  height = '100%',
  collaborators,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)

  // State
  const [elements, setElements] = useState<WhiteboardElement[]>(initialData?.elements ?? [])
  const [viewportX, setViewportX] = useState(initialData?.viewportX ?? 0)
  const [viewportY, setViewportY] = useState(initialData?.viewportY ?? 0)
  const [zoom, setZoom] = useState(initialData?.zoom ?? 1)
  const [tool, setTool] = useState<ToolType>('select')
  const [activeColor, setActiveColor] = useState('#000000')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [gridEnabled, setGridEnabled] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)
  const panStartRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const currentElementRef = useRef<WhiteboardElement | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)

  // Text editing
  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number; width: number; height: number } | null>(null)
  const [textValue, setTextValue] = useState('')

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([{ elements: initialData?.elements ?? [] }])
  const [historyIndex, setHistoryIndex] = useState(0)

  // Sticky note color picker
  const [stickyColor, setStickyColor] = useState<string>(STICKY_COLORS[0].value)

  // ── History helpers ──────────────────────────────────────

  const pushHistory = useCallback((newElements: WhiteboardElement[]) => {
    setHistory(prev => {
      const truncated = prev.slice(0, historyIndex + 1)
      return [...truncated, { elements: newElements }]
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    setElements(history[newIndex].elements)
  }, [historyIndex, history])

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    setElements(history[newIndex].elements)
  }, [historyIndex, history])

  // ── Coordinate conversion ────────────────────────────────

  const screenToWorld = useCallback((sx: number, sy: number): { x: number; y: number } => {
    return {
      x: (sx - viewportX) / zoom,
      y: (sy - viewportY) / zoom,
    }
  }, [viewportX, viewportY, zoom])

  const worldToScreen = useCallback((wx: number, wy: number): { x: number; y: number } => {
    return {
      x: wx * zoom + viewportX,
      y: wy * zoom + viewportY,
    }
  }, [viewportX, viewportY, zoom])

  // ── Canvas rendering ─────────────────────────────────────

  const drawElements = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Clear
    ctx.fillStyle = '#F8F9FA'
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Grid
    if (gridEnabled) {
      ctx.save()
      ctx.strokeStyle = '#E5E7EB'
      ctx.lineWidth = 0.5
      const gridScreenSize = GRID_SIZE * zoom
      const offsetX = viewportX % gridScreenSize
      const offsetY = viewportY % gridScreenSize
      for (let x = offsetX; x < rect.width; x += gridScreenSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, rect.height)
        ctx.stroke()
      }
      for (let y = offsetY; y < rect.height; y += gridScreenSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(rect.width, y)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Transform for viewport
    ctx.save()
    ctx.translate(viewportX, viewportY)
    ctx.scale(zoom, zoom)

    // Draw each element
    const allElements = [...elements]
    if (currentElementRef.current && isDrawing) {
      allElements.push(currentElementRef.current)
    }

    for (const el of allElements) {
      ctx.save()
      ctx.strokeStyle = el.color
      ctx.lineWidth = el.strokeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      switch (el.type) {
        case 'rectangle': {
          const w = el.width ?? 0
          const h = el.height ?? 0
          if (el.fill) {
            ctx.fillStyle = el.fill
            ctx.fillRect(el.x, el.y, w, h)
          }
          ctx.strokeRect(el.x, el.y, w, h)
          break
        }

        case 'ellipse': {
          const w = el.width ?? 0
          const h = el.height ?? 0
          const cx = el.x + w / 2
          const cy = el.y + h / 2
          ctx.beginPath()
          ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
          if (el.fill) {
            ctx.fillStyle = el.fill
            ctx.fill()
          }
          ctx.stroke()
          break
        }

        case 'line': {
          ctx.beginPath()
          ctx.moveTo(el.x, el.y)
          ctx.lineTo(el.x + (el.width ?? 0), el.y + (el.height ?? 0))
          ctx.stroke()
          break
        }

        case 'arrow': {
          const ex = el.x + (el.width ?? 0)
          const ey = el.y + (el.height ?? 0)
          ctx.beginPath()
          ctx.moveTo(el.x, el.y)
          ctx.lineTo(ex, ey)
          ctx.stroke()
          // Arrowhead
          const angle = Math.atan2(ey - el.y, ex - el.x)
          const headLen = 12 + el.strokeWidth * 2
          ctx.beginPath()
          ctx.moveTo(ex, ey)
          ctx.lineTo(
            ex - headLen * Math.cos(angle - Math.PI / 6),
            ey - headLen * Math.sin(angle - Math.PI / 6),
          )
          ctx.moveTo(ex, ey)
          ctx.lineTo(
            ex - headLen * Math.cos(angle + Math.PI / 6),
            ey - headLen * Math.sin(angle + Math.PI / 6),
          )
          ctx.stroke()
          break
        }

        case 'freehand': {
          if (el.points && el.points.length > 1) {
            ctx.beginPath()
            ctx.moveTo(el.points[0].x, el.points[0].y)
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.points[i].x, el.points[i].y)
            }
            ctx.stroke()
          }
          break
        }

        case 'text': {
          const fontSize = el.fontSize ?? 16
          ctx.font = `${fontSize}px ${typography.fontFamily}`
          ctx.fillStyle = el.color
          ctx.textBaseline = 'top'
          const lines = (el.text ?? '').split('\n')
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], el.x, el.y + i * fontSize * 1.3)
          }
          break
        }

        case 'sticky_note': {
          const w = el.width ?? 150
          const h = el.height ?? 150
          // Shadow
          ctx.shadowColor = 'rgba(0,0,0,0.15)'
          ctx.shadowBlur = 8
          ctx.shadowOffsetX = 2
          ctx.shadowOffsetY = 2
          ctx.fillStyle = el.fill ?? '#FEF9C3'
          ctx.fillRect(el.x, el.y, w, h)
          ctx.shadowColor = 'transparent'
          // Border
          ctx.strokeStyle = 'rgba(0,0,0,0.1)'
          ctx.lineWidth = 1
          ctx.strokeRect(el.x, el.y, w, h)
          // Text
          if (el.text) {
            ctx.fillStyle = '#1A1613'
            const fontSize = el.fontSize ?? 14
            ctx.font = `${fontSize}px ${typography.fontFamily}`
            ctx.textBaseline = 'top'
            const maxW = w - 16
            const words = el.text.split(' ')
            let line = ''
            let ly = el.y + 12
            for (const word of words) {
              const test = line ? line + ' ' + word : word
              if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, el.x + 8, ly)
                line = word
                ly += fontSize * 1.4
              } else {
                line = test
              }
            }
            if (line) ctx.fillText(line, el.x + 8, ly)
          }
          break
        }

        default:
          break
      }

      // Selection highlight
      if (selectedIds.has(el.id)) {
        ctx.strokeStyle = '#3A7BC8'
        ctx.lineWidth = 2 / zoom
        ctx.setLineDash([6 / zoom, 4 / zoom])

        if (el.type === 'freehand' && el.points && el.points.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (const p of el.points) {
            minX = Math.min(minX, p.x)
            minY = Math.min(minY, p.y)
            maxX = Math.max(maxX, p.x)
            maxY = Math.max(maxY, p.y)
          }
          ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8)
        } else if (el.type === 'line' || el.type === 'arrow') {
          const x1 = Math.min(el.x, el.x + (el.width ?? 0))
          const y1 = Math.min(el.y, el.y + (el.height ?? 0))
          const w = Math.abs(el.width ?? 0)
          const h = Math.abs(el.height ?? 0)
          ctx.strokeRect(x1 - 4, y1 - 4, w + 8, h + 8)
        } else {
          ctx.strokeRect(el.x - 4, el.y - 4, (el.width ?? 100) + 8, (el.height ?? 40) + 8)
        }
        ctx.setLineDash([])

        // Resize handles
        if (selectedIds.size === 1) {
          const handleSize = 8 / zoom
          ctx.fillStyle = '#FFFFFF'
          ctx.strokeStyle = '#3A7BC8'
          ctx.lineWidth = 1.5 / zoom
          let bx: number, by: number, bw: number, bh: number
          if (el.type === 'freehand' && el.points && el.points.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            for (const p of el.points) {
              minX = Math.min(minX, p.x)
              minY = Math.min(minY, p.y)
              maxX = Math.max(maxX, p.x)
              maxY = Math.max(maxY, p.y)
            }
            bx = minX - 4; by = minY - 4; bw = maxX - minX + 8; bh = maxY - minY + 8
          } else {
            bx = el.x - 4; by = el.y - 4; bw = (el.width ?? 100) + 8; bh = (el.height ?? 40) + 8
          }
          const corners = [
            [bx, by], [bx + bw, by],
            [bx, by + bh], [bx + bw, by + bh],
          ]
          for (const [cx, cy] of corners) {
            ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize)
            ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize)
          }
        }
      }

      ctx.restore()
    }

    // Collaborator cursors
    if (collaborators) {
      for (const collab of collaborators) {
        if (collab.cursorX == null || collab.cursorY == null) continue
        ctx.save()
        ctx.fillStyle = collab.color
        ctx.beginPath()
        const cx = collab.cursorX
        const cy = collab.cursorY
        // Arrow cursor shape
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx, cy + 16)
        ctx.lineTo(cx + 4.5, cy + 12.5)
        ctx.lineTo(cx + 10, cy + 18)
        ctx.lineTo(cx + 12.5, cy + 15.5)
        ctx.lineTo(cx + 6.5, cy + 9.5)
        ctx.lineTo(cx + 11, cy + 8)
        ctx.closePath()
        ctx.fill()
        // Name label
        ctx.font = `11px ${typography.fontFamily}`
        const labelW = ctx.measureText(collab.name).width + 8
        ctx.fillStyle = collab.color
        const labelRadius = 3
        const lx = cx + 12
        const ly = cy + 16
        ctx.beginPath()
        ctx.roundRect(lx, ly, labelW, 18, labelRadius)
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
        ctx.textBaseline = 'middle'
        ctx.fillText(collab.name, lx + 4, ly + 9)
        ctx.restore()
      }
    }

    ctx.restore()

    // ── Minimap ────────────────────────────────────────────
    if (elements.length > 0) {
      const mmW = 140
      const mmH = 100
      const mmX = rect.width - mmW - 12
      const mmY = rect.height - mmH - 12

      // Background
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(mmX, mmY, mmW, mmH, 6)
      ctx.fill()
      ctx.stroke()

      // Compute world bounds
      let wMinX = Infinity, wMinY = Infinity, wMaxX = -Infinity, wMaxY = -Infinity
      for (const el of elements) {
        wMinX = Math.min(wMinX, el.x)
        wMinY = Math.min(wMinY, el.y)
        wMaxX = Math.max(wMaxX, el.x + (el.width ?? 100))
        wMaxY = Math.max(wMaxY, el.y + (el.height ?? 100))
      }
      const pad = 100
      wMinX -= pad; wMinY -= pad; wMaxX += pad; wMaxY += pad
      const worldW = wMaxX - wMinX || 1
      const worldH = wMaxY - wMinY || 1
      const scale = Math.min((mmW - 8) / worldW, (mmH - 8) / worldH)

      ctx.save()
      ctx.beginPath()
      ctx.roundRect(mmX, mmY, mmW, mmH, 6)
      ctx.clip()

      // Draw element dots
      for (const el of elements) {
        const ex = mmX + 4 + (el.x - wMinX) * scale
        const ey = mmY + 4 + (el.y - wMinY) * scale
        ctx.fillStyle = el.color === '#FFFFFF' ? '#CCCCCC' : el.color
        ctx.fillRect(ex, ey, Math.max(2, (el.width ?? 10) * scale), Math.max(2, (el.height ?? 10) * scale))
      }

      // Viewport rect
      const vpLeft = (-viewportX / zoom - wMinX) * scale + mmX + 4
      const vpTop = (-viewportY / zoom - wMinY) * scale + mmY + 4
      const vpW = (rect.width / zoom) * scale
      const vpH = (rect.height / zoom) * scale
      ctx.strokeStyle = '#F47820'
      ctx.lineWidth = 1.5
      ctx.strokeRect(vpLeft, vpTop, vpW, vpH)

      ctx.restore()
    }
  }, [elements, viewportX, viewportY, zoom, gridEnabled, selectedIds, isDrawing, collaborators])

  // ── Render loop ──────────────────────────────────────────

  const animFrameRef = useRef<number>(0)

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(drawElements)
  }, [drawElements])

  useEffect(() => {
    scheduleRender()
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [scheduleRender])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => scheduleRender())
    ro.observe(container)
    return () => ro.disconnect()
  }, [scheduleRender])

  // ── Mouse handlers ───────────────────────────────────────

  const getCanvasPos = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return
    const pos = getCanvasPos(e)
    const world = screenToWorld(pos.x, pos.y)

    // Middle mouse or space+click = pan
    if (e.button === 1 || (spaceHeld && e.button === 0)) {
      setIsPanning(true)
      panStartRef.current = { x: e.clientX, y: e.clientY, vx: viewportX, vy: viewportY }
      e.preventDefault()
      return
    }

    if (e.button !== 0) return

    const wx = snapToGrid(world.x, gridEnabled)
    const wy = snapToGrid(world.y, gridEnabled)

    if (tool === 'select') {
      // Hit test for selection
      let hit: WhiteboardElement | null = null
      for (let i = elements.length - 1; i >= 0; i--) {
        if (hitTestElement(elements[i], world.x, world.y)) {
          hit = elements[i]
          break
        }
      }
      if (hit) {
        if (e.shiftKey) {
          setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(hit!.id)) next.delete(hit!.id)
            else next.add(hit!.id)
            return next
          })
        } else {
          if (!selectedIds.has(hit.id)) {
            setSelectedIds(new Set([hit.id]))
          }
        }
        setIsDrawing(true)
        dragOffsetRef.current = { x: world.x, y: world.y }
      } else {
        setSelectedIds(new Set())
      }
      return
    }

    if (tool === 'eraser') {
      for (let i = elements.length - 1; i >= 0; i--) {
        if (hitTestElement(elements[i], world.x, world.y)) {
          const newEls = elements.filter((_, idx) => idx !== i)
          setElements(newEls)
          pushHistory(newEls)
          break
        }
      }
      return
    }

    if (tool === 'text') {
      // Place text
      const newEl: WhiteboardElement = {
        id: generateId(),
        type: 'text',
        x: wx,
        y: wy,
        width: 200,
        height: 30,
        text: '',
        color: activeColor,
        strokeWidth,
        fontSize: 16,
      }
      const newEls = [...elements, newEl]
      setElements(newEls)
      pushHistory(newEls)
      // Open inline editor
      const screenPos = worldToScreen(wx, wy)
      setEditingText({ id: newEl.id, x: screenPos.x, y: screenPos.y, width: 200 * zoom, height: 80 * zoom })
      setTextValue('')
      setTimeout(() => textInputRef.current?.focus(), 50)
      return
    }

    if (tool === 'sticky_note') {
      const newEl: WhiteboardElement = {
        id: generateId(),
        type: 'sticky_note',
        x: wx,
        y: wy,
        width: 150,
        height: 150,
        text: '',
        color: '#1A1613',
        strokeWidth: 1,
        fill: stickyColor,
        fontSize: 14,
      }
      const newEls = [...elements, newEl]
      setElements(newEls)
      pushHistory(newEls)
      const screenPos = worldToScreen(wx, wy)
      setEditingText({ id: newEl.id, x: screenPos.x + 8 * zoom, y: screenPos.y + 8 * zoom, width: 134 * zoom, height: 134 * zoom })
      setTextValue('')
      setTimeout(() => textInputRef.current?.focus(), 50)
      return
    }

    // Shape/line/freehand tools
    setIsDrawing(true)
    drawStartRef.current = { x: wx, y: wy }

    const partial: WhiteboardElement = {
      id: generateId(),
      type: tool as WhiteboardElement['type'],
      x: wx,
      y: wy,
      width: 0,
      height: 0,
      color: activeColor,
      strokeWidth,
      points: tool === 'freehand' ? [{ x: wx, y: wy }] : undefined,
    }
    currentElementRef.current = partial
  }, [readOnly, getCanvasPos, screenToWorld, worldToScreen, spaceHeld, viewportX, viewportY, tool, elements, selectedIds, gridEnabled, activeColor, strokeWidth, stickyColor, zoom, pushHistory])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setViewportX(panStartRef.current.vx + dx)
      setViewportY(panStartRef.current.vy + dy)
      return
    }

    if (!isDrawing) return
    const pos = getCanvasPos(e)
    const world = screenToWorld(pos.x, pos.y)
    const wx = snapToGrid(world.x, gridEnabled)
    const wy = snapToGrid(world.y, gridEnabled)

    // Dragging selected elements
    if (tool === 'select' && dragOffsetRef.current && selectedIds.size > 0) {
      const dx = world.x - dragOffsetRef.current.x
      const dy = world.y - dragOffsetRef.current.y
      dragOffsetRef.current = { x: world.x, y: world.y }
      setElements(prev => prev.map(el => {
        if (!selectedIds.has(el.id)) return el
        const moved = { ...el, x: el.x + dx, y: el.y + dy }
        if (moved.points) {
          moved.points = moved.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
        }
        return moved
      }))
      scheduleRender()
      return
    }

    if (!currentElementRef.current || !drawStartRef.current) return

    if (currentElementRef.current.type === 'freehand') {
      currentElementRef.current = {
        ...currentElementRef.current,
        points: [...(currentElementRef.current.points ?? []), { x: wx, y: wy }],
      }
    } else {
      currentElementRef.current = {
        ...currentElementRef.current,
        width: wx - drawStartRef.current.x,
        height: wy - drawStartRef.current.y,
      }
    }
    scheduleRender()
  }, [isPanning, isDrawing, getCanvasPos, screenToWorld, gridEnabled, tool, selectedIds, scheduleRender])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      panStartRef.current = null
      return
    }

    if (!isDrawing) return
    setIsDrawing(false)

    if (tool === 'select') {
      dragOffsetRef.current = null
      // Push history for drag
      pushHistory(elements)
      return
    }

    if (currentElementRef.current) {
      const el = currentElementRef.current
      // Skip tiny shapes
      const w = Math.abs(el.width ?? 0)
      const h = Math.abs(el.height ?? 0)
      const hasSize = el.type === 'freehand'
        ? (el.points?.length ?? 0) > 2
        : w > 3 || h > 3
      if (hasSize) {
        const newEls = [...elements, el]
        setElements(newEls)
        pushHistory(newEls)
      }
    }
    currentElementRef.current = null
    drawStartRef.current = null
  }, [isPanning, isDrawing, tool, elements, pushHistory])

  // ── Wheel zoom ───────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const pos = getCanvasPos(e)
    const factor = e.deltaY < 0 ? 1.08 : 0.93
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))

    // Zoom toward cursor
    const wx = (pos.x - viewportX) / zoom
    const wy = (pos.y - viewportY) / zoom
    setViewportX(pos.x - wx * newZoom)
    setViewportY(pos.y - wy * newZoom)
    setZoom(newZoom)
  }, [getCanvasPos, zoom, viewportX, viewportY])

  // ── Keyboard shortcuts ───────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingText) return

      if (e.key === ' ') {
        e.preventDefault()
        setSpaceHeld(true)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          const newEls = elements.filter(el => !selectedIds.has(el.id))
          setElements(newEls)
          pushHistory(newEls)
          setSelectedIds(new Set())
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      // Tool shortcuts
      if (!e.metaKey && !e.ctrlKey) {
        const map: Record<string, ToolType> = {
          v: 'select', r: 'rectangle', e: 'ellipse', l: 'line',
          a: 'arrow', p: 'freehand', t: 'text', s: 'sticky_note', x: 'eraser',
        }
        if (map[e.key]) setTool(map[e.key])
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceHeld(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [editingText, selectedIds, elements, pushHistory, undo, redo])

  // ── Text editing commit ──────────────────────────────────

  const commitText = useCallback(() => {
    if (!editingText) return
    const newEls = elements.map(el => {
      if (el.id !== editingText.id) return el
      const updated = { ...el, text: textValue }
      if (el.type === 'text') {
        // Measure text width
        const lines = textValue.split('\n')
        const fontSize = el.fontSize ?? 16
        updated.width = Math.max(50, Math.max(...lines.map(l => l.length * fontSize * 0.6)))
        updated.height = lines.length * fontSize * 1.3
      }
      return updated
    })
    setElements(newEls)
    pushHistory(newEls)
    setEditingText(null)
    setTextValue('')
  }, [editingText, textValue, elements, pushHistory])

  // ── Export PNG ────────────────────────────────────────────

  const exportPng = useCallback(() => {
    if (elements.length === 0) return
    // Find bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const el of elements) {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + (el.width ?? 100))
      maxY = Math.max(maxY, el.y + (el.height ?? 100))
    }
    const pad = 40
    const w = maxX - minX + pad * 2
    const h = maxY - minY + pad * 2

    const offscreen = document.createElement('canvas')
    offscreen.width = w * 2
    offscreen.height = h * 2
    const ctx = offscreen.getContext('2d')!
    ctx.scale(2, 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.translate(-minX + pad, -minY + pad)

    for (const el of elements) {
      ctx.save()
      ctx.strokeStyle = el.color
      ctx.lineWidth = el.strokeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      switch (el.type) {
        case 'rectangle':
          if (el.fill) { ctx.fillStyle = el.fill; ctx.fillRect(el.x, el.y, el.width ?? 0, el.height ?? 0) }
          ctx.strokeRect(el.x, el.y, el.width ?? 0, el.height ?? 0)
          break
        case 'ellipse': {
          const ew = el.width ?? 0; const eh = el.height ?? 0
          ctx.beginPath(); ctx.ellipse(el.x + ew / 2, el.y + eh / 2, Math.abs(ew / 2), Math.abs(eh / 2), 0, 0, Math.PI * 2)
          if (el.fill) { ctx.fillStyle = el.fill; ctx.fill() }
          ctx.stroke(); break
        }
        case 'line':
          ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + (el.width ?? 0), el.y + (el.height ?? 0)); ctx.stroke(); break
        case 'arrow': {
          const aex = el.x + (el.width ?? 0); const aey = el.y + (el.height ?? 0)
          ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(aex, aey); ctx.stroke()
          const ang = Math.atan2(aey - el.y, aex - el.x); const hl = 12 + el.strokeWidth * 2
          ctx.beginPath(); ctx.moveTo(aex, aey); ctx.lineTo(aex - hl * Math.cos(ang - Math.PI / 6), aey - hl * Math.sin(ang - Math.PI / 6))
          ctx.moveTo(aex, aey); ctx.lineTo(aex - hl * Math.cos(ang + Math.PI / 6), aey - hl * Math.sin(ang + Math.PI / 6)); ctx.stroke(); break
        }
        case 'freehand':
          if (el.points && el.points.length > 1) { ctx.beginPath(); ctx.moveTo(el.points[0].x, el.points[0].y); el.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke() }
          break
        case 'text': {
          const fs = el.fontSize ?? 16; ctx.font = `${fs}px ${typography.fontFamily}`; ctx.fillStyle = el.color; ctx.textBaseline = 'top'
          ;(el.text ?? '').split('\n').forEach((line, i) => ctx.fillText(line, el.x, el.y + i * fs * 1.3)); break
        }
        case 'sticky_note': {
          const sw = el.width ?? 150; const sh = el.height ?? 150
          ctx.fillStyle = el.fill ?? '#FEF9C3'; ctx.fillRect(el.x, el.y, sw, sh)
          ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1; ctx.strokeRect(el.x, el.y, sw, sh)
          if (el.text) {
            ctx.fillStyle = '#1A1613'; const sfs = el.fontSize ?? 14; ctx.font = `${sfs}px ${typography.fontFamily}`; ctx.textBaseline = 'top'
            const maxW2 = sw - 16; const words = el.text.split(' '); let line = ''; let ly = el.y + 12
            for (const word of words) { const test = line ? line + ' ' + word : word; if (ctx.measureText(test).width > maxW2 && line) { ctx.fillText(line, el.x + 8, ly); line = word; ly += sfs * 1.4 } else { line = test } }
            if (line) ctx.fillText(line, el.x + 8, ly)
          }
          break
        }
      }
      ctx.restore()
    }

    const link = document.createElement('a')
    link.download = 'whiteboard.png'
    link.href = offscreen.toDataURL('image/png')
    link.click()
  }, [elements])

  // ── Save data ────────────────────────────────────────────

  const getData = useCallback((): WhiteboardData => ({
    elements,
    viewportX,
    viewportY,
    zoom,
  }), [elements, viewportX, viewportY, zoom])

  // Expose save via ref-style callback
  useEffect(() => {
    if (onSave) {
      // Attach to window for external access
      (window as unknown as Record<string, unknown>).__whiteboardGetData = getData
    }
  }, [onSave, getData])

  // ── Styles ───────────────────────────────────────────────

  const toolbarStyle: React.CSSProperties = {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['1'],
    padding: spacing['2'],
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: borderRadius['2xl'],
    boxShadow: shadows.dropdown,
    border: `1px solid rgba(0, 0, 0, 0.06)`,
    zIndex: 10,
  }

  const toolButtonStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    border: 'none',
    background: active ? colors.primaryOrange : 'transparent',
    color: active ? '#FFFFFF' : colors.textPrimary,
    cursor: 'pointer',
    transition: transitions.quick,
  })

  const bottomBarStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: spacing['3'],
    padding: `${spacing['2']} ${spacing['4']}`,
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: borderRadius.full,
    boxShadow: shadows.dropdown,
    border: `1px solid rgba(0, 0, 0, 0.06)`,
    zIndex: 10,
  }

  const canCursorStyle = useMemo(() => {
    if (spaceHeld || isPanning) return 'grab'
    if (tool === 'freehand' || tool === 'eraser') return 'crosshair'
    if (tool === 'text' || tool === 'sticky_note') return 'text'
    if (tool === 'select') return 'default'
    return 'crosshair'
  }, [spaceHeld, isPanning, tool])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
        background: '#F8F9FA',
      }}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: canCursorStyle, display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
      />

      {/* Text editing overlay */}
      {editingText && (
        <textarea
          ref={textInputRef}
          value={textValue}
          onChange={e => setTextValue(e.target.value)}
          onBlur={commitText}
          onKeyDown={e => {
            if (e.key === 'Escape') commitText()
            if (e.key === 'Enter' && !e.shiftKey && editingText) {
              // Single Enter commits for single-line text; Shift+Enter for newline
              const el = elements.find(el => el.id === editingText.id)
              if (el?.type === 'text') {
                e.preventDefault()
                commitText()
              }
            }
          }}
          style={{
            position: 'absolute',
            left: editingText.x,
            top: editingText.y,
            width: editingText.width,
            height: editingText.height,
            minWidth: 120,
            minHeight: 32,
            background: 'rgba(255,255,255,0.95)',
            border: `2px solid ${colors.primaryOrange}`,
            borderRadius: borderRadius.sm,
            padding: spacing['1'],
            fontFamily: typography.fontFamily,
            fontSize: `${14 * zoom}px`,
            color: colors.textPrimary,
            resize: 'none',
            outline: 'none',
            zIndex: 20,
            boxShadow: shadows.dropdown,
          }}
        />
      )}

      {/* Left toolbar */}
      {!readOnly && (
        <div style={toolbarStyle}>
          {TOOL_ITEMS.map(item => (
            <button
              key={item.tool}
              title={item.label}
              onClick={() => setTool(item.tool)}
              style={toolButtonStyle(tool === item.tool)}
            >
              {item.icon}
            </button>
          ))}

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: 'rgba(0,0,0,0.08)', margin: `${spacing['1']} 0` }} />

          {/* Undo/Redo */}
          <button
            title="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={historyIndex <= 0}
            style={{ ...toolButtonStyle(false), opacity: historyIndex <= 0 ? 0.3 : 1 }}
          >
            <Undo2 size={18} />
          </button>
          <button
            title="Redo (Ctrl+Shift+Z)"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            style={{ ...toolButtonStyle(false), opacity: historyIndex >= history.length - 1 ? 0.3 : 1 }}
          >
            <Redo2 size={18} />
          </button>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: 'rgba(0,0,0,0.08)', margin: `${spacing['1']} 0` }} />

          {/* Grid toggle */}
          <button
            title="Toggle Grid"
            onClick={() => setGridEnabled(!gridEnabled)}
            style={toolButtonStyle(gridEnabled)}
          >
            <Grid3X3 size={18} />
          </button>

          {/* Export */}
          <button
            title="Save as PNG"
            onClick={exportPng}
            style={toolButtonStyle(false)}
          >
            <Download size={18} />
          </button>
        </div>
      )}

      {/* Bottom bar: color + stroke */}
      {!readOnly && (
        <div style={bottomBarStyle}>
          {/* Colors */}
          {PALETTE_COLORS.map(c => (
            <button
              key={c}
              title={c}
              onClick={() => setActiveColor(c)}
              style={{
                width: 22,
                height: 22,
                borderRadius: borderRadius.full,
                border: activeColor === c ? `2px solid ${colors.primaryOrange}` : '2px solid rgba(0,0,0,0.12)',
                background: c,
                cursor: 'pointer',
                padding: 0,
                boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
              }}
            />
          ))}

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)' }} />

          {/* Stroke widths */}
          {STROKE_WIDTHS.map(sw => (
            <button
              key={sw}
              title={`${sw}px`}
              onClick={() => setStrokeWidth(sw)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: borderRadius.md,
                border: strokeWidth === sw ? `2px solid ${colors.primaryOrange}` : '1px solid rgba(0,0,0,0.08)',
                background: strokeWidth === sw ? colors.orangeSubtle : 'transparent',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div style={{
                width: 16,
                height: sw,
                borderRadius: sw,
                background: colors.textPrimary,
              }} />
            </button>
          ))}

          {/* Divider for sticky colors when sticky tool active */}
          {tool === 'sticky_note' && (
            <>
              <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)' }} />
              {STICKY_COLORS.map(sc => (
                <button
                  key={sc.name}
                  title={sc.name}
                  onClick={() => setStickyColor(sc.value)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: borderRadius.sm,
                    border: stickyColor === sc.value ? `2px solid ${colors.primaryOrange}` : '2px solid rgba(0,0,0,0.12)',
                    background: sc.value,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </>
          )}

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)' }} />

          {/* Zoom controls */}
          <button
            title="Zoom Out"
            onClick={() => {
              const newZ = Math.max(MIN_ZOOM, zoom * 0.8)
              setZoom(newZ)
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, border: 'none', borderRadius: borderRadius.md,
              background: 'transparent', cursor: 'pointer', color: colors.textPrimary,
            }}
          >
            <ZoomOut size={16} />
          </button>
          <span style={{
            fontSize: typography.fontSize.label,
            fontFamily: typography.fontFamily,
            color: colors.textSecondary,
            minWidth: 40,
            textAlign: 'center',
            userSelect: 'none',
          }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            title="Zoom In"
            onClick={() => {
              const newZ = Math.min(MAX_ZOOM, zoom * 1.25)
              setZoom(newZ)
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, border: 'none', borderRadius: borderRadius.md,
              background: 'transparent', cursor: 'pointer', color: colors.textPrimary,
            }}
          >
            <ZoomIn size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export default Whiteboard
