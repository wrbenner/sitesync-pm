import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme'

// ── Types ────────────────────────────────────────────────

export interface GraphNode {
  id: string
  type: 'rfi' | 'submittal' | 'change_order' | 'punch_item' | 'schedule_phase' | 'drawing' | 'budget_line' | 'spec_section'
  label: string
  status?: string
  priority?: string
  metadata?: Record<string, unknown>
}

export interface GraphEdge {
  source: string
  target: string
  relationship: string
}

export interface IntelligenceGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick?: (node: GraphNode) => void
  height?: number | string
  highlightedNodeId?: string
}

// ── Internal sim types ───────────────────────────────────

interface SimNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
  fx: number
  fy: number
  radius: number
  connectionCount: number
  pinned: boolean
}

interface SimEdge {
  source: SimNode
  target: SimNode
  relationship: string
}

// ── Constants ────────────────────────────────────────────

const NODE_COLORS: Record<GraphNode['type'], string> = {
  rfi: '#3B82F6',
  submittal: '#22C55E',
  change_order: '#F97316',
  punch_item: '#EF4444',
  schedule_phase: '#8B5CF6',
  drawing: '#14B8A6',
  budget_line: '#EAB308',
  spec_section: '#6B7280',
}

const NODE_TYPE_LABELS: Record<GraphNode['type'], string> = {
  rfi: 'RFI',
  submittal: 'Submittal',
  change_order: 'Change Order',
  punch_item: 'Punch Item',
  schedule_phase: 'Schedule Phase',
  drawing: 'Drawing',
  budget_line: 'Budget Line',
  spec_section: 'Spec Section',
}

const EDGE_STYLES: Record<string, { dash: number[]; label: string }> = {
  references: { dash: [], label: 'References' },
  blocks: { dash: [8, 4], label: 'Blocks' },
  caused_by: { dash: [], label: 'Caused By' },
  linked_to: { dash: [3, 3], label: 'Linked To' },
  required_by: { dash: [12, 4, 3, 4], label: 'Required By' },
}

const STATUS_DOT_COLORS: Record<string, string> = {
  open: '#22C55E',
  active: '#22C55E',
  approved: '#22C55E',
  on_track: '#22C55E',
  complete: '#22C55E',
  resolved: '#22C55E',
  answered: '#22C55E',
  pending: '#EAB308',
  under_review: '#EAB308',
  in_review: '#EAB308',
  submitted: '#EAB308',
  in_progress: '#3B82F6',
  overdue: '#EF4444',
  rejected: '#EF4444',
  behind: '#EF4444',
  at_risk: '#EF4444',
  closed: '#6B7280',
  draft: '#6B7280',
  void: '#6B7280',
}

const MIN_NODE_RADIUS = 16
const MAX_NODE_RADIUS = 36
const REPULSION_STRENGTH = 800
const SPRING_STRENGTH = 0.004
const SPRING_LENGTH = 140
const CENTER_GRAVITY = 0.01
const DAMPING = 0.85
const VELOCITY_THRESHOLD = 0.01
const ARROW_SIZE = 8
const TOOLTIP_OFFSET = 12

// ── Shape drawers ────────────────────────────────────────

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r, y)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawSquare(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const s = r * 0.85
  ctx.beginPath()
  ctx.rect(x - s, y - s, s * 2, s * 2)
  ctx.fill()
  ctx.stroke()
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const h = r * 1.1
  ctx.beginPath()
  ctx.moveTo(x, y - h)
  ctx.lineTo(x + h, y + h * 0.6)
  ctx.lineTo(x - h, y + h * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const w = r * 1.6
  const h = r * 1.0
  const cr = 5
  ctx.beginPath()
  ctx.moveTo(x - w + cr, y - h)
  ctx.lineTo(x + w - cr, y - h)
  ctx.quadraticCurveTo(x + w, y - h, x + w, y - h + cr)
  ctx.lineTo(x + w, y + h - cr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h)
  ctx.lineTo(x - w + cr, y + h)
  ctx.quadraticCurveTo(x - w, y + h, x - w, y + h - cr)
  ctx.lineTo(x - w, y - h + cr)
  ctx.quadraticCurveTo(x - w, y - h, x - w + cr, y - h)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    const px = x + r * Math.cos(angle)
    const py = y + r * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const w = r * 1.4
  const h = r * 0.7
  ctx.beginPath()
  ctx.moveTo(x - w + h, y - h)
  ctx.lineTo(x + w - h, y - h)
  ctx.arc(x + w - h, y, h, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(x - w + h, y + h)
  ctx.arc(x - w + h, y, h, Math.PI / 2, -Math.PI / 2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawDocIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const w = r * 0.8
  const h = r * 1.1
  const fold = r * 0.35
  ctx.beginPath()
  ctx.moveTo(x - w, y - h)
  ctx.lineTo(x + w - fold, y - h)
  ctx.lineTo(x + w, y - h + fold)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x - w, y + h)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // fold line
  ctx.beginPath()
  ctx.moveTo(x + w - fold, y - h)
  ctx.lineTo(x + w - fold, y - h + fold)
  ctx.lineTo(x + w, y - h + fold)
  ctx.stroke()
}

const SHAPE_DRAWERS: Record<GraphNode['type'], (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => void> = {
  rfi: drawCircle,
  submittal: drawDiamond,
  change_order: drawSquare,
  punch_item: drawTriangle,
  schedule_phase: drawRoundedRect,
  drawing: drawHexagon,
  budget_line: drawPill,
  spec_section: drawDocIcon,
}

// ── Component ────────────────────────────────────────────

export function IntelligenceGraph({
  nodes: inputNodes,
  edges: inputEdges,
  onNodeClick,
  height = 600,
  highlightedNodeId,
}: IntelligenceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simNodesRef = useRef<SimNode[]>([])
  const simEdgesRef = useRef<SimEdge[]>([])
  const animFrameRef = useRef<number>(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<SimEdge | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(highlightedNodeId ?? null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Transform state
  const transformRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 })
  const dragRef = useRef<{
    isDragging: boolean
    isPanning: boolean
    dragNode: SimNode | null
    startX: number
    startY: number
    lastClickTime: number
    lastClickNodeId: string | null
  }>({
    isDragging: false,
    isPanning: false,
    dragNode: null,
    startX: 0,
    startY: 0,
    lastClickTime: 0,
    lastClickNodeId: null,
  })

  const settledRef = useRef(false)

  // ── Build sim data ──

  useEffect(() => {
    const connectionCounts: Record<string, number> = {}
    inputNodes.forEach(n => { connectionCounts[n.id] = 0 })
    inputEdges.forEach(e => {
      connectionCounts[e.source] = (connectionCounts[e.source] ?? 0) + 1
      connectionCounts[e.target] = (connectionCounts[e.target] ?? 0) + 1
    })

    const maxConn = Math.max(1, ...Object.values(connectionCounts))

    const simNodes: SimNode[] = inputNodes.map((n, i) => {
      const existing = simNodesRef.current.find(sn => sn.id === n.id)
      const cc = connectionCounts[n.id] ?? 0
      const radius = MIN_NODE_RADIUS + (MAX_NODE_RADIUS - MIN_NODE_RADIUS) * (cc / maxConn)
      const angle = (2 * Math.PI * i) / inputNodes.length
      const spread = 200

      return {
        ...n,
        x: existing?.x ?? Math.cos(angle) * spread + (Math.random() - 0.5) * 40, // immune-ok: force-directed physics jitter
        y: existing?.y ?? Math.sin(angle) * spread + (Math.random() - 0.5) * 40, // immune-ok: force-directed physics jitter
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: 0,
        fy: 0,
        radius,
        connectionCount: cc,
        pinned: existing?.pinned ?? false,
      }
    })

    const nodeMap = new Map(simNodes.map(n => [n.id, n]))

    const simEdges: SimEdge[] = inputEdges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        relationship: e.relationship,
      }))

    simNodesRef.current = simNodes
    simEdgesRef.current = simEdges
    settledRef.current = false
  }, [inputNodes, inputEdges])

  // ── Coordinate transforms ──

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const t = transformRef.current
    return {
      x: (sx - t.offsetX) / t.scale,
      y: (sy - t.offsetY) / t.scale,
    }
  }, [])

  const worldToScreen = useCallback((wx: number, wy: number) => {
    const t = transformRef.current
    return {
      x: wx * t.scale + t.offsetX,
      y: wy * t.scale + t.offsetY,
    }
  }, [])

  // ── Find node/edge at position ──

  const findNodeAt = useCallback((wx: number, wy: number): SimNode | null => {
    const nodes = simNodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      const dx = wx - n.x
      const dy = wy - n.y
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) {
        return n
      }
    }
    return null
  }, [])

  const findEdgeAt = useCallback((wx: number, wy: number): SimEdge | null => {
    const edges = simEdgesRef.current
    for (const e of edges) {
      const mx = (e.source.x + e.target.x) / 2
      const my = (e.source.y + e.target.y) / 2
      // offset for curve
      const dx = e.target.x - e.source.x
      const dy = e.target.y - e.source.y
      const cx = mx - dy * 0.1
      const cy = my + dx * 0.1

      // check distance to quadratic bezier (approximate: check midpoint)
      const ddx = wx - cx
      const ddy = wy - cy
      if (ddx * ddx + ddy * ddy < 200) return e

      // check along the curve at a few points
      for (let t = 0; t <= 1; t += 0.1) {
        const px = (1 - t) * (1 - t) * e.source.x + 2 * (1 - t) * t * cx + t * t * e.target.x
        const py = (1 - t) * (1 - t) * e.source.y + 2 * (1 - t) * t * cy + t * t * e.target.y
        const ddx2 = wx - px
        const ddy2 = wy - py
        if (ddx2 * ddx2 + ddy2 * ddy2 < 100) return e
      }
    }
    return null
  }, [])

  // ── Physics step ──

  const physicsStep = useCallback(() => {
    const nodes = simNodesRef.current
    const edges = simEdgesRef.current

    // Reset forces
    for (const n of nodes) {
      n.fx = 0
      n.fy = 0
    }

    // Repulsion (Coulomb)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 1) { dist = 1; dx = Math.random() - 0.5; dy = Math.random() - 0.5 } // immune-ok: repulsion degenerate-case physics
        const force = REPULSION_STRENGTH / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.fx -= fx
        a.fy -= fy
        b.fx += fx
        b.fy += fy
      }
    }

    // Spring attraction along edges
    for (const e of edges) {
      const dx = e.target.x - e.source.x
      const dy = e.target.y - e.source.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.1) continue
      const displacement = dist - SPRING_LENGTH
      const force = SPRING_STRENGTH * displacement
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      e.source.fx += fx
      e.source.fy += fy
      e.target.fx -= fx
      e.target.fy -= fy
    }

    // Center gravity
    for (const n of nodes) {
      n.fx -= n.x * CENTER_GRAVITY
      n.fy -= n.y * CENTER_GRAVITY
    }

    // Integrate velocities
    let totalVelocity = 0
    for (const n of nodes) {
      if (n.pinned) { n.vx = 0; n.vy = 0; continue }
      n.vx = (n.vx + n.fx) * DAMPING
      n.vy = (n.vy + n.fy) * DAMPING
      n.x += n.vx
      n.y += n.vy
      totalVelocity += Math.abs(n.vx) + Math.abs(n.vy)
    }

    return totalVelocity / Math.max(1, nodes.length)
  }, [])

  // ── Draw ──

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const t = transformRef.current
    // Auto center
    if (t.offsetX === 0 && t.offsetY === 0) {
      t.offsetX = w / 2
      t.offsetY = h / 2
    }

    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.translate(t.offsetX, t.offsetY)
    ctx.scale(t.scale, t.scale)

    const nodes = simNodesRef.current
    const edges = simEdgesRef.current
    const selId = selectedNodeId
    const connectedIds = new Set<string>()

    if (selId) {
      connectedIds.add(selId)
      for (const e of edges) {
        if (e.source.id === selId) connectedIds.add(e.target.id)
        if (e.target.id === selId) connectedIds.add(e.source.id)
      }
    }

    // Draw edges
    for (const e of edges) {
      const isHighlighted = selId ? (connectedIds.has(e.source.id) && connectedIds.has(e.target.id)) : true
      const alpha = isHighlighted ? 0.6 : 0.08

      const mx = (e.source.x + e.target.x) / 2
      const my = (e.source.y + e.target.y) / 2
      const dx = e.target.x - e.source.x
      const dy = e.target.y - e.source.y
      const cx = mx - dy * 0.1
      const cy = my + dx * 0.1

      ctx.beginPath()
      ctx.moveTo(e.source.x, e.source.y)
      ctx.quadraticCurveTo(cx, cy, e.target.x, e.target.y)

      const style = EDGE_STYLES[e.relationship] ?? EDGE_STYLES.references
      ctx.setLineDash(style.dash)
      ctx.strokeStyle = `rgba(140, 140, 140, ${alpha})`
      ctx.lineWidth = isHighlighted ? 2 : 1
      ctx.stroke()
      ctx.setLineDash([])

      // Arrowhead
      if (isHighlighted) {
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len > 0) {
          // Point on curve near target
          const tt = 0.92
          const ax = (1 - tt) * (1 - tt) * e.source.x + 2 * (1 - tt) * tt * cx + tt * tt * e.target.x
          const ay = (1 - tt) * (1 - tt) * e.source.y + 2 * (1 - tt) * tt * cy + tt * tt * e.target.y
          const adx = e.target.x - ax
          const ady = e.target.y - ay
          const alen = Math.sqrt(adx * adx + ady * ady)
          if (alen > 0) {
            const ux = adx / alen
            const uy = ady / alen
            const tipX = e.target.x - ux * e.target.radius
            const tipY = e.target.y - uy * e.target.radius
            ctx.beginPath()
            ctx.moveTo(tipX, tipY)
            ctx.lineTo(tipX - ux * ARROW_SIZE - uy * ARROW_SIZE * 0.5, tipY - uy * ARROW_SIZE + ux * ARROW_SIZE * 0.5)
            ctx.lineTo(tipX - ux * ARROW_SIZE + uy * ARROW_SIZE * 0.5, tipY - uy * ARROW_SIZE - ux * ARROW_SIZE * 0.5)
            ctx.closePath()
            ctx.fillStyle = `rgba(140, 140, 140, ${alpha})`
            ctx.fill()
          }
        }
      }
    }

    // Draw nodes
    for (const n of nodes) {
      const isHighlighted = selId ? connectedIds.has(n.id) : true
      const alpha = isHighlighted ? 1 : 0.15
      const baseColor = NODE_COLORS[n.type]

      ctx.globalAlpha = alpha
      ctx.fillStyle = baseColor
      ctx.strokeStyle = n.id === selId ? '#FFFFFF' : 'rgba(255,255,255,0.3)'
      ctx.lineWidth = n.id === selId ? 3 : 1

      const drawer = SHAPE_DRAWERS[n.type]
      drawer(ctx, n.x, n.y, n.radius)

      // Status dot
      if (n.status) {
        const dotColor = STATUS_DOT_COLORS[n.status] ?? '#6B7280'
        ctx.beginPath()
        ctx.arc(n.x + n.radius * 0.65, n.y - n.radius * 0.65, 5, 0, Math.PI * 2)
        ctx.fillStyle = dotColor
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1.5
        ctx.fill()
        ctx.stroke()
      }

      // Label
      ctx.fillStyle = isHighlighted ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)'
      ctx.font = `500 ${Math.max(10, n.radius * 0.55)}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(n.label, n.x, n.y + n.radius + 4, 120)

      ctx.globalAlpha = 1
    }

    // Search highlight ring
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      for (const n of nodes) {
        if (n.label.toLowerCase().includes(term) || n.id.toLowerCase().includes(term)) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.radius + 8, 0, Math.PI * 2)
          ctx.strokeStyle = '#FBBF24'
          ctx.lineWidth = 3
          ctx.setLineDash([4, 4])
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
    }

    ctx.restore()
  }, [selectedNodeId, searchTerm])

  // ── Animation loop ──

  useEffect(() => {
    let running = true

    const tick = () => {
      if (!running) return
      if (!settledRef.current) {
        const avgV = physicsStep()
        if (avgV < VELOCITY_THRESHOLD) {
          settledRef.current = true
        }
      }
      draw()
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [physicsStep, draw])

  // ── Mouse handlers ──

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x: wx, y: wy } = screenToWorld(sx, sy)

    const node = findNodeAt(wx, wy)

    const now = Date.now()
    const drag = dragRef.current

    // Double click detection
    if (node && drag.lastClickNodeId === node.id && now - drag.lastClickTime < 400) {
      onNodeClick?.(node)
      drag.lastClickTime = 0
      drag.lastClickNodeId = null
      return
    }

    drag.lastClickTime = now
    drag.lastClickNodeId = node?.id ?? null

    if (node) {
      drag.isDragging = true
      drag.dragNode = node
      node.pinned = true
      settledRef.current = false
      drag.startX = wx
      drag.startY = wy
    } else {
      drag.isPanning = true
      drag.startX = e.clientX
      drag.startY = e.clientY
    }
  }, [screenToWorld, findNodeAt, onNodeClick])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x: wx, y: wy } = screenToWorld(sx, sy)
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })

    const drag = dragRef.current

    if (drag.isDragging && drag.dragNode) {
      drag.dragNode.x = wx
      drag.dragNode.y = wy
      drag.dragNode.vx = 0
      drag.dragNode.vy = 0
      settledRef.current = false
    } else if (drag.isPanning) {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      transformRef.current.offsetX += dx
      transformRef.current.offsetY += dy
      drag.startX = e.clientX
      drag.startY = e.clientY
    } else {
      const node = findNodeAt(wx, wy)
      setHoveredNode(node)
      if (!node) {
        const edge = findEdgeAt(wx, wy)
        setHoveredEdge(edge)
      } else {
        setHoveredEdge(null)
      }
    }
  }, [screenToWorld, findNodeAt, findEdgeAt])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (drag.isDragging && drag.dragNode) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const { x: wx, y: wy } = screenToWorld(sx, sy)
        const movedDist = Math.sqrt((wx - drag.startX) ** 2 + (wy - drag.startY) ** 2)
        // If barely moved, treat as click -> select
        if (movedDist < 5) {
          setSelectedNodeId(prev => prev === drag.dragNode!.id ? null : drag.dragNode!.id)
        }
      }
      drag.dragNode.pinned = false
    }
    drag.isDragging = false
    drag.isPanning = false
    drag.dragNode = null
    settledRef.current = false
  }, [screenToWorld])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const t = transformRef.current
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92
    const newScale = Math.max(0.1, Math.min(5, t.scale * zoomFactor))

    // Zoom toward mouse
    t.offsetX = sx - (sx - t.offsetX) * (newScale / t.scale)
    t.offsetY = sy - (sy - t.offsetY) * (newScale / t.scale)
    t.scale = newScale
  }, [])

  // ── Tooltip content ──

  const tooltip = useMemo(() => {
    if (hoveredNode) {
      return (
        <div style={{
          position: 'absolute',
          left: mousePos.x + TOOLTIP_OFFSET,
          top: mousePos.y + TOOLTIP_OFFSET,
          background: 'rgba(15, 22, 41, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: borderRadius.md,
          padding: `${spacing['2']} ${spacing['3']}`,
          color: '#fff',
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          pointerEvents: 'none' as const,
          zIndex: zIndex.tooltip,
          maxWidth: 260,
          lineHeight: typography.lineHeight.normal,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{hoveredNode.label}</div>
          <div style={{ opacity: 0.7, fontSize: typography.fontSize.caption }}>
            {NODE_TYPE_LABELS[hoveredNode.type]}
            {hoveredNode.status ? ` \u00b7 ${hoveredNode.status.replace(/_/g, ' ')}` : ''}
            {hoveredNode.priority ? ` \u00b7 ${hoveredNode.priority}` : ''}
          </div>
          <div style={{ opacity: 0.5, fontSize: typography.fontSize.caption, marginTop: 2 }}>
            {hoveredNode.connectionCount} connection{hoveredNode.connectionCount !== 1 ? 's' : ''}
          </div>
          {hoveredNode.metadata && Object.keys(hoveredNode.metadata).length > 0 && (
            <div style={{ opacity: 0.6, fontSize: typography.fontSize.caption, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}>
              {Object.entries(hoveredNode.metadata).slice(0, 3).map(([k, v]) => (
                <div key={k}>{k}: {String(v)}</div>
              ))}
            </div>
          )}
        </div>
      )
    }
    if (hoveredEdge) {
      const style = EDGE_STYLES[hoveredEdge.relationship] ?? EDGE_STYLES.references
      return (
        <div style={{
          position: 'absolute',
          left: mousePos.x + TOOLTIP_OFFSET,
          top: mousePos.y + TOOLTIP_OFFSET,
          background: 'rgba(15, 22, 41, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: borderRadius.md,
          padding: `${spacing['2']} ${spacing['3']}`,
          color: '#fff',
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          pointerEvents: 'none' as const,
          zIndex: zIndex.tooltip,
        }}>
          <div style={{ fontWeight: 600 }}>{style.label}</div>
          <div style={{ opacity: 0.6, fontSize: typography.fontSize.caption }}>
            {hoveredEdge.source.label} &rarr; {hoveredEdge.target.label}
          </div>
        </div>
      )
    }
    return null
  }, [hoveredNode, hoveredEdge, mousePos])

  // ── Legend ──

  const legend = useMemo(() => (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      background: 'rgba(15, 22, 41, 0.9)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: borderRadius.lg,
      padding: spacing['3'],
      color: '#fff',
      fontSize: typography.fontSize.caption,
      fontFamily: typography.fontFamily,
      lineHeight: typography.lineHeight.relaxed,
      maxWidth: 200,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: typography.fontSize.label }}>Node Types</div>
      {(Object.keys(NODE_COLORS) as GraphNode['type'][]).map(type => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: NODE_COLORS[type], display: 'inline-block', flexShrink: 0 }} />
          <span>{NODE_TYPE_LABELS[type]}</span>
        </div>
      ))}
      <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 4, fontSize: typography.fontSize.label }}>Edge Types</div>
      {Object.entries(EDGE_STYLES).map(([key, val]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <svg width={20} height={6}>
            <line
              x1={0} y1={3} x2={20} y2={3}
              stroke="rgba(180,180,180,0.8)"
              strokeWidth={2}
              strokeDasharray={val.dash.length ? val.dash.join(',') : 'none'}
            />
          </svg>
          <span>{val.label}</span>
        </div>
      ))}
    </div>
  ), [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        background: '#0F1629',
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        cursor: hoveredNode ? 'grab' : dragRef.current.isPanning ? 'grabbing' : 'default',
      }}
    >
      {/* Search box */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
      }}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search entities..."
          style={{
            width: 200,
            padding: `${spacing['1.5']} ${spacing['3']}`,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: borderRadius.base,
            color: '#fff',
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
        />
      </div>

      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {tooltip}
      {legend}
    </div>
  )
}

export default IntelligenceGraph
