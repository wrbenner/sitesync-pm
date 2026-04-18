// ── Live Analysis Theater ─────────────────────────────────────
// Enhanced port of sitesyncai-web ProcessingStatusView + AnalysisStatusFab.
// Full-screen experience with animated stats, mini-previews per sheet,
// connecting lines between stages, and a minimizable FAB.

import React, { useEffect, useRef, useState } from 'react'
import {
  Check, CircleDashed, Loader2, XCircle, Minimize2, Maximize2,
  Layers, Link as LinkIcon, Scan, GitCompare, AlertTriangle, Volume2, VolumeX,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme'
import type { AnalysisStage, PipelineState } from '../../hooks/useDrawingIntelligence'

interface AnalysisProgressProps {
  state: PipelineState
  floating?: boolean
  onClose?: () => void
  /** Optional per-sheet preview stream: callers push { sheet, thumbnail, discipline } as classify completes */
  sheetPreviews?: Array<{ id: string; sheet: string; thumbnail?: string; discipline: string }>
}

interface StageDef {
  id: AnalysisStage
  label: string
  icon: React.ElementType
  description: string
}

const STAGES: StageDef[] = [
  { id: 'classifying', label: 'Classifying', icon: Layers, description: 'Identifying discipline and sheet type' },
  { id: 'pairing', label: 'Pairing', icon: LinkIcon, description: 'Matching related sheets across revisions' },
  { id: 'detecting_edges', label: 'Detecting Edges', icon: Scan, description: 'Vectorizing geometry for comparison' },
  { id: 'generating_overlap', label: 'Overlaying', icon: GitCompare, description: 'Generating diff visualization' },
  { id: 'analyzing_discrepancies', label: 'Analyzing', icon: AlertTriangle, description: 'Ranking discrepancies by severity' },
  { id: 'complete', label: 'Complete', icon: Check, description: 'Analysis ready' },
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

// ── Animated number — counts up to target ─────────────────────
function useCountUp(target: number, ms = 600): number {
  const [val, setVal] = useState(target)
  const prev = useRef(target)
  useEffect(() => {
    const from = prev.current
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const progress = Math.min(1, (t - start) / ms)
      setVal(Math.round(from + (target - from) * progress))
      if (progress < 1) raf = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}

// ── Audio feedback (Web Audio API) ────────────────────────────
const SOUND_PREF_KEY = 'analysis-theater-sound'

function useStageSound(enabled: boolean, currentStage: AnalysisStage) {
  const prevRef = useRef<AnalysisStage>(currentStage)
  useEffect(() => {
    if (!enabled) return
    if (prevRef.current !== currentStage) {
      prevRef.current = currentStage
      if (currentStage === 'idle') return
      try {
        const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        if (!AC) return
        const ctx = new AC()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = currentStage === 'complete' ? 880 : currentStage === 'failed' ? 220 : 660
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
        osc.start()
        osc.stop(ctx.currentTime + 0.3)
      } catch {
        // ignore — audio not available
      }
    }
  }, [currentStage, enabled])
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  state,
  floating = false,
  onClose,
  sheetPreviews = [],
}) => {
  const { stage, totalPairs, processedPairs, discrepancyCount, autoRfiCount, error } = state

  const [minimized, setMinimized] = useState(false)
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try { return localStorage.getItem(SOUND_PREF_KEY) === '1' } catch { return false }
  })
  useEffect(() => { try { localStorage.setItem(SOUND_PREF_KEY, soundOn ? '1' : '0') } catch { /* ignore */ } }, [soundOn])

  useStageSound(soundOn, stage)

  const sheetsCount = useCountUp(sheetPreviews.length)
  const pairsCount = useCountUp(processedPairs)
  const discrepCount = useCountUp(discrepancyCount)
  const rfiCount = useCountUp(autoRfiCount)

  const activeIdx = Math.max(0, STAGES.findIndex((s) => s.id === stage))
  const overallPct = stage === 'complete' ? 100
    : stage === 'failed' ? 0
    : Math.round(((activeIdx + (totalPairs > 0 ? processedPairs / totalPairs : 0)) / STAGES.length) * 100)

  // ── Minimized FAB ────────────────────────────────────────────
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        aria-label="Expand analysis progress"
        style={{
          position: 'fixed', right: 24, bottom: 24, zIndex: zIndex.modal,
          width: 220, height: 56, padding: `0 ${spacing['3']}`,
          background: colors.primaryOrange, color: 'white',
          border: 'none', borderRadius: borderRadius.full,
          boxShadow: shadows.lg, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: spacing['2'],
        }}
      >
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: typography.fontSize.caption, opacity: 0.85 }}>Analyzing</div>
          <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold }}>{overallPct}%</div>
        </div>
        <Maximize2 size={16} />
      </button>
    )
  }

  const wrapperStyle: React.CSSProperties = floating
    ? {
        position: 'fixed', right: 24, bottom: 24, width: 420, zIndex: zIndex.modal,
        backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.lg, padding: spacing['4'], boxShadow: shadows.lg,
      }
    : {
        backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.lg, padding: spacing['4'],
      }

  return (
    <div role="status" aria-live="polite" style={wrapperStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>
            Drawing Analysis
          </div>
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {STAGES[activeIdx]?.description ?? 'Preparing…'}
          </div>
        </div>
        <button
          onClick={() => setSoundOn((v) => !v)}
          aria-label={soundOn ? 'Mute' : 'Unmute'}
          title={soundOn ? 'Sound on' : 'Sound off'}
          style={{
            width: 32, height: 32, minWidth: 32, background: 'transparent',
            border: 'none', cursor: 'pointer', color: colors.textSecondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button
          onClick={() => setMinimized(true)}
          aria-label="Minimize"
          style={{
            width: 32, height: 32, minWidth: 32, background: 'transparent',
            border: 'none', cursor: 'pointer', color: colors.textSecondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Minimize2 size={16} />
        </button>
        {onClose && (
          <button onClick={onClose} aria-label="Close"
            style={{
              width: 32, height: 32, minWidth: 32, background: 'transparent',
              border: 'none', cursor: 'pointer', color: colors.textSecondary, fontSize: 16,
            }}
          >✕</button>
        )}
      </div>

      {/* Overall progress bar */}
      <div style={{ height: 8, background: colors.surfaceInset, borderRadius: 4, overflow: 'hidden', marginBottom: spacing['3'] }}>
        <div style={{
          height: '100%', width: `${overallPct}%`,
          background: stage === 'failed' ? colors.statusCritical : colors.primaryOrange,
          transition: 'width 0.4s',
        }} />
      </div>

      {/* Stage stepper with connecting lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: spacing['3'] }}>
        {STAGES.map((s, i) => {
          const st = stageStatus(stage, s.id)
          const Icon = s.icon
          const iconColor =
            st === 'done' ? colors.statusActive :
            st === 'active' ? colors.primaryOrange :
            st === 'failed' ? colors.statusCritical :
            colors.textTertiary
          return (
            <div key={s.id} style={{ display: 'flex', gap: spacing['3'], position: 'relative' }}>
              {/* Connecting line */}
              {i < STAGES.length - 1 && (
                <div style={{
                  position: 'absolute', left: 11, top: 24, bottom: -8, width: 2,
                  background: st === 'done' ? colors.statusActive : colors.borderSubtle,
                }} />
              )}
              {/* Icon */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: st === 'active' ? colors.orangeSubtle : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                flexShrink: 0,
              }}>
                {st === 'done' ? <Check size={14} color={iconColor} />
                  : st === 'active' ? <Loader2 size={14} color={iconColor} style={{ animation: 'spin 1s linear infinite' }} />
                  : st === 'failed' ? <XCircle size={14} color={iconColor} />
                  : <CircleDashed size={14} color={iconColor} />}
              </div>
              {/* Label */}
              <div style={{ flex: 1, paddingBottom: spacing['3'] }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  fontSize: typography.fontSize.body,
                  color: st === 'pending' ? colors.textTertiary : colors.textPrimary,
                  fontWeight: st === 'active' ? typography.fontWeight.semibold : typography.fontWeight.normal,
                }}>
                  <Icon size={14} color={iconColor} />
                  {s.label}
                </div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
                  {s.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Live stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['2'],
        padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.base,
      }}>
        <StatTile label="Sheets" value={sheetsCount} accent={colors.primaryOrange} />
        <StatTile label="Pairs" value={pairsCount} total={totalPairs} accent={colors.statusInfo} />
        <StatTile label="Issues" value={discrepCount} accent={colors.statusWarning} />
        <StatTile label="RFIs" value={rfiCount} accent={colors.statusActive} />
      </div>

      {/* Sheet preview strip */}
      {sheetPreviews.length > 0 && (
        <div style={{
          marginTop: spacing['3'], display: 'flex', gap: spacing['2'], overflowX: 'auto',
          paddingBottom: spacing['2'],
        }}>
          {sheetPreviews.slice(-12).map((p) => (
            <div key={p.id} style={{
              flexShrink: 0, width: 80, borderRadius: borderRadius.sm, overflow: 'hidden',
              border: `1px solid ${colors.borderSubtle}`, background: colors.surfacePage,
              animation: 'fadeIn 0.3s ease-out',
            }}>
              {p.thumbnail ? (
                <img src={p.thumbnail} alt={p.sheet} width={80} height={100} style={{ display: 'block', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 80, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.surfaceInset }}>
                  <Layers size={24} color={colors.textTertiary} />
                </div>
              )}
              <div style={{
                padding: `${spacing['1']} ${spacing['2']}`,
                fontSize: 10, fontWeight: typography.fontWeight.semibold,
                background: colors.orangeSubtle, color: colors.orangeText,
                textAlign: 'center',
              }}>
                {p.discipline}
              </div>
            </div>
          ))}
        </div>
      )}

      {stage === 'failed' && error && (
        <div style={{
          marginTop: spacing['3'], padding: spacing['2'], fontSize: typography.fontSize.caption,
          color: colors.statusCritical, background: colors.statusCriticalSubtle, borderRadius: borderRadius.sm,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

const StatTile: React.FC<{ label: string; value: number; total?: number; accent: string }> = ({ label, value, total, accent }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.bold, color: accent, lineHeight: 1 }}>
      {value}{total !== undefined && total > 0 ? <span style={{ fontSize: typography.fontSize.body, color: colors.textTertiary }}> / {total}</span> : null}
    </div>
    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </div>
  </div>
)

export default AnalysisProgress
