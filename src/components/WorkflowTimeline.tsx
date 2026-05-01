import React from 'react'
import { Check } from 'lucide-react'
import { colors } from '../styles/theme'

export interface WorkflowTimelineProps {
  /** Ordered list of state names to display */
  states: string[]
  /** The currently active state */
  currentState: string
  /** States that have already been completed (shown with checkmark) */
  completedStates: string[]
  /** Optional label formatter — defaults to capitalising with underscores → spaces */
  formatLabel?: (state: string) => string
  /** Called when the user clicks a future-state step (optional — omit to make read-only) */
  onTransition?: (nextState: string) => void
}

function defaultLabel(state: string) {
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

type StepKind = 'completed' | 'current' | 'upcoming'

function stepKind(state: string, currentState: string, completedStates: string[]): StepKind {
  if (completedStates.includes(state)) return 'completed'
  if (state === currentState) return 'current'
  return 'upcoming'
}

// ── Step circle ────────────────────────────────────────────

const StepCircle: React.FC<{ kind: StepKind; index: number }> = ({ kind, index }) => {
  const size = 28

  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, position: 'relative',
    transition: 'all 0.2s ease',
    fontSize: '11px', fontWeight: 700,
  }

  if (kind === 'completed') {
    return (
      <div style={{
        ...base,
        backgroundColor: colors.statusActive,
        color: colors.white,
      }}>
        <Check size={14} strokeWidth={3} />
      </div>
    )
  }

  if (kind === 'current') {
    return (
      <div style={{
        ...base,
        backgroundColor: colors.primaryOrange,
        color: colors.white,
        boxShadow: `0 0 0 4px ${colors.primaryOrange}22`,
      }}>
        <style>{`@keyframes wft-pulse { 0%,100%{box-shadow:0 0 0 4px ${colors.primaryOrange}22} 50%{box-shadow:0 0 0 8px ${colors.primaryOrange}11} }`}</style>
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.white }} />
      </div>
    )
  }

  // upcoming
  return (
    <div style={{
      ...base,
      backgroundColor: colors.statusNeutralSubtle,
      color: colors.textTertiary,
      border: `2px solid ${colors.borderSubtle}`,
    }}>
      {index + 1}
    </div>
  )
}

// ── Connector line ─────────────────────────────────────────

const Connector: React.FC<{ filled: boolean; vertical?: boolean }> = ({ filled, vertical }) => {
  if (vertical) {
    return (
      <div style={{
        width: 2, height: 20, margin: '2px auto',
        backgroundColor: filled ? colors.statusActive : colors.borderSubtle,
        transition: 'background-color 0.2s ease',
      }} />
    )
  }
  return (
    <div style={{
      flex: 1, height: 2, minWidth: 16,
      backgroundColor: filled ? colors.statusActive : colors.borderSubtle,
      transition: 'background-color 0.2s ease',
      alignSelf: 'center',
    }} />
  )
}

// ── Main component ─────────────────────────────────────────

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  formatLabel = defaultLabel,
  onTransition,
}) => {
  const currentIndex = states.indexOf(currentState)

  // ── Mobile vertical layout ─────────────────────────────
  const mobileStyle = `
    @media (max-width: 640px) {
      .wft-horizontal { display: none !important; }
      .wft-vertical   { display: flex !important; }
    }
    @media (min-width: 641px) {
      .wft-horizontal { display: flex !important; }
      .wft-vertical   { display: none !important; }
    }
  `

  const renderStep = (state: string, index: number, vertical: boolean) => {
    const kind = stepKind(state, currentState, completedStates)
    const label = formatLabel(state)
    const isClickable = kind === 'upcoming' && !!onTransition

    const labelStyle: React.CSSProperties = {
      fontSize: '11px',
      fontWeight: kind === 'current' ? 700 : 500,
      color: kind === 'completed'
        ? colors.statusActive
        : kind === 'current'
          ? colors.primaryOrange
          : colors.textTertiary,
      transition: 'color 0.2s ease',
      whiteSpace: 'nowrap',
      textAlign: vertical ? 'left' : 'center',
    }

    if (vertical) {
      return (
        <div
          key={state}
          role="listitem"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: isClickable ? 'pointer' : 'default',
              minHeight: 56,
              borderRadius: 10,
              padding: '0 8px',
            }}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={() => isClickable && onTransition!(state)}
            onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTransition!(state) } } : undefined}
            aria-label={`Step ${index + 1}: ${label} — ${kind}`}
          >
            <StepCircle kind={kind} index={index} />
            <span style={labelStyle}>{label}</span>
          </div>
          {index < states.length - 1 && (
            <div style={{ paddingLeft: 22 }}>
              <Connector filled={kind === 'completed'} vertical />
            </div>
          )}
        </div>
      )
    }

    return (
      <React.Fragment key={state}>
        <div
          role={isClickable ? 'button' : 'listitem'}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            cursor: isClickable ? 'pointer' : 'default',
            minWidth: 56, minHeight: 56,
            borderRadius: 10, padding: '8px 4px',
          }}
          tabIndex={isClickable ? 0 : undefined}
          onClick={() => isClickable && onTransition!(state)}
          onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTransition!(state) } } : undefined}
          aria-label={`Step ${index + 1}: ${label} — ${kind}`}
        >
          <StepCircle kind={kind} index={index} />
          <span style={labelStyle}>{label}</span>
        </div>
        {index < states.length - 1 && (
          <Connector filled={kind === 'completed'} />
        )}
      </React.Fragment>
    )
  }

  return (
    <div
      role="progressbar"
      aria-label="Workflow status"
      aria-valuenow={currentIndex >= 0 ? currentIndex : 0}
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      style={{ width: '100%' }}
    >
      <style>{mobileStyle}</style>

      {/* Horizontal (desktop / tablet) */}
      <div
        className="wft-horizontal"
        role="list"
        style={{
          display: 'flex', alignItems: 'flex-start',
          padding: '12px 0',
        }}
      >
        {states.map((state, i) => renderStep(state, i, false))}
      </div>

      {/* Vertical (mobile) */}
      <div
        className="wft-vertical"
        role="list"
        style={{ display: 'none', flexDirection: 'column', padding: '8px 0' }}
      >
        {states.map((state, i) => renderStep(state, i, true))}
      </div>
    </div>
  )
}

export default WorkflowTimeline
