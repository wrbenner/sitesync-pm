// Agent Stream Panel: Real-time display of agent execution events.
// Renders AG-UI protocol events as an interactive timeline with
// human-in-the-loop approval for destructive actions.

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Loader2, CheckCircle, AlertTriangle, Zap, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, Btn, ProgressBar } from '../../Primitives'
import { PermissionGate } from '../../auth/PermissionGate'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { AgentStreamEventType } from '../../../schemas/agentStream'

// ── Props ──────────────────────────────────────────────────

interface AgentStreamPanelProps {
  events: AgentStreamEventType[]
  isActive: boolean
  onApprove?: (actionId: string) => void
  onReject?: (actionId: string, reason?: string) => void
}

// ── Component ──────────────────────────────────────────────

export const AgentStreamPanel: React.FC<AgentStreamPanelProps> = React.memo(({
  events,
  isActive,
  onApprove,
  onReject,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Auto-scroll on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  const currentState = useMemo(() => {
    const snapshots = events.filter((e) => e.type === 'state_snapshot')
    return snapshots.length > 0 ? (snapshots[snapshots.length - 1] as Extract<AgentStreamEventType, { type: 'state_snapshot' }>).data.state : 'initializing'
  }, [events])

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  if (events.length === 0) {
    return (
      <Card padding={spacing['4']}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['3'], padding: spacing['4'] }}>
          <Loader2 size={20} color={colors.primaryOrange} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>Initializing agent...</p>
        </div>
      </Card>
    )
  }

  return (
    <Card padding="0">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`,
        backgroundColor: colors.surfaceInset,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {currentState === 'completed' ? (
            <CheckCircle size={14} color={colors.statusActive} />
          ) : currentState === 'error' ? (
            <AlertTriangle size={14} color={colors.statusCritical} />
          ) : (
            <Loader2 size={14} color={colors.statusInfo} style={{ animation: 'spin 1s linear infinite' }} />
          )}
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Agent Execution
          </span>
        </div>
        {isActive && (
          <span style={{
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: colors.statusActive, display: 'flex', alignItems: 'center', gap: spacing['1'],
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.statusActive, animation: 'pulse 2s infinite' }} />
            Live
          </span>
        )}
      </div>

      {/* Event list */}
      <div ref={scrollRef} style={{ maxHeight: 400, overflowY: 'auto', padding: spacing['3'] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {events.map((event) => (
            <EventRow
              key={event.event_id}
              event={event}
              isExpanded={expandedId === event.event_id}
              onToggle={() => toggleExpand(event.event_id)}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </div>
      </div>
    </Card>
  )
})
AgentStreamPanel.displayName = 'AgentStreamPanel'

// ── Event Row ────────────────────────────────────────────

interface EventRowProps {
  event: AgentStreamEventType
  isExpanded: boolean
  onToggle: () => void
  onApprove?: (actionId: string) => void
  onReject?: (actionId: string, reason?: string) => void
}

const EventRow: React.FC<EventRowProps> = React.memo(({ event, isExpanded, onToggle, onApprove, onReject }) => {
  const icon = useMemo(() => {
    switch (event.type) {
      case 'state_snapshot': return <Zap size={12} color={colors.statusPending} />
      case 'tool_call_start':
      case 'tool_call_progress':
      case 'tool_call_end': return <Zap size={12} color={colors.statusInfo} />
      case 'text_message': return <MessageSquare size={12} color={colors.textTertiary} />
      case 'approval_request': return <AlertTriangle size={12} color={colors.statusPending} />
      case 'error': return <AlertTriangle size={12} color={colors.statusCritical} />
      case 'summary': return <CheckCircle size={12} color={colors.statusActive} />
    }
  }, [event.type])

  const expandable = event.type === 'tool_call_start' || event.type === 'tool_call_end' || event.type === 'approval_request'

  return (
    <div style={{
      backgroundColor: colors.surfaceFlat, border: `1px solid ${colors.borderSubtle}`,
      borderRadius: borderRadius.base, padding: spacing['3'],
    }}>
      <div
        style={{ display: 'flex', gap: spacing['2'], alignItems: 'flex-start', cursor: expandable ? 'pointer' : 'default' }}
        onClick={expandable ? onToggle : undefined}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        onKeyDown={expandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
      >
        <span style={{ marginTop: 2, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EventContent event={event} />
        </div>
        {expandable && (
          <span style={{ color: colors.textTertiary, flexShrink: 0 }}>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && event.type === 'approval_request' && onApprove && onReject && (
        <div style={{ marginTop: spacing['3'], paddingTop: spacing['3'], borderTop: `1px solid ${colors.borderSubtle}` }}>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, marginBottom: spacing['3'] }}>
            {event.data.action_description}
          </p>
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <PermissionGate permission="ai.use">
              <Btn variant="primary" size="sm" onClick={() => onApprove(event.data.action_id)}>Approve</Btn>
            </PermissionGate>
            <Btn variant="ghost" size="sm" onClick={() => onReject(event.data.action_id)}>Reject</Btn>
          </div>
        </div>
      )}

      {/* Timestamp */}
      <p style={{ fontSize: '10px', color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
        {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
    </div>
  )
})
EventRow.displayName = 'EventRow'

// ── Event Content ────────────────────────────────────────

const EventContent: React.FC<{ event: AgentStreamEventType }> = React.memo(({ event }) => {
  switch (event.type) {
    case 'state_snapshot':
      return (
        <div>
          <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            {event.data.description}
          </p>
          {event.data.progress != null && (
            <div style={{ marginTop: spacing['2'] }}>
              <ProgressBar value={event.data.progress} max={100} height={3} />
            </div>
          )}
        </div>
      )

    case 'tool_call_start':
      return (
        <div>
          <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            Calling: {event.data.tool_name}
          </p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1 }}>
            {event.data.rationale}
          </p>
        </div>
      )

    case 'tool_call_progress':
      return (
        <div>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary, margin: 0 }}>
            {event.data.message}
          </p>
          <div style={{ marginTop: spacing['1'] }}>
            <ProgressBar value={event.data.progress} max={100} height={3} color={colors.statusInfo} />
          </div>
        </div>
      )

    case 'tool_call_end':
      return (
        <p style={{
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, margin: 0,
          color: event.data.status === 'success' ? colors.statusActive : colors.statusCritical,
        }}>
          {event.data.tool_name} {event.data.status === 'success' ? 'completed' : 'failed'} ({(event.data.duration_ms / 1000).toFixed(1)}s)
        </p>
      )

    case 'text_message':
      return (
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.normal }}>
          {event.data.content}
        </p>
      )

    case 'approval_request':
      return (
        <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusPending, margin: 0 }}>
          Approval required: {event.data.action_title}
        </p>
      )

    case 'error':
      return (
        <p style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, margin: 0 }}>
          {event.data.message}
        </p>
      )

    case 'summary':
      return (
        <div>
          <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold, color: colors.statusActive, margin: 0 }}>
            {event.data.title}
          </p>
          {event.data.actions_taken.length > 0 && (
            <ul style={{ margin: `${spacing['1']} 0 0`, paddingLeft: spacing['4'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
              {event.data.actions_taken.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
        </div>
      )
  }
})
EventContent.displayName = 'EventContent'
