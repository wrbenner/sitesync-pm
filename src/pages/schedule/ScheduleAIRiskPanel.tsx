import React, { useMemo, useState } from 'react'
import { AlertTriangle, Snowflake, Clock, GitBranch, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, SectionHeader, Btn } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import type { SchedulePhase } from '../../stores/scheduleStore'

interface Props {
  schedulePhases: SchedulePhase[]
}

type Finding = {
  id: string
  type: 'floating' | 'unrealistic' | 'critical_bottleneck' | 'weather'
  phaseId: string
  phaseName: string
  severity: 'low' | 'medium' | 'high'
  message: string
}

const SEVERITY_COLORS: Record<Finding['severity'], { c: string; bg: string }> = {
  low: { c: colors.statusInfo, bg: colors.statusInfoSubtle },
  medium: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  high: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

const TYPE_ICONS: Record<Finding['type'], React.ElementType> = {
  floating: GitBranch,
  unrealistic: Clock,
  critical_bottleneck: AlertTriangle,
  weather: Snowflake,
}

const TYPE_LABELS: Record<Finding['type'], string> = {
  floating: 'Floating Task',
  unrealistic: 'Unrealistic Duration',
  critical_bottleneck: 'Critical Path Bottleneck',
  weather: 'Weather-Sensitive in Winter',
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

const WINTER_MONTHS = new Set([11, 0, 1]) // Dec, Jan, Feb (0-indexed)

const WEATHER_SENSITIVE_KEYWORDS = [
  'concrete', 'pour', 'excavat', 'site work', 'grading', 'paving', 'asphalt',
  'roofing', 'masonry', 'earthwork', 'landscap', 'exterior',
]

export const ScheduleAIRiskPanel: React.FC<Props> = ({ schedulePhases }) => {
  const [expanded, setExpanded] = useState(true)

  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = []

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
              message: 'Weather-sensitive work scheduled during winter months — plan mitigations (heaters, temp enclosures).',
            })
          }
        }
      }
    })

    return out
  }, [schedulePhases])

  const grouped = useMemo(() => {
    const g: Record<Finding['type'], Finding[]> = {
      floating: [], unrealistic: [], critical_bottleneck: [], weather: [],
    }
    findings.forEach((f) => { g[f.type].push(f) })
    return g
  }, [findings])

  const totalHigh = findings.filter((f) => f.severity === 'high').length
  const totalMed = findings.filter((f) => f.severity === 'medium').length

  return (
    <Card padding={spacing['4']} >
      <SectionHeader
        title={`AI Schedule Risk · ${findings.length} finding${findings.length !== 1 ? 's' : ''}`}
        action={
          <Btn variant="secondary" icon={expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Collapse' : 'Expand'}
          </Btn>
        }
      />
      {!expanded ? null : findings.length === 0 ? (
        <div style={{ padding: spacing['3'], color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
          No schedule risks detected — the network looks clean.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['2'], marginBottom: spacing['3'], flexWrap: 'wrap' }}>
            {totalHigh > 0 && (
              <span style={{ padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, color: colors.statusCritical, backgroundColor: colors.statusCriticalSubtle }}>
                {totalHigh} high
              </span>
            )}
            {totalMed > 0 && (
              <span style={{ padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, color: colors.statusPending, backgroundColor: colors.statusPendingSubtle }}>
                {totalMed} medium
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: spacing['3'] }}>
            {(Object.keys(grouped) as Finding['type'][]).map((type) => {
              const items = grouped[type]
              if (items.length === 0) return null
              const Icon = TYPE_ICONS[type]
              return (
                <div key={type} style={{ padding: spacing['3'], border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base, backgroundColor: colors.surfaceFlat }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'], fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                    <Icon size={14} color={colors.orangeText} />
                    {TYPE_LABELS[type]}
                    <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>· {items.length}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                    {items.slice(0, 5).map((f) => {
                      const palette = SEVERITY_COLORS[f.severity]
                      return (
                        <li key={f.id} style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                          <span style={{ fontWeight: typography.fontWeight.medium }}>{f.phaseName}</span>
                          <span style={{ marginLeft: spacing['1'], padding: `0 ${spacing.xs}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, color: palette.c, backgroundColor: palette.bg }}>
                            {f.severity}
                          </span>
                          <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>{f.message}</div>
                        </li>
                      )
                    })}
                    {items.length > 5 && (
                      <li style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>…and {items.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

