import React, { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { colors } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  labels?: Record<string, string>
  onTransition?: (nextState: string) => void
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  labels,
  onTransition,
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [pulse, setPulse] = useState(true)
  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    pulseRef.current = setInterval(() => setPulse(p => !p), 1000)
    return () => { if (pulseRef.current) clearInterval(pulseRef.current) }
  }, [])

  const currentIndex = states.indexOf(currentState)

  const getStateStatus = (state: string): 'completed' | 'current' | 'upcoming' => {
    if (completedStates.includes(state)) return 'completed'
    if (state === currentState) return 'current'
    return 'upcoming'
  }

  const getLabel = (state: string) => labels?.[state] ?? state.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const stepSize = 32
  const touchSize = 56

  return (
    <div
      role="progressbar"
      aria-label="Workflow progress"
      aria-valuenow={currentIndex}
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? '0' : '0',
        padding: '16px 20px',
        backgroundColor: colors.surfaceInset,
        borderRadius: '12px',
        overflowX: 'auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {states.map((state, index) => {
        const status = getStateStatus(state)
        const label = getLabel(state)
        const isLast = index === states.length - 1
        const canTransition = !!onTransition && status === 'upcoming' && index === currentIndex + 1

        const circleColor =
          status === 'completed' ? colors.statusActive :
          status === 'current' ? colors.primaryOrange :
          colors.textTertiary

        const labelColor =
          status === 'completed' ? colors.statusActive :
          status === 'current' ? colors.primaryOrange :
          colors.textTertiary

        return (
          <React.Fragment key={state}>
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'row' : 'column',
                alignItems: 'center',
                gap: isMobile ? '12px' : '6px',
                flex: isMobile ? 'none' : 1,
                minWidth: isMobile ? undefined : 0,
                position: 'relative',
                paddingBottom: isMobile && !isLast ? '0' : undefined,
              }}
            >
              <button
                aria-label={`Step ${index + 1}: ${label} — ${status}`}
                aria-current={status === 'current' ? 'step' : undefined}
                onClick={canTransition && onTransition ? () => onTransition(state) : undefined}
                disabled={!canTransition}
                style={{
                  width: touchSize,
                  height: touchSize,
                  minWidth: touchSize,
                  minHeight: touchSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: canTransition ? 'pointer' : 'default',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: stepSize,
                    height: stepSize,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      status === 'completed' ? colors.statusActive :
                      status === 'current' ? colors.primaryOrange :
                      'transparent',
                    border: `2px solid ${circleColor}`,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {status === 'completed' && (
                    <Check size={16} color={colors.white} strokeWidth={2.5} />
                  )}
                  {status === 'current' && (
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: colors.white,
                        opacity: pulse ? 1 : 0.4,
                        transition: 'opacity 0.5s ease',
                      }}
                    />
                  )}
                  {status === 'upcoming' && (
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: colors.textTertiary,
                      opacity: 0.4,
                    }} />
                  )}
                </div>
              </button>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: status === 'current' ? 700 : status === 'completed' ? 600 : 400,
                  color: labelColor,
                  textAlign: isMobile ? 'left' : 'center',
                  whiteSpace: isMobile ? undefined : 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: isMobile ? undefined : 80,
                  lineHeight: 1.3,
                  transition: 'color 0.2s ease',
                }}
              >
                {label}
              </span>
            </div>

            {!isLast && (
              <div
                aria-hidden="true"
                style={{
                  flex: isMobile ? 'none' : 1,
                  height: isMobile ? 24 : 2,
                  width: isMobile ? 2 : undefined,
                  minWidth: isMobile ? undefined : 8,
                  marginLeft: isMobile ? (touchSize / 2 - 1) + 'px' : undefined,
                  backgroundColor:
                    completedStates.includes(state) || state === currentState
                      ? `${colors.primaryOrange}40`
                      : colors.surfaceInset,
                  borderRadius: 2,
                  flexShrink: 0,
                  alignSelf: isMobile ? undefined : 'center',
                  transition: 'background-color 0.3s ease',
                }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
