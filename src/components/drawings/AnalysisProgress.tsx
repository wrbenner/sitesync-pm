import React, { useEffect, useRef, useState } from 'react'
import { Check, CircleDashed, Loader2, XCircle, Minus, RefreshCcw, Activity } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'
import type { AnalysisStage, PipelineState } from '../../hooks/useDrawingIntelligence'

interface AnalysisProgressProps {
  state: PipelineState
  floating?: boolean
  onClose?: () => void
  onRetry?: () => void
}

interface StageDef {
  id: AnalysisStage
  label: string
  // Rough expected duration in seconds — used for ETA calc.
  expectedSec: number
}

const STAGES: StageDef[] = [
  { id: 'classifying', label: 'Classifying', expectedSec: 8 },
  { id: 'pairing', label: 'Pairing', expectedSec: 6 },
  { id: 'detecting_edges', label: 'Detecting edges', expectedSec: 12 },
  { id: 'generating_overlap', label: 'Generating overlay', expectedSec: 10 },
  { id: 'analyzing_discrepancies', label: 'Analyzing discrepancies', expectedSec: 14 },
  { id: 'complete', label: 'Complete', expectedSec: 0 },
]

type StageStatus = 'done' | 'active' | 'pending' | 'failed'

function stageStatus(current: AnalysisStage, stage: AnalysisStage): StageStatus {
  if (current === 'failed') {
    const currentIdx = STAGES.findIndex((s) => s.id === stage)
    return currentIdx === 0 ? 'failed' : 'pending'
  }
  const activeIdx = STAGES.findIndex((s) => s.id === current)
  const stageIdx = STAGES.findIndex((s) => s.id === stage)
  if (current === 'complete') return 'done'
  if (activeIdx < 0 || stageIdx < 0) return 'pending'
  if (stageIdx < activeIdx) return 'done'
  if (stageIdx === activeIdx) return 'active'
  return 'pending'
}

function formatSec(s: number): string {
  if (s < 1) return '<1s'
  if (s < 60) return `${Math.round(s)}s`
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  state,
  floating = false,
  onClose,
  onRetry,
}) => {
  const { stage, totalPairs, processedPairs, discrepancyCount, autoRfiCount, error } = state

  const [durations, setDurations] = useState<Record<string, number>>({})
  const [minimized, setMinimized] = useState(false)
  const stageStartRef = useRef<{ id: AnalysisStage; at: number } | null>(null)
  const startAtRef = useRef<number | null>(null)

  // Track transitions to record durations & compute ETA
  useEffect(() => {
    const now = Date.now()
    if (!startAtRef.current && stage !== 'idle') startAtRef.current = now
    const prev = stageStartRef.current
    if (!prev || prev.id !== stage) {
      if (prev) {
        const elapsed = (now - prev.at) / 1000
        setDurations((d) => ({ ...d, [prev.id]: elapsed }))
      }
      stageStartRef.current = { id: stage, at: now }
    }
  }, [stage])

  // ETA — sum expected durations of remaining stages (current + after),
  // subtract elapsed in current stage.
  const currentIdx = STAGES.findIndex((s) => s.id === stage)
  const remainingSec = (() => {
    if (stage === 'complete' || stage === 'failed' || stage === 'idle') return 0
    let total = 0
    for (let i = currentIdx; i < STAGES.length - 1; i++) {
      total += STAGES[i].expectedSec
    }
    const elapsedInStage = stageStartRef.current
      ? (Date.now() - stageStartRef.current.at) / 1000
      : 0
    return Math.max(0, total - elapsedInStage)
  })()

  // Tick for smooth ETA countdown
  const [, setTick] = useState(0)
  useEffect(() => {
    if (stage === 'complete' || stage === 'failed' || stage === 'idle') return
    const t = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [stage])

  const pairProgressPct = totalPairs > 0 ? Math.round((processedPairs / totalPairs) * 100) : 0

  // Minimized floating "pill" view
  if (floating && minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        aria-label="Expand analysis progress"
        style={{
          position: 'fixed',
          right: spacing.lg,
          bottom: spacing.lg,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.full,
          boxShadow: shadows.panel,
          cursor: 'pointer',
          fontSize: typography.fontSize.sm,
          color: colors.textPrimary,
          zIndex: 300,
        }}
      >
        {stage === 'failed' ? (
          <XCircle size={14} color={colors.statusCritical} />
        ) : stage === 'complete' ? (
          <Check size={14} color={colors.statusActive} />
        ) : (
          <Loader2 size={14} color={colors.primaryOrange} style={{ animation: 'ap-spin 1s linear infinite' }} />
        )}
        <span>
          {stage === 'complete' ? 'Analysis complete' : stage === 'failed' ? 'Analysis failed' : `${STAGES[currentIdx]?.label ?? 'Working'}…`}
        </span>
      </button>
    )
  }

  const wrapperStyle: React.CSSProperties = floating
    ? {
        position: 'fixed',
        right: spacing.lg,
        bottom: spacing.lg,
        width: 340,
        zIndex: 300,
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        boxShadow: shadows.panel,
      }
    : {
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
      }

  return (
    <div role="status" aria-live="polite" style={wrapperStyle}>
      <style>{`@keyframes ap-spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
      @keyframes ap-fade { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }`}</style>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color={colors.primaryOrange} />
          <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Drawing Analysis
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {floating && (
            <button
              onClick={() => setMinimized(true)}
              aria-label="Minimize progress panel"
              style={iconBtn}
            >
              <Minus size={14} color={colors.textSecondary} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Dismiss progress panel" style={iconBtn}>
              ✕
            </button>
          )}
        </div>
      </div>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {STAGES.map((s) => {
          const status = stageStatus(stage, s.id)
          const icon =
            status === 'done' ? (
              <Check size={16} color={colors.statusActive} />
            ) : status === 'active' ? (
              <Loader2
                size={16}
                color={colors.primaryOrange}
                style={{ animation: 'ap-spin 1s linear infinite' }}
              />
            ) : status === 'failed' ? (
              <XCircle size={16} color={colors.statusCritical} />
            ) : (
              <CircleDashed size={16} color={colors.textTertiary} />
            )

          const labelColor =
            status === 'active' || status === 'done' ? colors.textPrimary : colors.textSecondary
          const dur = durations[s.id]

          return (
            <li
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: typography.fontSize.sm,
                color: labelColor,
                transition: transitions.smooth,
                animation: status === 'active' ? 'ap-fade 260ms ease-out' : undefined,
              }}
            >
              {icon}
              <span style={{ flex: 1 }}>{s.label}</span>
              {dur !== undefined && status === 'done' && (
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  {formatSec(dur)}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {totalPairs > 0 && (
        <div
          style={{
            marginTop: spacing.sm,
            fontSize: typography.fontSize.label,
            color: colors.textSecondary,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              Pairs: {processedPairs} / {totalPairs}
            </span>
            <span>{pairProgressPct}%</span>
          </div>
          <div
            style={{
              marginTop: 4,
              height: 4,
              background: colors.surfaceInset,
              borderRadius: borderRadius.full,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pairProgressPct}%`,
                height: '100%',
                background: colors.primaryOrange,
                transition: transitions.smooth,
              }}
            />
          </div>
          {discrepancyCount > 0 && (
            <div style={{ marginTop: 4 }}>Discrepancies: {discrepancyCount}</div>
          )}
          {autoRfiCount > 0 && <div>Auto-drafted RFIs: {autoRfiCount}</div>}
        </div>
      )}

      {stage !== 'complete' && stage !== 'failed' && stage !== 'idle' && remainingSec > 0 && (
        <div
          style={{
            marginTop: spacing.sm,
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
          }}
        >
          ETA ~ {formatSec(remainingSec)}
        </div>
      )}

      {stage === 'failed' && (
        <div
          style={{
            marginTop: spacing.sm,
            padding: spacing.sm,
            borderRadius: borderRadius.base,
            background: colors.errorBannerBg,
            color: colors.statusCritical,
            fontSize: typography.fontSize.sm,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div>{error ?? 'Analysis failed.'}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                alignSelf: 'flex-start',
                padding: '4px 10px',
                border: `1px solid ${colors.statusCritical}`,
                background: 'transparent',
                color: colors.statusCritical,
                borderRadius: borderRadius.sm,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: typography.fontSize.label,
              }}
            >
              <RefreshCcw size={12} /> Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: colors.textSecondary,
  padding: 2,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: borderRadius.sm,
}

export default AnalysisProgress
