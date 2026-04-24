import React, { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Loader2,
  Upload,
  FileSearch,
  Shuffle,
  GitCompare,
  AlertTriangle,
  Sparkles,
  X,
  RefreshCw,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import type { AnalysisStage, PipelineState } from '../../hooks/useDrawingIntelligence'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────
// Adapted from SiteSync PM:
//   sitesyncai-web/app/components/ProcessingStatusView/ProcessingStatusView.tsx
// Styled with SiteSync PM's inline theme tokens (no styled-components).

export type StepStatus = 'pending' | 'running' | 'complete' | 'failed'

export interface PipelineStep {
  key: string
  label: string
  description?: string
  status: StepStatus
  startedAt?: string | null
  completedAt?: string | null
  icon: React.ComponentType<{ size?: number; color?: string }>
}

interface ProcessingPipelineProps {
  projectId: string
  state: PipelineState
  floating?: boolean
  onClose?: () => void
  onRetry?: () => void
}

const STAGE_TO_STEP: Record<AnalysisStage, string> = {
  idle: 'upload',
  classifying: 'classifying',
  pairing: 'pairing',
  detecting_edges: 'edges',
  generating_overlap: 'overlap',
  analyzing_discrepancies: 'analyzing',
  complete: 'complete',
  failed: 'complete',
}

const STEP_DEFS: Array<Omit<PipelineStep, 'status'>> = [
  { key: 'upload', label: 'Uploading', description: 'Drawings received', icon: Upload },
  { key: 'converting', label: 'Converting', description: 'PDF → images', icon: RefreshCw },
  {
    key: 'classifying',
    label: 'Classifying',
    description: 'Discipline + sheet identification',
    icon: FileSearch,
  },
  { key: 'pairing', label: 'Pairing', description: 'Match Arch ↔ Struct', icon: Shuffle },
  {
    key: 'edges',
    label: 'Detecting Edges',
    description: 'ML edge detection',
    icon: GitCompare,
  },
  {
    key: 'overlap',
    label: 'Generating Overlay',
    description: 'Register and overlap drawings',
    icon: Sparkles,
  },
  {
    key: 'analyzing',
    label: 'Analyzing',
    description: 'Find dimensional discrepancies',
    icon: AlertTriangle,
  },
  { key: 'complete', label: 'Complete', icon: Check },
]

function computeStatuses(stage: AnalysisStage): StepStatus[] {
  const activeKey = STAGE_TO_STEP[stage]
  const activeIdx = STEP_DEFS.findIndex((s) => s.key === activeKey)
  return STEP_DEFS.map((_, i) => {
    if (stage === 'failed' && i === activeIdx) return 'failed'
    if (stage === 'complete') return 'complete'
    if (i < activeIdx) return 'complete'
    if (i === activeIdx) return 'running'
    return 'pending'
  })
}

function statusColor(status: StepStatus): string {
  switch (status) {
    case 'complete':
      return colors.statusActive
    case 'running':
      return colors.primaryOrange
    case 'failed':
      return colors.statusCritical
    default:
      return colors.textTertiary
  }
}

function formatDuration(start?: string | null, end?: string | null): string | null {
  if (!start) return null
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const diff = Math.max(0, e - s)
  if (diff < 1000) return `${diff}ms`
  if (diff < 60_000) return `${(diff / 1000).toFixed(1)}s`
  const m = Math.floor(diff / 60_000)
  const sec = Math.floor((diff % 60_000) / 1000)
  return `${m}m ${sec}s`
}

export const ProcessingPipeline: React.FC<ProcessingPipelineProps> = ({
  projectId,
  state,
  floating = false,
  onClose,
  onRetry,
}) => {
  const [stepTimes, setStepTimes] = useState<
    Record<string, { startedAt?: string; completedAt?: string }>
  >({})

  // Subscribe to drawing_pairs realtime updates to trigger re-renders as
  // stages advance — the PipelineState is the source of truth for the current
  // stage but we record transitions here for durations.
  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`pipeline-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drawing_pairs', filter: `project_id=eq.${projectId}` },
        () => {
          // Touch state so duration timers refresh.
          setStepTimes((p) => ({ ...p }))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  // Record start/complete timestamps as the stage advances.
  // Stage changes are external events (realtime pipeline state); this effect
  // synchronizes our local timestamp map with those transitions.
  useEffect(() => {
    const activeKey = STAGE_TO_STEP[state.stage]
    const now = new Date().toISOString()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepTimes((prev) => {
      const next = { ...prev }
      if (!next[activeKey]) next[activeKey] = { startedAt: now }
      // Mark previously-running steps complete.
      for (const def of STEP_DEFS) {
        if (def.key === activeKey) break
        if (!next[def.key]?.completedAt) {
          next[def.key] = {
            startedAt: next[def.key]?.startedAt ?? now,
            completedAt: next[def.key]?.completedAt ?? now,
          }
        }
      }
      if (state.stage === 'complete' && !next[activeKey].completedAt) {
        next[activeKey] = { ...next[activeKey], completedAt: now }
      }
      return next
    })
  }, [state.stage])

  const statuses = useMemo(() => computeStatuses(state.stage), [state.stage])
  const percent = useMemo(() => {
    const complete = statuses.filter((s) => s === 'complete').length
    return Math.round((complete / STEP_DEFS.length) * 100)
  }, [statuses])

  const containerStyle: React.CSSProperties = floating
    ? {
        position: 'fixed',
        right: spacing['6'],
        bottom: spacing['6'],
        width: 420,
        maxWidth: '92vw',
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.lg,
        padding: spacing['4'],
        zIndex: 60,
      }
    : {
        width: '100%',
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.lg,
        padding: spacing['4'],
      }

  const activeIdx = STEP_DEFS.findIndex((s) => s.key === STAGE_TO_STEP[state.stage])

  return (
    <section aria-label="Drawing analysis pipeline" style={containerStyle}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing['3'],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Sparkles size={18} color={colors.primaryOrange} />
          <h3
            style={{
              margin: 0,
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}
          >
            Analysis Pipeline
          </h3>
          <span
            style={{
              marginLeft: spacing['2'],
              fontSize: typography.fontSize.caption,
              color: colors.textSecondary,
            }}
          >
            {state.processedPairs}/{state.totalPairs || '?'} pairs
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close pipeline view"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        )}
      </header>

      {/* Overall progress bar */}
      <div
        style={{
          height: 6,
          background: colors.surfaceInset,
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: spacing['4'],
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background:
              state.stage === 'failed' ? colors.statusCritical : colors.primaryOrange,
            transition: 'width 400ms ease',
          }}
        />
      </div>

      {/* Step list */}
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['2'],
        }}
      >
        {STEP_DEFS.map((def, i) => {
          const status = statuses[i]
          const times = stepTimes[def.key] ?? {}
          const duration = formatDuration(times.startedAt, times.completedAt)
          const Icon = def.icon
          return (
            <li
              key={def.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
                padding: `${spacing['2']} ${spacing['3']}`,
                borderRadius: borderRadius.md,
                background:
                  status === 'running' ? colors.surfaceHover : 'transparent',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${statusColor(status)}22`,
                  color: statusColor(status),
                  flexShrink: 0,
                }}
              >
                {status === 'running' ? (
                  <Loader2 size={16} className="spin" />
                ) : status === 'complete' ? (
                  <Check size={16} />
                ) : status === 'failed' ? (
                  <AlertTriangle size={16} />
                ) : (
                  <Icon size={16} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: typography.fontSize.body,
                    fontWeight:
                      status === 'running'
                        ? typography.fontWeight.semibold
                        : typography.fontWeight.normal,
                    color: colors.textPrimary,
                  }}
                >
                  {def.label}
                </div>
                {def.description && (
                  <div
                    style={{
                      fontSize: typography.fontSize.caption,
                      color: colors.textSecondary,
                    }}
                  >
                    {def.description}
                  </div>
                )}
              </div>
              {duration && (
                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: colors.textTertiary,
                    fontFamily: 'monospace',
                  }}
                >
                  {duration}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {state.stage === 'failed' && (
        <div
          style={{
            marginTop: spacing['3'],
            padding: spacing['3'],
            background: `${colors.statusCritical}11`,
            border: `1px solid ${colors.statusCritical}55`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.body,
            color: colors.statusCritical,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing['2'],
          }}
        >
          <span>{state.error ?? 'Pipeline failed'}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: colors.statusCritical,
                color: colors.white,
                border: 'none',
                borderRadius: borderRadius.sm,
                padding: `${spacing['1']} ${spacing['3']}`,
                cursor: 'pointer',
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {state.stage === 'complete' && (state.discrepancyCount > 0 || state.autoRfiCount > 0) && (
        <div
          style={{
            marginTop: spacing['3'],
            padding: spacing['3'],
            background: colors.surfaceInset,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.caption,
            color: colors.textSecondary,
            display: 'flex',
            gap: spacing['4'],
          }}
        >
          <span>
            <strong style={{ color: colors.textPrimary }}>
              {state.discrepancyCount}
            </strong>{' '}
            discrepancies
          </span>
          <span>
            <strong style={{ color: colors.textPrimary }}>{state.autoRfiCount}</strong>{' '}
            auto-RFIs
          </span>
        </div>
      )}

      {/* Step index hint for accessibility */}
      <div style={{ position: 'absolute', left: -9999, top: -9999 }} aria-live="polite">
        {activeIdx >= 0
          ? `Step ${activeIdx + 1} of ${STEP_DEFS.length}: ${STEP_DEFS[activeIdx].label}`
          : 'Idle'}
      </div>
    </section>
  )
}

export default ProcessingPipeline
