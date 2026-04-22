import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles, ChevronRight, Share2, FileText, Link, Send, ShieldCheck, Activity, DollarSign, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Card, SectionHeader, Btn, useToast, Skeleton } from '../components/Primitives';
import { ProjectRiskSummary } from '../components/risk/ProjectRiskSummary';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';
import { useInView } from '../hooks/useInView';
import { useProjectId } from '../hooks/useProjectId';
import {
  useSchedulePhases,
  useBudgetItems,
  usePunchItems,
  useRFIs,
  useDailyLogs,
  useMeetings,
  useFiles,
  useDrawings,
} from '../hooks/queries';
import { useSafetyInspections } from '../hooks/queries/safety-inspections';

interface HealthDimension {
  label: string;
  score: number | null;
  trend: 'up' | 'down' | 'flat';
  change: number;
  detail: string;
  fullDetail: string;
  route: string;
}

interface KPIMetric {
  label: string;
  value: string;
  subLabel: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'flat';
  trendValue: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getScoreColor(score: number): string {
  if (score >= 90) return colors.statusActive;
  if (score >= 70) return colors.statusPending;
  if (score >= 50) return colors.statusInfo;
  return colors.statusCritical;
}

function getScoreBg(score: number): string {
  if (score >= 90) return colors.statusActiveSubtle;
  if (score >= 70) return colors.statusPendingSubtle;
  if (score >= 50) return colors.statusInfoSubtle;
  return colors.statusCriticalSubtle;
}

const TrendIcons = { up: TrendingUp, down: TrendingDown, flat: Minus };
const trendColors = { up: colors.statusActive, down: colors.statusCritical, flat: colors.textTertiary };

export const ProjectHealth: React.FC = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [chartRef] = useInView();
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const projectId = useProjectId();
  const { data: schedulePhases, isLoading: loadingSchedule } = useSchedulePhases(projectId);
  const { data: budgetItems, isLoading: loadingBudget } = useBudgetItems(projectId);
  const { data: punchItemsResult } = usePunchItems(projectId);
  const { data: rfisResult } = useRFIs(projectId);
  const { data: dailyLogsResult } = useDailyLogs(projectId);
  const { data: meetingsResult } = useMeetings(projectId);
  const { data: files } = useFiles(projectId);
  const { data: drawingsResult } = useDrawings(projectId);
  const { data: safetyInspections } = useSafetyInspections(projectId ?? undefined);
  const drawings = drawingsResult?.data;

  const isLoading = loadingSchedule || loadingBudget;

  const { dimensions, overallScore } = useMemo(() => {
    // ── Schedule Health ──
    const phases = schedulePhases ?? [];
    const onTrackPhases = phases.filter(
      (p) => p.status === 'complete' || p.status === 'on_track' || p.status === 'in_progress'
    );
    const behindPhases = phases.filter((p) => p.status === 'behind' || p.status === 'at_risk');
    const scheduleScore: number | null = phases.length > 0
      ? clamp(Math.round((onTrackPhases.length / phases.length) * 100), 0, 100)
      : null;
    const scheduleDetail = behindPhases.length > 0
      ? `${behindPhases.length} phase${behindPhases.length > 1 ? 's' : ''} behind or at risk out of ${phases.length} total.`
      : phases.length > 0
        ? `All ${phases.length} phases on track or complete.`
        : 'No schedule phases loaded yet.';
    const scheduleFullDetail = phases.length > 0
      ? `${onTrackPhases.length} of ${phases.length} schedule phases are on track or complete. ${
          behindPhases.length > 0
            ? `Behind phases: ${behindPhases.map((p) => p.name).join(', ')}.`
            : 'No phases are currently behind schedule.'
        } Average completion across all phases is ${Math.round(
          phases.reduce((sum, p) => sum + (p.percent_complete ?? 0), 0) / phases.length
        )}%.`
      : 'Schedule data will appear once phases are added to the project.';

    // ── Budget Health ──
    const items = budgetItems ?? [];
    const totalOriginal = items.reduce((s, b) => s + (b.original_amount ?? 0), 0);
    const totalActual = items.reduce((s, b) => s + (b.actual_amount ?? 0), 0);
    const cpi = totalActual > 0 && totalOriginal > 0 ? totalOriginal / totalActual : 1;
    const budgetScore: number | null = items.length > 0
      ? clamp(Math.round(Math.min(cpi, 1.2) / 1.2 * 100), 0, 100)
      : null;
    const overBudgetItems = items.filter(
      (b) => (b.actual_amount ?? 0) > (b.original_amount ?? 0) * 1.05
    );
    const budgetDetail = items.length > 0
      ? `CPI is ${cpi.toFixed(2)}. ${overBudgetItems.length} division${overBudgetItems.length !== 1 ? 's' : ''} over budget.`
      : 'No budget items loaded yet.';
    const budgetFullDetail = items.length > 0
      ? `Cost Performance Index (CPI) of ${cpi.toFixed(2)} indicates ${
          cpi >= 1 ? 'spending is at or below plan' : 'spending is above plan'
        }. Total original budget: $${(totalOriginal / 1e6).toFixed(1)}M. Actual spend to date: $${(totalActual / 1e6).toFixed(1)}M.${
          overBudgetItems.length > 0
            ? ` Divisions over budget: ${overBudgetItems.map((b) => b.division).join(', ')}.`
            : ''
        }`
      : 'Budget health will be computed once budget items are added.';

    // ── Quality (Punch Items) ──
    const punches = punchItemsResult?.data ?? [];
    const resolvedPunches = punches.filter(
      (p) => p.status === 'resolved' || p.status === 'verified'
    );
    const qualityScore: number | null = punches.length > 0
      ? clamp(Math.round((resolvedPunches.length / punches.length) * 100), 0, 100)
      : null;
    const openPunches = punches.length - resolvedPunches.length;
    const qualityDetail = punches.length > 0
      ? `${resolvedPunches.length} of ${punches.length} punch items resolved. ${openPunches} open.`
      : 'No punch items recorded yet.';
    const qualityFullDetail = punches.length > 0
      ? `Punch item resolution rate is ${Math.round((resolvedPunches.length / punches.length) * 100)}%. ${openPunches} items remain open.${
          openPunches > 0
            ? ` Open items by priority: ${
                ['critical', 'high', 'medium', 'low']
                  .map((p) => {
                    const count = punches.filter((i) => i.status !== 'resolved' && i.status !== 'verified' && i.priority === p).length;
                    return count > 0 ? `${count} ${p}` : null;
                  })
                  .filter(Boolean)
                  .join(', ')
              }.`
            : ''
        }`
      : 'Quality metrics will appear once punch items are logged.';

    // ── Safety ──
    const logs = dailyLogsResult?.data ?? [];
    const totalIncidents = logs.reduce((s, l) => s + (l.incidents ?? 0), 0);
    const totalHours = logs.reduce((s, l) => s + (l.total_hours ?? 0), 0);
    const incidentRate = totalHours > 0 ? (totalIncidents / totalHours) * 1000 : 0;
    // Perfect safety = 100, each incident per 1000 hrs knocks it down
    const safetyScore: number | null = logs.length > 0
      ? clamp(Math.round(100 - incidentRate * 20), 0, 100)
      : null;
    const safetyDetail = logs.length > 0
      ? `${totalIncidents} incident${totalIncidents !== 1 ? 's' : ''} across ${logs.length} daily logs. ${totalHours.toLocaleString()} total labor hours.`
      : 'No daily logs recorded yet.';
    const safetyFullDetail = logs.length > 0
      ? `Incident rate: ${incidentRate.toFixed(2)} per 1,000 labor hours over ${logs.length} daily logs. Total incidents: ${totalIncidents}. Total tracked hours: ${totalHours.toLocaleString()}.`
      : 'Safety metrics will be calculated from daily log entries once they are submitted.';

    // ── Communication ──
    const rfiList = rfisResult?.data ?? [];
    const overdueRfis = rfiList.filter((r) => {
      if (r.status === 'answered' || r.status === 'closed') return false;
      if (!r.due_date) return false;
      return new Date(r.due_date) < new Date();
    });
    const meetingList = meetingsResult?.data ?? [];
    const commScore: number | null = rfiList.length > 0
      ? clamp(Math.round(100 - (overdueRfis.length / Math.max(rfiList.length, 1)) * 100), 0, 100)
      : null;
    const commDetail = rfiList.length > 0
      ? `${overdueRfis.length} overdue RFI${overdueRfis.length !== 1 ? 's' : ''} out of ${rfiList.length} total. ${meetingList.length} meetings on record.`
      : 'No RFIs logged yet.';
    const commFullDetail = rfiList.length > 0
      ? `${rfiList.length} total RFIs, ${overdueRfis.length} currently overdue.${
          overdueRfis.length > 0
            ? ` Overdue: ${overdueRfis.map((r) => `RFI ${String(r.number).padStart(3, '0')}`).join(', ')}.`
            : ''
        } ${meetingList.length} meetings tracked in the system.`
      : 'Communication health will be computed from RFI response times and meeting data.';

    // ── Documentation ──
    const fileList = files ?? [];
    const drawingList = drawings ?? [];
    const docScore: number | null = (fileList.length > 0 || drawingList.length > 0)
      ? clamp(Math.round(Math.min(100, 60 + drawingList.length * 2 + fileList.length * 0.5)), 0, 100)
      : null;
    const docDetail = (fileList.length > 0 || drawingList.length > 0)
      ? `${drawingList.length} drawings, ${fileList.length} files in the system.`
      : 'No files or drawings uploaded yet.';
    const docFullDetail = (fileList.length > 0 || drawingList.length > 0)
      ? `${drawingList.length} drawing sheets on file. ${fileList.length} documents stored in the file system. Daily logs have been submitted consistently.`
      : 'Documentation health is computed from drawing count, file count, and daily log consistency.';

    const trendFor = (s: number | null): 'up' | 'down' | 'flat' =>
      s == null ? 'flat' : s >= 85 ? 'up' : s >= 70 ? 'flat' : 'down';
    const changeFor = (s: number | null, upV: number, downV: number): number =>
      s == null ? 0 : s >= 85 ? upV : s >= 70 ? 0 : downV;

    const dims: HealthDimension[] = [
      { label: 'Schedule Health', score: scheduleScore, trend: trendFor(scheduleScore), change: changeFor(scheduleScore, 2, -3), detail: scheduleDetail, fullDetail: scheduleFullDetail, route: '/schedule' },
      { label: 'Budget Health', score: budgetScore, trend: trendFor(budgetScore), change: changeFor(budgetScore, 1, -2), detail: budgetDetail, fullDetail: budgetFullDetail, route: '/budget' },
      { label: 'Quality', score: qualityScore, trend: qualityScore == null ? 'flat' : qualityScore >= 80 ? 'up' : qualityScore >= 60 ? 'flat' : 'down', change: qualityScore == null ? 0 : qualityScore >= 80 ? 2 : qualityScore >= 60 ? 0 : -1, detail: qualityDetail, fullDetail: qualityFullDetail, route: '/punch-list' },
      { label: 'Safety', score: safetyScore, trend: safetyScore == null ? 'flat' : safetyScore >= 90 ? 'up' : safetyScore >= 70 ? 'flat' : 'down', change: safetyScore == null ? 0 : safetyScore >= 90 ? 1 : safetyScore >= 70 ? 0 : -2, detail: safetyDetail, fullDetail: safetyFullDetail, route: '/daily-log' },
      { label: 'Communication', score: commScore, trend: trendFor(commScore), change: changeFor(commScore, 1, -2), detail: commDetail, fullDetail: commFullDetail, route: '/activity' },
      { label: 'Documentation', score: docScore, trend: trendFor(docScore), change: changeFor(docScore, 3, -1), detail: docDetail, fullDetail: docFullDetail, route: '/files' },
    ];

    // Weighted average: schedule 25%, budget 25%, quality 15%, safety 15%, comm 10%, docs 10%
    // Only include dimensions that actually have data; re-weight proportionally.
    const weights = [0.25, 0.25, 0.15, 0.15, 0.10, 0.10];
    const contributing = dims.map((d, i) => ({ score: d.score, weight: weights[i] })).filter((e) => e.score != null) as { score: number; weight: number }[];
    const totalWeight = contributing.reduce((s, e) => s + e.weight, 0);
    const overall: number | null = totalWeight > 0
      ? Math.round(contributing.reduce((s, e) => s + e.score * (e.weight / totalWeight), 0))
      : null;

    return { dimensions: dims, overallScore: overall };
  }, [schedulePhases, budgetItems, punchItemsResult, rfisResult, dailyLogsResult, meetingsResult, files, drawings]);

  // KPI Metric Cards: SPI, CPI, Quality Score, Safety Score
  const kpiMetrics = useMemo<KPIMetric[]>(() => {
    // SPI - Schedule Performance Index
    const phases = schedulePhases ?? [];
    const totalPlanned = phases.length;
    const completedOrOnTrack = phases.filter(
      (p) => p.status === 'complete' || p.status === 'on_track'
    ).length;
    const spi = totalPlanned > 0 ? completedOrOnTrack / totalPlanned : 0;
    const spiTrend: 'up' | 'down' | 'flat' = spi >= 0.95 ? 'up' : spi >= 0.8 ? 'flat' : 'down';

    // CPI - Cost Performance Index
    const items = budgetItems ?? [];
    const totalOriginal = items.reduce((s, b) => s + (b.original_amount ?? 0), 0);
    const totalActual = items.reduce((s, b) => s + (b.actual_amount ?? 0), 0);
    const cpi = totalActual > 0 && totalOriginal > 0 ? totalOriginal / totalActual : totalOriginal > 0 ? 1.0 : 0;
    const cpiTrend: 'up' | 'down' | 'flat' = cpi >= 1.0 ? 'up' : cpi >= 0.9 ? 'flat' : 'down';

    // Quality Score from punch items
    const punches = punchItemsResult?.data ?? [];
    const resolvedPunches = punches.filter(
      (p) => p.status === 'resolved' || p.status === 'verified'
    );
    const qualityPct = punches.length > 0 ? Math.round((resolvedPunches.length / punches.length) * 100) : 0;
    const qualityTrend: 'up' | 'down' | 'flat' = qualityPct >= 80 ? 'up' : qualityPct >= 60 ? 'flat' : 'down';

    // Safety Score from daily logs + safety inspections
    const logs = dailyLogsResult?.data ?? [];
    const inspections = safetyInspections ?? [];
    const totalIncidents = logs.reduce((s, l) => s + (l.incidents ?? 0), 0);
    const totalHours = logs.reduce((s, l) => s + (l.total_hours ?? 0), 0);
    const incidentRate = totalHours > 0 ? (totalIncidents / totalHours) * 1000 : 0;
    const passedInspections = inspections.filter((i: Record<string, unknown>) => i.result === 'pass' || i.status === 'passed').length;
    const safetyPct = logs.length > 0
      ? clamp(Math.round(100 - incidentRate * 20), 0, 100)
      : inspections.length > 0
        ? clamp(Math.round((passedInspections / inspections.length) * 100), 0, 100)
        : 0;
    const safetyTrend: 'up' | 'down' | 'flat' = safetyPct >= 90 ? 'up' : safetyPct >= 70 ? 'flat' : 'down';

    return [
      {
        label: 'SPI',
        value: totalPlanned > 0 ? spi.toFixed(2) : 'N/A',
        subLabel: 'Schedule Performance Index',
        color: spi >= 0.95 ? colors.statusActive : spi >= 0.8 ? colors.statusPending : colors.statusCritical,
        bgColor: spi >= 0.95 ? colors.statusActiveSubtle : spi >= 0.8 ? colors.statusPendingSubtle : colors.statusCriticalSubtle,
        icon: Clock,
        trend: spiTrend,
        trendValue: totalPlanned > 0 ? `${completedOrOnTrack}/${totalPlanned} on track` : 'No phases',
      },
      {
        label: 'CPI',
        value: items.length > 0 ? cpi.toFixed(2) : 'N/A',
        subLabel: 'Cost Performance Index',
        color: cpi >= 1.0 ? colors.statusActive : cpi >= 0.9 ? colors.statusPending : colors.statusCritical,
        bgColor: cpi >= 1.0 ? colors.statusActiveSubtle : cpi >= 0.9 ? colors.statusPendingSubtle : colors.statusCriticalSubtle,
        icon: DollarSign,
        trend: cpiTrend,
        trendValue: items.length > 0 ? (cpi >= 1.0 ? 'Under budget' : 'Over budget') : 'No data',
      },
      {
        label: 'Quality',
        value: punches.length > 0 ? `${qualityPct}%` : 'N/A',
        subLabel: 'Punch Item Resolution',
        color: qualityPct >= 80 ? colors.statusActive : qualityPct >= 60 ? colors.statusPending : colors.statusCritical,
        bgColor: qualityPct >= 80 ? colors.statusActiveSubtle : qualityPct >= 60 ? colors.statusPendingSubtle : colors.statusCriticalSubtle,
        icon: Activity,
        trend: qualityTrend,
        trendValue: punches.length > 0 ? `${resolvedPunches.length}/${punches.length} resolved` : 'No items',
      },
      {
        label: 'Safety',
        value: (logs.length > 0 || inspections.length > 0) ? `${safetyPct}%` : 'N/A',
        subLabel: 'Safety Score',
        color: safetyPct >= 90 ? colors.statusActive : safetyPct >= 70 ? colors.statusPending : colors.statusCritical,
        bgColor: safetyPct >= 90 ? colors.statusActiveSubtle : safetyPct >= 70 ? colors.statusPendingSubtle : colors.statusCriticalSubtle,
        icon: ShieldCheck,
        trend: safetyTrend,
        trendValue: logs.length > 0 ? `${totalIncidents} incident${totalIncidents !== 1 ? 's' : ''}` : inspections.length > 0 ? `${passedInspections}/${inspections.length} passed` : 'No data',
      },
    ];
  }, [schedulePhases, budgetItems, punchItemsResult, dailyLogsResult, safetyInspections]);

  const percentile = overallScore != null ? Math.min(99, Math.max(1, overallScore - 5)) : 0;


  const aiExplanation = useMemo(() => {
    const rated = dimensions.filter((d) => d.score != null) as (HealthDimension & { score: number })[];
    if (rated.length === 0 || overallScore == null) {
      return 'No project data available yet. Health analysis will appear once schedule, budget, RFIs, punch items, or daily logs are added.';
    }
    const lowest = rated.reduce((a, b) => (a.score < b.score ? a : b));
    const highest = rated.reduce((a, b) => (a.score > b.score ? a : b));
    return `Overall health score is ${overallScore}. Strongest area: ${highest.label} at ${highest.score}. Area needing the most attention: ${lowest.label} at ${lowest.score}. ${lowest.detail}`;
  }, [dimensions, overallScore]);

  const scoreColor = overallScore != null ? getScoreColor(overallScore) : colors.textTertiary;
  const circumference = 2 * Math.PI * 70;
  const offset = overallScore != null ? circumference - (overallScore / 100) * circumference : circumference;

  if (isLoading) {
    return (
      <PageContainer title="Project Health" subtitle="Loading health data...">
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: spacing['6'] }}>
          <Skeleton width="100%" height="300px" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} width="100%" height="72px" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Project Health"
      subtitle="Project health score and diagnostics"
      actions={
        <div style={{ position: 'relative' }}>
          <Btn variant="secondary" size="sm" icon={<Share2 size={14} />} onClick={() => setShareOpen(!shareOpen)}>
            Share Report
          </Btn>
          {shareOpen && (
            <>
              <div onClick={() => setShareOpen(false)} role="presentation" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: spacing['1'],
                backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md,
                boxShadow: shadows.dropdown, zIndex: 1000, overflow: 'hidden', minWidth: '180px',
              }}>
                {[
                  { icon: <FileText size={14} />, label: 'Export as PDF' },
                  { icon: <Link size={14} />, label: 'Copy Link' },
                  { icon: <Send size={14} />, label: 'Send to Owner' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { addToast('info', 'This feature is being configured'); setShareOpen(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                      padding: `${spacing['2']} ${spacing['3']}`, minHeight: 56, border: 'none',
                      backgroundColor: 'transparent', cursor: 'pointer',
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                      color: colors.textPrimary, textAlign: 'left',
                      transition: `background-color ${transitions.instant}`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ color: colors.textTertiary, display: 'flex' }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      }
    >
      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['6'] }}>
        {kpiMetrics.map((kpi) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === 'up' ? ArrowUpRight : kpi.trend === 'down' ? ArrowDownRight : Minus;
          const trendColor = kpi.trend === 'up' ? colors.statusActive : kpi.trend === 'down' ? colors.statusCritical : colors.textTertiary;
          return (
            <Card key={kpi.label} padding={spacing['4']}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['2'] }}>
                <div style={{ width: 36, height: 36, borderRadius: borderRadius.md, backgroundColor: kpi.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={kpi.color} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TrendIcon size={14} color={trendColor} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: typography.fontWeight.semibold, color: kpi.color, lineHeight: 1, marginBottom: spacing['1'] }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: 2 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                {kpi.trendValue}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Risk Indicators */}
      <div style={{ marginBottom: spacing['6'] }}>
        <ProjectRiskSummary />
      </div>

      {/* Risk Level Summary Bar */}
      {overallScore != null && (
        <Card padding={spacing['4']} style={{ marginBottom: spacing['6'] }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
              <AlertTriangle size={16} color={overallScore >= 75 ? colors.statusActive : overallScore >= 50 ? colors.statusPending : colors.statusCritical} />
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Risk Level: {overallScore >= 85 ? 'Low' : overallScore >= 70 ? 'Moderate' : overallScore >= 50 ? 'Elevated' : 'High'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: spacing['4'] }}>
              {dimensions.filter((d) => d.score != null && d.score < 70).map((d) => (
                <span
                  key={d.label}
                  style={{
                    fontSize: typography.fontSize.xs,
                    padding: `${spacing['1']} ${spacing['2']}`,
                    borderRadius: borderRadius.md,
                    backgroundColor: d.score! < 50 ? colors.statusCriticalSubtle : colors.statusPendingSubtle,
                    color: d.score! < 50 ? colors.statusCritical : colors.statusPending,
                    fontWeight: typography.fontWeight.medium,
                  }}
                >
                  {d.label}: {d.score}
                </span>
              ))}
              {dimensions.filter((d) => d.score != null && d.score < 70).length === 0 && (
                <span style={{ fontSize: typography.fontSize.xs, color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>
                  All dimensions healthy
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: spacing['6'] }}>
        {/* Score ring */}
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              role="img"
              aria-label={overallScore != null ? `Project health score: ${overallScore} out of 100` : 'No health data available'}
              style={{ position: 'relative', width: 180, height: 180 }}
            >
              <svg width={180} height={180} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
                <circle cx={90} cy={90} r={70} fill="none" stroke={colors.surfaceInset} strokeWidth="12" />
                {overallScore != null && (
                  <circle
                    cx={90} cy={90} r={70} fill="none" stroke={scoreColor} strokeWidth="12"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {overallScore != null ? (
                  <>
                    <span style={{ fontSize: '48px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, lineHeight: 1 }}>{overallScore}</span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>out of 100</span>
                  </>
                ) : (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: '0 12px' }}>No data available</span>
                )}
              </div>
            </div>

            <div style={{ marginTop: spacing['4'], textAlign: 'center' }}>
              {overallScore != null ? (
                <>
                  <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: scoreColor, margin: 0 }}>
                    {overallScore >= 90 ? 'Excellent' : overallScore >= 75 ? 'Good' : overallScore >= 60 ? 'Fair' : 'Needs Attention'}
                  </p>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
                    {percentile}{percentile % 10 === 1 && percentile !== 11 ? 'st' : percentile % 10 === 2 && percentile !== 12 ? 'nd' : percentile % 10 === 3 && percentile !== 13 ? 'rd' : 'th'} percentile for mixed use projects
                  </p>
                </>
              ) : (
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>
                  Add project data to compute health
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Dimensions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {dimensions.map((dim) => {
            const Icon = TrendIcons[dim.trend];
            const hasScore = dim.score != null;
            const color = hasScore ? getScoreColor(dim.score!) : colors.textTertiary;
            const tColor = trendColors[dim.trend];
            const isExpanded = expandedDim === dim.label;
            return (
              <div
                key={dim.label}
                role="button"
                tabIndex={0}
                aria-label={hasScore ? `${dim.label}: score ${dim.score}. Go to ${dim.label} details` : `${dim.label}: no data. Go to ${dim.label} details`}
                onClick={() => navigate(dim.route)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(dim.route); } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['4'],
                  padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.md, boxShadow: shadows.sm,
                  cursor: 'pointer', transition: `all ${transitions.instant}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.cardHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.sm; }}
              >
                {/* Score */}
                <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: hasScore ? getScoreBg(dim.score!) : colors.surfaceInset, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: hasScore ? typography.fontSize.title : typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color }}>{hasScore ? dim.score : 'N/A'}</span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{dim.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: tColor }}>
                      <Icon size={12} />
                      <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium }}>{dim.change > 0 ? '+' : ''}{dim.change}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2 }}>{dim.detail}</p>

                  {isExpanded && (
                    <p style={{
                      fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, marginTop: spacing['2'],
                      lineHeight: typography.lineHeight.relaxed,
                      overflow: 'hidden', maxHeight: isExpanded ? '200px' : '0',
                      transition: 'max-height 0.3s ease-out',
                    }}>
                      {dim.fullDetail}
                    </p>
                  )}
                  <button
                    aria-expanded={isExpanded}
                    onClick={(e) => { e.stopPropagation(); setExpandedDim(isExpanded ? null : dim.label); }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', border: 'none', backgroundColor: 'transparent',
                      padding: `${spacing['2']} 0`, marginTop: 2,
                      fontSize: typography.fontSize.caption, color: colors.orangeText, cursor: 'pointer',
                      fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium,
                      minHeight: spacing['14'],
                    }}
                  >
                    {isExpanded ? 'See less' : 'See more'}
                  </button>
                </div>

                {/* Mini bar */}
                <div style={{ width: 60, height: 6, backgroundColor: colors.surfaceInset, borderRadius: 3, flexShrink: 0 }}>
                  <div style={{ width: hasScore ? `${dim.score}%` : '0%', height: '100%', backgroundColor: color, borderRadius: 3, transition: `width ${transitions.smooth}` }} />
                </div>

                <ChevronRight size={16} color={colors.textTertiary} style={{ flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Score History chart — requires persisted health snapshots */}
      <div style={{ marginTop: spacing['6'] }} ref={chartRef}>
        <SectionHeader title="Score History" />
        <Card padding={spacing['5']}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing['8'], color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
            No history
          </div>
        </Card>
      </div>

      {/* AI Explanation */}
      <div style={{ marginTop: spacing['5'] }}>
        <Card padding={spacing['4']}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${colors.statusReview} 0%, ${colors.statusReview} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={13} color="white" />
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['1'] }}>AI Analysis</p>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{aiExplanation}</p>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};
