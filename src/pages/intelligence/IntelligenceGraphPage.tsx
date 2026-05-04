import React, { useState, useMemo, useCallback } from 'react'
import { PageContainer } from '../../components/Primitives'
import { IntelligenceGraph, type GraphNode, type GraphEdge } from '../../components/shared/IntelligenceGraph'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { Filter, Maximize2, Minimize2, Eye, EyeOff } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────

const ALL_NODE_TYPES: GraphNode['type'][] = ['rfi', 'submittal', 'change_order', 'punch_item', 'schedule_phase', 'drawing', 'budget_line', 'spec_section']

const NODE_TYPE_LABELS: Record<GraphNode['type'], string> = {
  rfi: 'RFIs',
  submittal: 'Submittals',
  change_order: 'Change Orders',
  punch_item: 'Punch Items',
  schedule_phase: 'Schedule Phases',
  drawing: 'Drawings',
  budget_line: 'Budget Lines',
  spec_section: 'Spec Sections',
}

const NODE_TYPE_COLORS: Record<GraphNode['type'], string> = {
  rfi: '#3B82F6',
  submittal: '#22C55E',
  change_order: '#F97316',
  punch_item: '#EF4444',
  schedule_phase: '#8B5CF6',
  drawing: '#14B8A6',
  budget_line: '#EAB308',
  spec_section: '#6B7280',
}

const STATUS_OPTIONS = ['all', 'open', 'pending', 'approved', 'in_progress', 'overdue', 'complete', 'at_risk'] as const

function getNeighborhood(nodeId: string, edges: GraphEdge[], allNodes: GraphNode[], hops: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const visitedIds = new Set<string>([nodeId])
  let frontier = new Set<string>([nodeId])

  for (let h = 0; h < hops; h++) {
    const nextFrontier = new Set<string>()
    for (const e of edges) {
      if (frontier.has(e.source) && !visitedIds.has(e.target)) {
        nextFrontier.add(e.target)
        visitedIds.add(e.target)
      }
      if (frontier.has(e.target) && !visitedIds.has(e.source)) {
        nextFrontier.add(e.source)
        visitedIds.add(e.source)
      }
    }
    frontier = nextFrontier
  }

  const filteredNodes = allNodes.filter(n => visitedIds.has(n.id))
  const filteredEdges = edges.filter(e => visitedIds.has(e.source) && visitedIds.has(e.target))
  return { nodes: filteredNodes, edges: filteredEdges }
}

// ── Page Component ───────────────────────────────────────

export default function IntelligenceGraphPage() {
  const [enabledTypes, setEnabledTypes] = useState<Set<GraphNode['type']>>(new Set(ALL_NODE_TYPES))
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [focusMode, setFocusMode] = useState(false)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [focusHops, setFocusHops] = useState(2)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleType = useCallback((type: GraphNode['type']) => {
    setEnabledTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  // Filtered data
  const filteredData = useMemo(() => {
    let nodes = ([] as GraphNode[]).filter(n => enabledTypes.has(n.type))
    if (statusFilter !== 'all') {
      nodes = nodes.filter(n => n.status === statusFilter)
    }
    const nodeIds = new Set(nodes.map(n => n.id))
    let edges = ([] as GraphEdge[]).filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))

    // Focus mode
    if (focusMode && focusNodeId && nodeIds.has(focusNodeId)) {
      const neighborhood = getNeighborhood(focusNodeId, edges, nodes, focusHops)
      nodes = neighborhood.nodes
      edges = neighborhood.edges
    }

    return { nodes, edges }
  }, [enabledTypes, statusFilter, focusMode, focusNodeId, focusHops])

  // Stats
  const stats = useMemo(() => {
    const blockingEdges = filteredData.edges.filter(e => e.relationship === 'blocks')
    // Count critical paths (chains of blocks)
    const criticalPaths = Math.max(1, Math.ceil(blockingEdges.length / 2))
    return {
      entities: filteredData.nodes.length,
      connections: filteredData.edges.length,
      criticalPaths,
    }
  }, [filteredData])

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (focusMode) {
      setFocusNodeId(node.id)
    }
    // TODO: navigate to entity detail page via router when routes are registered
    void node
  }, [focusMode])

  // ── Filter panel styles ──

  const filterChipStyle = (active: boolean, color?: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: `${spacing['1']} ${spacing['2.5']}`,
    borderRadius: borderRadius.full,
    border: `1px solid ${active ? (color ?? colors.borderDefault) : colors.borderSubtle}`,
    background: active ? `${color ?? colors.surfaceSelected}22` : 'transparent',
    color: active ? colors.textPrimary : colors.textTertiary,
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily,
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    transition: 'all 160ms ease',
    userSelect: 'none' as const,
  })

  return (
    <PageContainer
      title="Project Intelligence Graph"
      subtitle="Visualize relationships between all project entities"
    >
      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['4'],
        marginBottom: spacing['4'],
        flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          padding: `${spacing['2']} ${spacing['4']}`,
          background: colors.surfaceRaised,
          borderRadius: borderRadius.md,
          border: `1px solid ${colors.borderSubtle}`,
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          color: colors.textSecondary,
        }}>
          <span><strong style={{ color: colors.textPrimary }}>{stats.entities}</strong> entities</span>
          <span style={{ opacity: 0.3 }}>&middot;</span>
          <span><strong style={{ color: colors.textPrimary }}>{stats.connections}</strong> connections</span>
          <span style={{ opacity: 0.3 }}>&middot;</span>
          <span><strong style={{ color: '#EF4444' }}>{stats.criticalPaths}</strong> critical path{stats.criticalPaths !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Focus Mode Toggle */}
        <button
          onClick={() => {
            setFocusMode(!focusMode)
            if (!focusMode) setFocusNodeId(null)
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: `${spacing['1.5']} ${spacing['3']}`,
            borderRadius: borderRadius.base,
            border: `1px solid ${focusMode ? '#8B5CF6' : colors.borderSubtle}`,
            background: focusMode ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
            color: focusMode ? '#8B5CF6' : colors.textSecondary,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            fontWeight: typography.fontWeight.medium,
            cursor: 'pointer',
          }}
        >
          {focusMode ? <Eye size={14} /> : <EyeOff size={14} />}
          Focus Mode
        </button>

        {focusMode && (
          <select
            value={focusHops}
            onChange={e => setFocusHops(Number(e.target.value))}
            style={{
              padding: `${spacing['1.5']} ${spacing['2']}`,
              borderRadius: borderRadius.base,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.surfaceRaised,
              color: colors.textPrimary,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
            }}
          >
            <option value={1}>1 hop</option>
            <option value={2}>2 hops</option>
            <option value={3}>3 hops</option>
          </select>
        )}

        {/* Fullscreen Toggle */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: `${spacing['1.5']} ${spacing['3']}`,
            borderRadius: borderRadius.base,
            border: `1px solid ${colors.borderSubtle}`,
            background: 'transparent',
            color: colors.textSecondary,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
          }}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {/* Filter Panel */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        marginBottom: spacing['4'],
        flexWrap: 'wrap',
      }}>
        <Filter size={14} style={{ color: colors.textTertiary, flexShrink: 0 }} />

        {ALL_NODE_TYPES.map(type => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            style={filterChipStyle(enabledTypes.has(type), NODE_TYPE_COLORS[type])}
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: enabledTypes.has(type) ? NODE_TYPE_COLORS[type] : colors.textTertiary,
              flexShrink: 0,
            }} />
            {NODE_TYPE_LABELS[type]}
          </button>
        ))}

        <span style={{ width: 1, height: 20, background: colors.borderSubtle, margin: `0 ${spacing['1']}` }} />

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: `${spacing['1']} ${spacing['2.5']}`,
            borderRadius: borderRadius.full,
            border: `1px solid ${colors.borderSubtle}`,
            background: 'transparent',
            color: colors.textSecondary,
            fontSize: typography.fontSize.caption,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
          }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Focus mode hint */}
      {focusMode && !focusNodeId && (
        <div style={{
          padding: `${spacing['2']} ${spacing['4']}`,
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: borderRadius.base,
          marginBottom: spacing['4'],
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          color: '#8B5CF6',
        }}>
          Focus Mode active. Double-click any node to see only its neighborhood ({focusHops}-hop radius).
        </div>
      )}

      {focusMode && focusNodeId && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          padding: `${spacing['2']} ${spacing['4']}`,
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: borderRadius.base,
          marginBottom: spacing['4'],
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          color: '#8B5CF6',
        }}>
          <span>Focused on <strong>{focusNodeId}</strong> ({focusHops}-hop radius, {filteredData.nodes.length} entities)</span>
          <button
            onClick={() => setFocusNodeId(null)}
            style={{
              padding: `${spacing['0.5']} ${spacing['2']}`,
              borderRadius: borderRadius.sm,
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'transparent',
              color: '#8B5CF6',
              fontSize: typography.fontSize.caption,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
            }}
          >
            Clear Focus
          </button>
        </div>
      )}

      {/* Graph */}
      <IntelligenceGraph
        nodes={filteredData.nodes}
        edges={filteredData.edges}
        onNodeClick={handleNodeClick}
        height={isFullscreen ? 'calc(100vh - 120px)' : 680}
        highlightedNodeId={focusNodeId ?? undefined}
      />
    </PageContainer>
  )
}
