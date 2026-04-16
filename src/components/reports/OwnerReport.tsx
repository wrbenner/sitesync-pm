// OwnerReport — Auto-generated owner/OAC meeting report.
// Moment 5 from the product vision: the PM walks into the meeting with
// better insight than any human could compile manually.
//
// Sections:
// 1. Progress narrative (AI-generated)
// 2. Schedule dashboard (days ahead/behind, milestones, critical path)
// 3. Budget summary (committed vs spent, change orders, forecast)
// 4. Risk flags (overdue RFIs, stalled submittals, sub performance)
// 5. Photo comparison (this week vs last week)
// 6. 3-week lookahead (upcoming milestones with risk indicators)
// 7. Export PDF button

import React, { useState, useEffect, useCallback } from 'react'
import {
  Download, Calendar, DollarSign, AlertTriangle,
  CheckCircle, XCircle,
  TrendingUp, RefreshCw, Sparkles,
  AlertCircle,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Card, Btn, SectionHeader, Tag, ProgressBar } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { ProgressTimeline } from './ProgressTimeline'
import { PhotoComparison } from './PhotoComparison'
import {
  generateOwnerReport, exportPDF,
  type OwnerReportData, type RiskFlag, type LookaheadItem,
} from '../../services/reportService'
import { useProjectId } from '../../hooks/useProjectId'
import { useProject } from '../../hooks/queries'
import { toast } from 'sonner'

// ── Helpers ──────────────────────────────────────────────

function compactDollars(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 10_000) return `$${Math.round(amount / 1000)}K`
  return `$${amount.toLocaleString()}`
}

const RISK_SEVERITY_COLORS: Record<RiskFlag['severity'], { fg: string; bg: string; icon: React.ReactNode }> = {
  critical: { fg: '#EF4444', bg: '#FEE2E2', icon: <XCircle size={16} /> },
  warning: { fg: '#F59E0B', bg: '#FEF3C7', icon: <AlertTriangle size={16} /> },
  info: { fg: '#3B82F6', bg: '#DBEAFE', icon: <AlertCircle size={16} /> },
}

const RISK_LEVEL_COLORS: Record<LookaheadItem['riskLevel'], string> = {
  green: '#22C55E',
  yellow: '#F59E0B',
  red: '#EF4444',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  on_track: { label: 'On Track', color: '#22C55E' },
  at_risk: { label: 'At Risk', color: '#F59E0B' },
  behind: { label: 'Behind Schedule', color: '#EF4444' },
  ahead: { label: 'Ahead of Schedule', color: '#3B82F6' },
}

// ── Main Component ───────────────────────────────────────

export const OwnerReport: React.FC = () => {
  const projectId = useProjectId()
  const { data: _project } = useProject(projectId)
  const [report, setReport] = useState<OwnerReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const loadReport = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const data = await generateOwnerReport(projectId)
      setReport(data)
    } catch (err) {
      setError('Failed to generate report. Please try again.')
      console.error('Owner report generation failed:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleExportPDF = async () => {
    if (!report) return
    setExporting(true)
    try {
      const blob = await exportPDF(report)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Owner_Report_${report.projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report exported')
    } catch {
      toast.error('PDF export failed')
    } finally {
      setExporting(false)
    }
  }

  // ── Loading State ───────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: spacing['12'], gap: spacing['4'],
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: `3px solid ${colors.surfaceInset}`,
          borderTopColor: colors.primaryOrange,
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0 }}>
          Generating owner report...
        </p>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
          Compiling schedule, budget, and risk data
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Error State ─────────────────────────────────────────
  if (error || !report) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: spacing['12'], gap: spacing['3'],
      }}>
        <AlertTriangle size={36} color={colors.statusCritical} />
        <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0 }}>
          {error || 'Unable to load report data'}
        </p>
        <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={loadReport}>
          Retry
        </Btn>
      </div>
    )
  }

  const { scheduleSummary, budgetSummary, riskFlags, progressPhotos, lookahead, milestones, narrative } = report
  const statusInfo = STATUS_LABELS[report.overallStatus] ?? STATUS_LABELS.on_track

  // Budget waterfall chart data
  const waterfallData = [
    { name: 'Original Contract', value: budgetSummary.originalContract, fill: '#3B82F6' },
    { name: 'Change Orders', value: budgetSummary.approvedChanges, fill: budgetSummary.approvedChanges >= 0 ? '#F59E0B' : '#22C55E' },
    { name: 'Current Contract', value: budgetSummary.currentContract, fill: '#6366F1' },
    { name: 'Spent to Date', value: budgetSummary.spent, fill: '#EF4444' },
    { name: 'Committed', value: budgetSummary.committed, fill: '#F97316' },
  ]

  return (
    <div style={{
      maxWidth: 960,
      margin: '0 auto',
    }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: spacing['8'],
        flexWrap: 'wrap',
        gap: spacing['4'],
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['2'] }}>
            <h1 style={{
              fontSize: typography.fontSize.display,
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: typography.letterSpacing.tighter,
              lineHeight: typography.lineHeight.tight,
            }}>
              Owner Report
            </h1>
            <div style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              backgroundColor: statusInfo.color + '18',
              borderRadius: borderRadius.full,
              display: 'flex', alignItems: 'center', gap: spacing['1.5'],
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: statusInfo.color,
              }} />
              <span style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: statusInfo.color,
              }}>
                {statusInfo.label}
              </span>
            </div>
          </div>
          <p style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            margin: 0,
          }}>
            {report.projectName}{report.projectAddress ? ` \u2014 ${report.projectAddress}` : ''}
          </p>
          <p style={{
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            margin: 0, marginTop: spacing['1'],
          }}>
            Generated {report.reportDate}
          </p>
        </div>

        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn
            variant="secondary"
            icon={<RefreshCw size={16} />}
            onClick={loadReport}
          >
            Refresh
          </Btn>
          <Btn
            variant="primary"
            icon={<Download size={16} />}
            onClick={handleExportPDF}
            loading={exporting}
          >
            Export PDF
          </Btn>
        </div>
      </div>

      {/* ── 1. Progress Narrative ──────────────────────────── */}
      <Card padding={spacing['6']}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
          <Sparkles size={18} color={colors.primaryOrange} />
          <h2 style={{
            fontSize: typography.fontSize.title,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
          }}>
            Executive Summary
          </h2>
          <Tag
            label="AI Generated"
            color={colors.primaryOrange}
            backgroundColor={colors.orangeSubtle}
            fontSize={typography.fontSize.caption}
          />
        </div>
        <p style={{
          fontSize: typography.fontSize.title,
          fontWeight: typography.fontWeight.normal,
          color: colors.textPrimary,
          margin: 0,
          lineHeight: typography.lineHeight.relaxed,
          letterSpacing: typography.letterSpacing.normal,
        }}>
          {narrative}
        </p>
      </Card>

      {/* ── Key Metrics Row ───────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: spacing['4'], marginTop: spacing['5'],
      }}>
        <MetricTile
          icon={<TrendingUp size={20} />}
          label="Overall Progress"
          value={`${report.percentComplete}%`}
          sub={statusInfo.label}
          color={statusInfo.color}
        />
        <MetricTile
          icon={<Calendar size={20} />}
          label="Schedule"
          value={`${Math.abs(scheduleSummary.daysAheadBehind)}d`}
          sub={scheduleSummary.daysAheadBehind >= 0 ? 'Ahead' : 'Behind'}
          color={scheduleSummary.daysAheadBehind >= 0 ? '#22C55E' : '#EF4444'}
        />
        <MetricTile
          icon={<DollarSign size={20} />}
          label="Budget Spent"
          value={compactDollars(budgetSummary.spent)}
          sub={`of ${compactDollars(budgetSummary.currentContract)}`}
          color={budgetSummary.spent > budgetSummary.currentContract * 0.9 ? '#EF4444' : '#3B82F6'}
        />
        <MetricTile
          icon={<AlertTriangle size={20} />}
          label="Risk Flags"
          value={String(riskFlags.length)}
          sub={riskFlags.filter((r) => r.severity === 'critical').length > 0
            ? `${riskFlags.filter((r) => r.severity === 'critical').length} critical`
            : 'No critical items'
          }
          color={riskFlags.filter((r) => r.severity === 'critical').length > 0 ? '#EF4444' : '#22C55E'}
        />
      </div>

      {/* ── 2. Schedule Dashboard ─────────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="Schedule Dashboard" />
        <Card padding={spacing['5']}>
          {/* Phase counts */}
          <div style={{ display: 'flex', gap: spacing['6'], marginBottom: spacing['5'], flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: typography.fontSize.display, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0, lineHeight: 1 }}>
                {scheduleSummary.completedPhases}
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>Completed</p>
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.display, fontWeight: typography.fontWeight.bold, color: '#3B82F6', margin: 0, lineHeight: 1 }}>
                {scheduleSummary.inProgressPhases}
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>In Progress</p>
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.display, fontWeight: typography.fontWeight.bold, color: colors.textTertiary, margin: 0, lineHeight: 1 }}>
                {scheduleSummary.totalPhases - scheduleSummary.completedPhases - scheduleSummary.inProgressPhases}
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>Remaining</p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: spacing['5'] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Phase completion
              </span>
              <span style={{
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary, fontVariantNumeric: 'tabular-nums',
              }}>
                {scheduleSummary.totalPhases > 0
                  ? Math.round((scheduleSummary.completedPhases / scheduleSummary.totalPhases) * 100)
                  : 0}%
              </span>
            </div>
            <ProgressBar
              value={scheduleSummary.completedPhases}
              max={scheduleSummary.totalPhases || 1}
              height={6}
            />
          </div>

          {/* Critical path items */}
          {scheduleSummary.criticalPathItems.length > 0 && (
            <div>
              <p style={{
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.medium,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
                margin: 0, marginBottom: spacing['3'],
              }}>
                Critical Path
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {scheduleSummary.criticalPathItems.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['2.5']} ${spacing['3']}`,
                    backgroundColor: colors.surfaceInset,
                    borderRadius: borderRadius.md,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: item.status === 'complete' ? '#22C55E'
                        : item.status === 'in_progress' ? '#3B82F6' : colors.textTertiary,
                    }} />
                    <span style={{
                      flex: 1, fontSize: typography.fontSize.sm,
                      color: colors.textPrimary, fontWeight: typography.fontWeight.medium,
                    }}>
                      {item.name}
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.caption, color: colors.textTertiary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {item.percentComplete}%
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.caption, color: colors.textTertiary,
                      whiteSpace: 'nowrap',
                    }}>
                      Due {item.endDate}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Milestone Timeline ────────────────────────────── */}
      <div style={{ marginTop: spacing['5'] }}>
        <Card padding={spacing['5']}>
          <SectionHeader title="Project Timeline" />
          <ProgressTimeline milestones={milestones} />
        </Card>
      </div>

      {/* ── 3. Budget Summary ─────────────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="Budget Summary" />
        <Card padding={spacing['5']}>
          {/* Budget bar chart */}
          <div style={{ height: 280, marginBottom: spacing['5'] }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: colors.textTertiary }}
                  axisLine={{ stroke: colors.borderSubtle }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: colors.textTertiary }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => compactDollars(v)}
                />
                <Tooltip
                  formatter={(value: number) => [compactDollars(value), 'Amount']}
                  contentStyle={{
                    backgroundColor: colors.surfaceRaised,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.sm,
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Change orders table */}
          {budgetSummary.changeOrders.length > 0 && (
            <div>
              <p style={{
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.medium,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
                margin: 0, marginBottom: spacing['3'],
              }}>
                Change Orders
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                {budgetSummary.changeOrders.slice(0, 8).map((co, idx) => (
                  <div key={idx} style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 100px 80px',
                    gap: spacing['3'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    backgroundColor: idx % 2 === 0 ? colors.surfaceInset : 'transparent',
                    borderRadius: borderRadius.sm,
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilyMono,
                    }}>
                      {co.number}
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.textSecondary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {co.description}
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: co.amount >= 0 ? '#EF4444' : '#22C55E',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {co.amount >= 0 ? '+' : ''}{compactDollars(Math.abs(co.amount))}
                    </span>
                    <Tag
                      label={co.status}
                      color={co.status === 'approved' ? '#22C55E' : co.status === 'pending' ? '#F59E0B' : colors.textTertiary}
                      backgroundColor={co.status === 'approved' ? '#DCFCE7' : co.status === 'pending' ? '#FEF3C7' : colors.surfaceInset}
                      fontSize={typography.fontSize.caption}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── 4. Risk Flags ─────────────────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="Risk Flags" />
        {riskFlags.length === 0 ? (
          <Card padding={spacing['5']}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['3'],
              padding: spacing['3'],
            }}>
              <CheckCircle size={20} color="#22C55E" />
              <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>
                No active risk flags. All items within acceptable thresholds.
              </span>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {riskFlags.map((flag, idx) => {
              const sc = RISK_SEVERITY_COLORS[flag.severity]
              return (
                <Card key={idx} padding={spacing['4']}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: borderRadius.md,
                      backgroundColor: sc.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: sc.fg, flexShrink: 0,
                    }}>
                      {sc.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                        <span style={{
                          fontSize: typography.fontSize.body,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                        }}>
                          {flag.title}
                        </span>
                        <Tag
                          label={flag.severity}
                          color={sc.fg}
                          backgroundColor={sc.bg}
                          fontSize={typography.fontSize.caption}
                        />
                      </div>
                      <p style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        margin: 0,
                        lineHeight: typography.lineHeight.normal,
                      }}>
                        {flag.detail}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 5. Photo Comparison ────────────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="Progress Photos" />
        <Card padding={spacing['5']}>
          <PhotoComparison photos={progressPhotos} />
        </Card>
      </div>

      {/* ── 6. Three-Week Lookahead ───────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="3-Week Lookahead" />
        {lookahead.length === 0 ? (
          <Card padding={spacing['5']}>
            <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0, textAlign: 'center' }}>
              No upcoming milestones in the next 3 weeks
            </p>
          </Card>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: spacing['3'],
          }}>
            {lookahead.map((item, idx) => (
              <Card key={idx} padding={spacing['4']}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
                  {/* Risk indicator */}
                  <div style={{
                    width: 4, alignSelf: 'stretch', borderRadius: 2,
                    backgroundColor: RISK_LEVEL_COLORS[item.riskLevel],
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      margin: 0, marginBottom: spacing['1'],
                      lineHeight: typography.lineHeight.snug,
                    }}>
                      {item.name}
                    </p>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      marginBottom: item.blockers.length > 0 ? spacing['2'] : 0,
                    }}>
                      <span style={{
                        fontSize: typography.fontSize.caption,
                        color: colors.textTertiary,
                      }}>
                        {item.startDate} \u2192 {item.endDate}
                      </span>
                    </div>
                    {/* Blockers */}
                    {item.blockers.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                        {item.blockers.map((b, bIdx) => (
                          <div key={bIdx} style={{
                            display: 'flex', alignItems: 'center', gap: spacing['1.5'],
                          }}>
                            <AlertTriangle size={11} color={RISK_LEVEL_COLORS[item.riskLevel]} />
                            <span style={{
                              fontSize: typography.fontSize.caption,
                              color: RISK_LEVEL_COLORS[item.riskLevel],
                              fontWeight: typography.fontWeight.medium,
                            }}>
                              {b}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div style={{
        marginTop: spacing['10'],
        paddingTop: spacing['5'],
        borderTop: `1px solid ${colors.borderSubtle}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: spacing['3'],
      }}>
        <p style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          margin: 0,
        }}>
          Report generated by SiteSync AI on {report.reportDate}. Data reflects the latest project state.
        </p>
        <Btn
          variant="primary"
          icon={<Download size={16} />}
          onClick={handleExportPDF}
          loading={exporting}
        >
          Export PDF
        </Btn>
      </div>
    </div>
  )
}

// ── Metric Tile ──────────────────────────────────────────

interface MetricTileProps {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}

const MetricTile: React.FC<MetricTileProps> = ({ icon, label, value, sub, color }) => (
  <Card padding={spacing['5']}>
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
      <span style={{ color: colors.textTertiary }}>{icon}</span>
      <span style={{
        fontSize: typography.fontSize.label,
        fontWeight: typography.fontWeight.medium,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
      }}>
        {label}
      </span>
    </div>
    <p style={{
      fontSize: typography.fontSize.display,
      fontWeight: typography.fontWeight.bold,
      color,
      margin: 0,
      lineHeight: typography.lineHeight.none,
      letterSpacing: typography.letterSpacing.tighter,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </p>
    <p style={{
      fontSize: typography.fontSize.sm,
      color: colors.textTertiary,
      margin: 0,
      marginTop: spacing['1'],
    }}>
      {sub}
    </p>
  </Card>
)
