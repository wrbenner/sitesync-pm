import React from 'react'
import { Check, CircleDashed, Loader2, XCircle } from 'lucide-react'
import { colors, spacing } from '../../styles/theme'
import type { AnalysisStage, PipelineState } from '../../hooks/useDrawingIntelligence'

interface AnalysisProgressProps {
  state: PipelineState
  floating?: boolean
  onClose?: () => void
}

interface StageDef {
  id: AnalysisStage
  label: string
}

// Display stages in order. `idle` and `complete` are terminal markers.
const STAGES: StageDef[] = [
  { id: 'classifying', label: 'Classifying' },
  { id: 'pairing', label: 'Pairing' },
  { id: 'detecting_edges', label: 'Detecting Edges' },
  { id: 'generating_overlap', label: 'Generating Overlay' },
  { id: 'analyzing_discrepancies', label: 'Analyzing' },
  { id: 'complete', label: 'Complete' },
]

function stageStatus(current: AnalysisStage, stage: AnalysisStage): 'done' | 'active' | 'pending' | 'failed' {
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

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  state,
  floating = false,
  onClose,
}) => {
  const { stage, totalPairs, processedPairs, discrepancyCount, autoRfiCount, error } = state

  const wrapperStyle: React.CSSProperties = floating
    ? {
        position: 'fixed',
        right: spacing.lg,
        bottom: spacing.lg,
        width: 320,
        zIndex: 300,
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 12,
        padding: spacing.md,
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
      }
    : {
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 12,
        padding: spacing.md,
      }

  return (
    <div role="status" aria-live="polite" style={wrapperStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        }}
      >
        <div style={{ fontWeight: 600, color: colors.textPrimary }}>
          Drawing Analysis
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Dismiss progress panel"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              fontSize: 14,
            }}
          >
            ✕
          </button>
        )}
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
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : status === 'failed' ? (
              <XCircle size={16} color={colors.statusCritical} />
            ) : (
              <CircleDashed size={16} color={colors.textTertiary} />
            )

          const labelColor =
            status === 'active'
              ? colors.textPrimary
              : status === 'done'
                ? colors.textPrimary
                : colors.textSecondary
          return (
            <li
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: labelColor,
              }}
            >
              {icon}
              <span>{s.label}</span>
            </li>
          )
        })}
      </ul>

      {totalPairs > 0 && (
        <div
          style={{
            marginTop: spacing.sm,
            fontSize: 12,
            color: colors.textSecondary,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div>Pairs processed: {processedPairs} / {totalPairs}</div>
          {discrepancyCount > 0 && <div>Discrepancies: {discrepancyCount}</div>}
          {autoRfiCount > 0 && <div>Auto-drafted RFIs: {autoRfiCount}</div>}
        </div>
      )}

      {stage === 'failed' && error && (
        <div
          style={{
            marginTop: spacing.sm,
            fontSize: 12,
            color: colors.statusCritical,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

export default AnalysisProgress
