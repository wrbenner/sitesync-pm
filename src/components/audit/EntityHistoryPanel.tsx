/**
 * EntityHistoryPanel — drop-in "show me everything that happened on
 * this RFI / Pay App / Punch Item" timeline.
 *
 * Renders the audit trail scoped to one resource as a vertical
 * timeline. Used on detail pages to satisfy the moat-claim: the GC
 * must be able to answer "what happened to RFI-047 in the 72 hours
 * before it closed?" with one keystroke.
 *
 * Design intent:
 *   • Vertical rail with circular markers (color = action category)
 *   • Most-recent first; relative timestamps; absolute on hover
 *   • Each entry expandable to see old → new diff
 *   • Read-only; no destructive actions; this view is for evidence
 *     and discovery, not editing
 */

import React, { useState } from 'react'
import { Clock, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { useEntityHistory } from '../../hooks/useAuditTrail'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import type { AuditLogEntry } from '../../api/endpoints/auditTrail'

export interface EntityHistoryPanelProps {
  entityType: string
  entityId: string
  /** Optional title; defaults to "Activity". */
  title?: string
}

const ACTION_COLORS: Record<string, string> = {
  create: '#3FB28F',
  insert: '#3FB28F',
  update: '#5B8DEF',
  delete: '#E0524A',
  status_change: '#E89B3F',
  approve: '#3FB28F',
  reject: '#E0524A',
  transition: '#5B8DEF',
  send: '#5B8DEF',
}

function actionColor(action: string): string {
  return ACTION_COLORS[action.toLowerCase()] ?? '#9AA4B2'
}

function relativeTime(d: string): string {
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(d).toLocaleDateString()
}

export const EntityHistoryPanel: React.FC<EntityHistoryPanelProps> = ({
  entityType,
  entityId,
  title = 'Activity',
}) => {
  const { data, isLoading } = useEntityHistory(entityType, entityId)
  const entries: AuditLogEntry[] = data?.entries ?? []

  if (isLoading) {
    return (
      <div data-skeleton="true" style={{
        height: 160,
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg,
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
      }} />
    )
  }

  if (entries.length === 0) {
    return (
      <div style={{
        padding: spacing['4'],
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg,
        color: colors.textTertiary,
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
      }}>
        No activity yet on this {entityType.replace(/_/g, ' ')}.
      </div>
    )
  }

  return (
    <section
      role="region"
      aria-label={title}
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        padding: spacing['5'],
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <Clock size={14} color={colors.textTertiary} />
        <h3 style={{
          margin: 0,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {title}
        </h3>
        <span style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          {entries.length} {entries.length === 1 ? 'event' : 'events'}
        </span>
      </header>

      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['3'],
          position: 'relative',
        }}
      >
        {/* Rail */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 11,
            top: 12,
            bottom: 12,
            width: 1,
            backgroundColor: colors.borderSubtle,
          }}
        />
        {entries.map((entry) => (
          <HistoryEntryRow key={entry.id} entry={entry} />
        ))}
      </ol>
    </section>
  )
}

const HistoryEntryRow: React.FC<{ entry: AuditLogEntry }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false)
  const color = actionColor(entry.action)
  // "From Iris" = the audit row's metadata indicates an iris-drafted
  // origin OR there's no human user attached (system / agent action).
  const meta = entry.metadata ?? {}
  const createdVia = (meta as { created_via?: string }).created_via
  const fromIris = createdVia === 'iris.draft' || entry.user_id === null

  const hasDiff = (entry.before_state || entry.after_state) && expanded
  const entityTitle = (meta as { entity_title?: string; title?: string }).entity_title
    ?? (meta as { title?: string }).title
    ?? null

  return (
    <li style={{ position: 'relative', paddingLeft: 32 }}>
      {/* Marker */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 5,
          top: 4,
          width: 14,
          height: 14,
          borderRadius: '50%',
          backgroundColor: color,
          border: `3px solid ${colors.surfaceRaised}`,
          boxShadow: `0 0 0 1px ${color}33`,
        }}
      />
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontFamily: typography.fontFamily,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {expanded ? <ChevronDown size={12} color={colors.textTertiary} /> : <ChevronRight size={12} color={colors.textTertiary} />}
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, textTransform: 'capitalize' }}>
            {entry.action.replace(/_/g, ' ')}
          </span>
          {fromIris && (
            <span
              title="Action originated from Iris draft, approved by user"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: '0 6px',
                borderRadius: borderRadius.full,
                backgroundColor: colors.orangeSubtle,
                color: colors.orangeText,
                fontSize: 10,
                fontWeight: typography.fontWeight.semibold,
              }}
            >
              <Sparkles size={10} /> Iris
            </span>
          )}
          <span
            title={new Date(entry.created_at).toLocaleString()}
            style={{
              marginLeft: 'auto',
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
            }}
          >
            {relativeTime(entry.created_at)}
          </span>
        </div>
        {entityTitle && (
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
            {entityTitle}
          </div>
        )}
      </button>
      {hasDiff && (
        <pre
          style={{
            marginTop: spacing['2'],
            padding: spacing['2'],
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.base,
            fontSize: 11,
            color: colors.textSecondary,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {JSON.stringify({ from: entry.before_state, to: entry.after_state, changed: entry.changed_fields }, null, 2)}
        </pre>
      )}
    </li>
  )
}

export default EntityHistoryPanel
