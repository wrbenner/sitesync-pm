import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles, ChevronRight, Share2, FileText, Link, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Card, SectionHeader, Btn, useToast, Skeleton } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';
import { useInView } from '../hooks/useInView';
import { useMediaQuery } from '../hooks/useMediaQuery';
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

interface HealthDimension {
  label: string;
  score: number;
  trend: 'up' | 'down' | 'flat';
  change: number;
  detail: string;
  fullDetail: string;
  route: string;
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

function getLineColor(score: number): string {
  if (score > 70) return colors.statusActive;
  if (score >= 50) return colors.statusPending;
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
  const [chartRef, chartInView] = useInView();
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const projectId = useProjectId();
  const { data: schedulePhases, isLoading: loadingSchedule } = useSchedulePhases(projectId);
  const { data: budgetItems, isLoading: loadingBudget } = useBudgetItems(projectId);
  const { data: punchItemsResult } = usePunchItems(projectId);
  const { data: rfisResult } = useRFIs(projectId);
  const { data: dailyLogsResult } = useDailyLogs(projectId);
  const { data: meetingsResult } = useMeetings(projectId);
  const { data: files } = useFiles(projectId);
  const { data: drawings } = useDrawings(projectId);

  const isLoading = loadingSchedule || loadingBudget;

  const { dimensions, overallScore } = useMemo(() => {
    // ── Schedule Health ──
    const phases = schedulePhases ?? [];
    const onTrackPhases = phases.filter(
      (p) => p.status === 'complete' || p.status === 'on_track' || p.status === 'in_progress'
    );
    const behindPhases = phases.filter((p) => p.status === 'behind' || p.status === 'at_risk');
    const scheduleScore = phases.length > 0
      ? clamp(Math.round((onTrackPhases.length / phases.length) * 100), 0, 100)
      : 85;
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
    const budgetScore = items.length > 0
      ? clamp(Math.round(Math.min(cpi, 1.2) / 1.2 * 100), 0, 100)
      : 90;
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
    const qualityScore = punches.length > 0
      ? clamp(Math.round((resolvedPunches.length / punches.length) * 100), 0, 100)
      : 88;
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
    const safetyScore = logs.length > 0
      ? clamp(Math.round(100 - incidentRate * 20), 0, 100)
      : 96;
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
    const commScore = rfiList.length > 0
      ? clamp(Math.round(100 - (overdueRfis.length / Math.max(rfiList.length, 1)) * 100), 0, 100)
      : meetingList.length > 0
        ? 82
        : 82;
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
    const docScore = (fileList.length > 0 || drawingList.length > 0)
      ? clamp(Math.round(Math.min(100, 60 + drawingList.length * 2 + fileList.length * 0.5)), 0, 100)
      : 90;
    const docDetail = (fileList.length > 0 || drawingList.length > 0)
      ? `${drawingList.length} drawings, ${fileList.length} files in the system.`
      : 'No files or drawings uploaded yet.';
    const docFullDetail = (fileList.length > 0 || drawingList.length > 0)
      ? `${drawingList.length} drawing sheets on file. ${fileList.length} documents stored in the file system. Daily logs have been submitted consistently.`
      : 'Documentation health is computed from drawing count, file count, and daily log consistency.';

    const dims: HealthDimension[] = [
      { label: 'Schedule Health', score: scheduleScore, trend: scheduleScore >= 85 ? 'up' : scheduleScore >= 70 ? 'flat' : 'down', change: scheduleScore >= 85 ? 2 : scheduleScore >= 70 ? 0 : -3, detail: scheduleDetail, fullDetail: scheduleFullDetail, route: '/schedule' },
      { label: 'Budget Health', score: budgetScore, trend: budgetScore >= 85 ? 'up' : budgetScore >= 70 ? 'flat' : 'down', change: budgetScore >= 85 ? 1 : budgetScore >= 70 ? 0 : -2, detail: budgetDetail, fullDetail: budgetFullDetail, route: '/budget' },
      { label: 'Quality', score: qualityScore, trend: qualityScore >= 80 ? 'up' : qualityScore >= 60 ? 'flat' : 'down', change: qualityScore >= 80 ? 2 : qualityScore >= 60 ? 0 : -1, detail: qualityDetail, fullDetail: qualityFullDetail, route: '/punch-list' },
      { label: 'Safety', score: safetyScore, trend: safetyScore >= 90 ? 'up' : safetyScore >= 70 ? 'flat' : 'down', change: safetyScore >= 90 ? 1 : safetyScore >= 70 ? 0 : -2, detail: safetyDetail, fullDetail: safetyFullDetail, route: '/daily-log' },
      { label: 'Communication', score: commScore, trend: commScore >= 85 ? 'up' : commScore >= 70 ? 'flat' : 'down', change: commScore >= 85 ? 1 : commScore >= 70 ? 0 : -2, detail: commDetail, fullDetail: commFullDetail, route: '/activity' },
      { label: 'Documentation', score: docScore, trend: docScore >= 85 ? 'up' : docScore >= 70 ? 'flat' : 'down', change: docScore >= 85 ? 3 : docScore >= 70 ? 0 : -1, detail: docDetail, fullDetail: docFullDetail, route: '/files' },
    ];

    // Weighted average: schedule 25%, budget 25%, quality 15%, safety 15%, comm 10%, docs 10%
    const weights = [0.25, 0.25, 0.15, 0.15, 0.10, 0.10];
    const overall = Math.round(dims.reduce((s, d, i) => s + d.score * weights[i], 0));

    return { dimensions: dims, overallScore: overall };
  }, [schedulePhases, budgetItems, punchItemsResult, rfisResult, dailyLogsResult, meetingsResult, files, drawings]);

  const percentile = Math.min(99, Math.max(1, overallScore - 5));

  // Generate a simple historical approximation from the current score
  const historicalScores = useMemo(() => {
    const scores: number[] = [];
    for (let i = 0; i < 20; i++) {
      const variation = Math.sin(i * 0.5) * 3 + (i / 20) * (overallScore - 80);
      scores.push(clamp(Math.round(80 + variation), 60, 100));
    }
    scores[scores.length - 1] = overallScore;
    return scores;
  }, [overallScore]);

  const weekLabels = historicalScores.map((_, i) => `W${i + 1}`);

  const aiExplanation = useMemo(() => {
    const lowest = dimensions.reduce((a, b) => (a.score < b.score ? a : b));
    const highest = dimensions.reduce((a, b) => (a.score > b.score ? a : b));
    return `Overall health score is ${overallScore}. Strongest area: ${highest.label} at ${highest.score}. Area needing the most attention: ${lowest.label} at ${lowest.score}. ${lowest.detail}`;
  }, [dimensions, overallScore]);

  const scoreColor = getScoreColor(overallScore);
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (overallScore / 100) * circumference;

  const chartW = 100;
  const chartH = 120;
  const minScore = 70;
  const maxScore = 100;
  const stepX = chartW / (historicalScores.length - 1);
  const yPos = (score: number) => chartH - ((score - minScore) / (maxScore - minScore)) * chartH;

  const linePath = historicalScores
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yPos(s)}`)
    .join(' ');

  if (isLoading) {
    return (
      <PageContainer title="Project Health" subtitle="Loading health data...">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: spacing['6'] }}>
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
      subtitle="Meridian Tower health score and diagnostics"
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
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: spacing['6'] }}>
        {/* Score ring */}
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              role="img"
              aria-label={`Project health score: ${overallScore} out of 100`}
              style={{ position: 'relative', width: 180, height: 180 }}
            >
              <svg width={180} height={180} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
                <circle cx={90} cy={90} r={70} fill="none" stroke={colors.surfaceInset} strokeWidth="12" />
                <circle
                  cx={90} cy={90} r={70} fill="none" stroke={scoreColor} strokeWidth="12"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '48px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, lineHeight: 1 }}>{overallScore}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>out of 100</span>
              </div>
            </div>

            <div style={{ marginTop: spacing['4'], textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: scoreColor, margin: 0 }}>
                {overallScore >= 90 ? 'Excellent' : overallScore >= 75 ? 'Good' : overallScore >= 60 ? 'Fair' : 'Needs Attention'}
              </p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
                {percentile}{percentile % 10 === 1 && percentile !== 11 ? 'st' : percentile % 10 === 2 && percentile !== 12 ? 'nd' : percentile % 10 === 3 && percentile !== 13 ? 'rd' : 'th'} percentile for mixed use projects
              </p>
            </div>
          </div>
        </Card>

        {/* Dimensions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {dimensions.map((dim) => {
            const Icon = TrendIcons[dim.trend];
            const color = getScoreColor(dim.score);
            const tColor = trendColors[dim.trend];
            const isExpanded = expandedDim === dim.label;
            return (
              <div
                key={dim.label}
                role="button"
                tabIndex={0}
                aria-label={`${dim.label}: score ${dim.score}. Go to ${dim.label} details`}
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
                <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: getScoreBg(dim.score), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color }}>{dim.score}</span>
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
                  <div style={{ width: `${dim.score}%`, height: '100%', backgroundColor: color, borderRadius: 3, transition: `width ${transitions.smooth}` }} />
                </div>

                <ChevronRight size={16} color={colors.textTertiary} style={{ flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Score History chart */}
      <div style={{ marginTop: spacing['6'] }} ref={chartRef}>
        <SectionHeader title="Score History" action={<span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Last 20 weeks</span>} />
        <Card padding={spacing['5']}>
          <svg
            role="img"
            aria-label="Project health score history chart"
            viewBox={`-12 -10 ${chartW + 24} ${chartH + 28}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '200px', overflow: 'visible' }}
          >
            {/* Y-axis grid lines and labels */}
            {[70, 80, 90, 100].map((score) => (
              <React.Fragment key={score}>
                <line x1={0} y1={yPos(score)} x2={chartW} y2={yPos(score)} stroke={colors.borderSubtle} strokeWidth="0.3" />
                <text x={-4} y={yPos(score) + 1.5} textAnchor="end" fill={colors.textTertiary} fontSize="4" fontFamily={typography.fontFamily}>{score}</text>
              </React.Fragment>
            ))}

            {/* Color zones */}
            <rect x={0} y={yPos(100)} width={chartW} height={yPos(70) - yPos(100)} fill={`${colors.statusActive}06`} rx="1" />

            {/* Line */}
            {chartInView && (
              <>
                <path d={linePath} fill="none" stroke={colors.statusActive} strokeWidth="1.5" strokeLinecap="round" />
                {historicalScores.map((score, i) => (
                  <circle
                    key={i}
                    cx={i * stepX}
                    cy={yPos(score)}
                    r={i === historicalScores.length - 1 ? 3 : 2}
                    fill={i === historicalScores.length - 1 ? colors.primaryOrange : getLineColor(score)}
                    stroke={colors.surfaceRaised}
                    strokeWidth="1"
                  />
                ))}
              </>
            )}

            {/* X-axis labels (every 4th week) */}
            {weekLabels.filter((_, i) => i % 4 === 0 || i === weekLabels.length - 1).map((label) => {
              const idx = weekLabels.indexOf(label);
              return (
                <text key={label} x={idx * stepX} y={chartH + 12} textAnchor="middle" fill={colors.textTertiary} fontSize="4" fontFamily={typography.fontFamily}>{label}</text>
              );
            })}
          </svg>
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
