import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Snowflake, Clock, GitBranch, ChevronDown, ChevronRight, ShieldCheck, Brain, TrendingDown } from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'
import type { SchedulePhase } from '../../stores/scheduleStore'
import { supabase } from '../../lib/supabase'

interface Props {
  schedulePhases: SchedulePhase[]
  projectId?: string | null
}

type FindingType = 'floating' | 'unrealistic' | 'critical_bottleneck' | 'weather' | 'ai_prediction'

type Finding = {
  id: string
  type: FindingType
  phaseId: string
  phaseName: string
  severity: 'low' | 'medium' | 'high'
  message: string
}

const SEVERITY_CONFIG: Record<Finding['severity'], { fg: string; bg: string; label: string }> = {
  low:    { fg: '#6B7280', bg: '#F3F4F6', label: 'Low' },
  medium: { fg: '#D97706', bg: '#FEF3C7', label: 'Med' },
  high:   { fg: '#DC2626', bg: '#FEF2F2', label: 'High' },
}

const TYPE_ICONS: Record<FindingType, React.ElementType> = {
  floating: GitBranch,
  unrealistic: Clock,
  critical_bottleneck: AlertTriangle,
  weather: Snowflake,
  ai_prediction: TrendingDown,
}

const TYPE_LABELS: Record<FindingType, string> = {
  floating: 'Floating Task',
  unrealistic: 'Unrealistic Duration',
  critical_bottleneck: 'Critical Path Bottleneck',
  weather: 'Weather-Sensitive in Winter',
  ai_prediction: 'AI Risk Forecast',
}

const TYPE_COLORS: Record<FindingType, { fg: string; bg: string }> = {
  floating:            { fg: '#6366F1', bg: '#EEF2FF' },
  unrealistic:         { fg: '#D97706', bg: '#FEF3C7' },
  critical_bottleneck: { fg: '#DC2626', bg: '#FEF2F2' },
  weather:             { fg: '#0891B2', bg: '#ECFEFF' },
  ai_prediction:       { fg: '#7C3AED', bg: '#F5F3FF' },
}

interface RiskPredictionRow {
  id: string
  risk_type: string
  probability: number
  impact: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendation: string
  predicted_at: string
}

function daysBetween(start: string, end: string) {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (isNaN(s) || isNaN(e)) return 0
  return Math.round((e - s) / 86400000)
}

function monthOfRange(start: string, end: string): number[] {
  const months = new Set<number>()
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return []
  const cur = new Date(s.getFullYear(), s.getMonth(), 1)
  while (cur <= e) {
    months.add(cur.getMonth())
    cur.setMonth(cur.getMonth() + 1)
  }
  return Array.from(months)
}

const WINTER_MONTHS = new Set([11, 0, 1])

const WEATHER_SENSITIVE_KEYWORDS = [
  'concrete', 'pour', 'excavat', 'site work', 'grading', 'paving', 'asphalt',
  'roofing', 'masonry', 'earthwork', 'landscap', 'exterior',
]

function impactToSeverity(impact: RiskPredictionRow['impact']): Finding['severity'] {
  if (impact === 'critical' || impact === 'high') return 'high'
  if (impact === 'medium') return 'medium'
  return 'low'
}

export const ScheduleAIRiskPanel: React.FC<Props> = ({ schedulePhases, projectId }) => {
  const [expanded, setExpanded] = useState(true)
  const [predictions, setPredictions] = useState<RiskPredictionRow[]>([])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    supabase
      .from('risk_predictions')
      .select('id, risk_type, probability, impact, description, recommendation, predicted_at')
      .eq('project_id', projectId)
      .in('risk_type', ['schedule_slip', 'rfi_delay'])
      .order('probability', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setPredictions([])
          return
        }
        setPredictions(data as RiskPredictionRow[])
      })
    return () => { cancelled = true }
  }, [projectId])

  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = []

    predictions.forEach((r) => {
      out.push({
        id: `pred-${r.id}`,
        type: 'ai_prediction',
        phaseId: r.id,
        phaseName: r.risk_type === 'schedule_slip' ? 'Schedule Slip Risk' : 'Dependency Risk',
        severity: impactToSeverity(r.impact),
        message: `${Math.round(r.probability * 100)}% likely · ${r.description || r.recommendation || 'AI-forecasted risk'}`,
      })
    })

    schedulePhases.forEach((p) => {
      const name = p.name || 'Unnamed'
      const pid = p.id

      const preds = p.predecessorIds || p.predecessor_ids || []
      if ((!preds || preds.length === 0) && !p.isMilestone) {
        out.push({
          id: `${pid}-float`,
          type: 'floating',
          phaseId: pid,
          phaseName: name,
          severity: 'medium',
          message: 'Has no predecessor — likely disconnected from network.',
        })
      }

      if (p.startDate && p.endDate) {
        const dur = daysBetween(p.startDate, p.endDate)
        if (dur <= 0) {
          out.push({
            id: `${pid}-zero`,
            type: 'unrealistic',
            phaseId: pid,
            phaseName: name,
            severity: 'high',
            message: `Duration is ${dur} days — dates may be swapped or identical.`,
          })
        } else if (dur > 365) {
          out.push({
            id: `${pid}-long`,
            type: 'unrealistic',
            phaseId: pid,
            phaseName: name,
            severity: 'medium',
            message: `Duration is ${dur} days (>1 year) — consider breaking into sub-phases.`,
          })
        }
      }

      const isCritical = p.isOnCriticalPath || p.is_critical_path === true || p.is_critical === true
      const floatDays = p.floatDays ?? 0
      if (isCritical && floatDays <= 0 && (p.progress ?? 0) < 100) {
        out.push({
          id: `${pid}-bottleneck`,
          type: 'critical_bottleneck',
          phaseId: pid,
          phaseName: name,
          severity: 'high',
          message: `Zero float on the critical path — any delay pushes the finish date.`,
        })
      }

      if (p.startDate && p.endDate) {
        const months = monthOfRange(p.startDate, p.endDate)
        const inWinter = months.some((m) => WINTER_MONTHS.has(m))
        if (inWinter) {
          const nameLower = name.toLowerCase()
          const workType = (p as unknown as Record<string, unknown>).work_type as string | undefined
          const isSensitive = workType === 'outdoor' || WEATHER_SENSITIVE_KEYWORDS.some((k) => nameLower.includes(k))
          if (isSensitive) {
            out.push({
              id: `${pid}-winter`,
              type: 'weather',
              phaseId: pid,
              phaseName: name,
              severity: 'medium',
              message: 'Weather-sensitive work scheduled during winter months — plan mitigations.',
            })
          }
        }
      }
    })

    return out
  }, [schedulePhases])

  const grouped = useMemo(() => {
    const g: Record<FindingType, Finding[]> = {
      ai_prediction: [], floating: [], unrealistic: [], critical_bottleneck: [], weather: [],
    }
    findings.forEach((f) => { g[f.type].push(f) })
    return g
  }, [findings])

  const totalHigh = findings.filter((f) => f.severity === 'high').length
  const totalMed = findings.filter((f) => f.severity === 'medium').length

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.borderSubtle}`,
      overflow: 'hidden',
      fontFamily: typography.fontFamily,
    }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing['4']} ${spacing['5']}`,
          border: 'none', background: 'none',
          borderBottom: expanded ? `1px solid ${colors.borderSubtle}` : 'none',
          cursor: 'pointer', fontFamily: typography.fontFamily,
          transition: `background-color ${transitions.quick}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <div style={{
            width: 32, height: 32, borderRadius: borderRadius.md,
            background: findings.length > 0
              ? 'linear-gradient(135deg, #FEF3C7, #FDE68A)'
              : 'linear-gradient(135deg, #F0FDF4, #BBF7D0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={16} color={findings.length > 0 ? '#D97706' : '#16A34A'} />
          </div>
          <span style={{
            fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.body,
            color: colors.textPrimary,
          }}>
            Schedule Intelligence
          </span>
          {findings.length > 0 && (
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
              backgroundColor: totalHigh > 0 ? '#FEF2F2' : '#FEF3C7',
              color: totalHigh > 0 ? '#991B1B' : '#92400E',
              padding: `2px ${spacing['2.5']}`, borderRadius: borderRadius.full,
            }}>
              {findings.length} finding{findings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {/* Severity badges */}
          {totalHigh > 0 && (
            <span style={{
              padding: `2px ${spacing['2.5']}`, borderRadius: borderRadius.full,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
              color: '#DC2626', backgroundColor: '#FEF2F2',
            }}>
              {totalHigh} critical
            </span>
          )}
          {totalMed > 0 && (
            <span style={{
              padding: `2px ${spacing['2.5']}`, borderRadius: borderRadius.full,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
              color: '#D97706', backgroundColor: '#FEF3C7',
            }}>
              {totalMed} warning
            </span>
          )}
          {expanded ? <ChevronDown size={16} color={colors.textTertiary} /> : <ChevronRight size={16} color={colors.textTertiary} />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div style={{ padding: spacing['5'] }}>
          {findings.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['3'],
              padding: spacing['4'], backgroundColor: '#F0FDF4',
              borderRadius: borderRadius.lg, border: '1px solid #BBF7D0',
            }}>
              <ShieldCheck size={18} color="#16A34A" />
              <span style={{ fontSize: typography.fontSize.sm, color: '#166534', fontWeight: typography.fontWeight.medium }}>
                No schedule risks detected — the network looks clean.
              </span>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: spacing['3'],
            }}>
              {(Object.keys(grouped) as FindingType[]).map((type) => {
                const items = grouped[type]
                if (items.length === 0) return null
                const Icon = TYPE_ICONS[type]
                const tc = TYPE_COLORS[type]

                return (
                  <div key={type} style={{
                    padding: spacing['4'],
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.lg,
                    backgroundColor: colors.surfacePage,
                    borderLeft: `3px solid ${tc.fg}`,
                    transition: `box-shadow ${transitions.quick}`,
                  }}>
                    {/* Category header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: spacing['2'],
                      marginBottom: spacing['3'],
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: borderRadius.md,
                        backgroundColor: tc.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={12} color={tc.fg} />
                      </div>
                      <span style={{
                        fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                      }}>
                        {TYPE_LABELS[type]}
                      </span>
                      <span style={{
                        fontSize: typography.fontSize.caption,
                        color: colors.textTertiary, fontWeight: typography.fontWeight.medium,
                        marginLeft: 'auto',
                      }}>
                        {items.length}
                      </span>
                    </div>

                    {/* Finding items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                      {items.slice(0, 5).map((f) => {
                        const sev = SEVERITY_CONFIG[f.severity]
                        return (
                          <div key={f.id} style={{
                            padding: `${spacing['2']} ${spacing['3']}`,
                            backgroundColor: colors.surfaceRaised,
                            borderRadius: borderRadius.md,
                            border: `1px solid ${colors.borderSubtle}`,
                          }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: spacing['2'],
                              marginBottom: spacing['1'],
                            }}>
                              <span style={{
                                fontSize: typography.fontSize.sm,
                                fontWeight: typography.fontWeight.semibold,
                                color: colors.textPrimary,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                flex: 1, minWidth: 0,
                              }}>
                                {f.phaseName}
                              </span>
                              <span style={{
                                fontSize: 9, fontWeight: 700,
                                padding: '1px 6px', borderRadius: borderRadius.full,
                                color: sev.fg, backgroundColor: sev.bg,
                                flexShrink: 0, textTransform: 'uppercase' as const,
                                letterSpacing: '0.04em',
                              }}>
                                {sev.label}
                              </span>
                            </div>
                            <p style={{
                              margin: 0,
                              fontSize: typography.fontSize.caption,
                              color: colors.textSecondary,
                              lineHeight: 1.4,
                            }}>
                              {f.message}
                            </p>
                          </div>
                        )
                      })}
                      {items.length > 5 && (
                        <span style={{
                          fontSize: typography.fontSize.caption,
                          color: colors.textTertiary,
                          fontWeight: typography.fontWeight.medium,
                          paddingLeft: spacing['3'],
                        }}>
                          +{items.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
