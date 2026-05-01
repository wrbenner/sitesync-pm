/**
 * The Site — "What is the state of the project?"
 *
 * Shape: Place — a map you can explore.
 * This is the big-picture health dashboard. It pulls together signals
 * from every domain to give one answer.
 *
 * Calm and comprehensive, not overwhelming. The god view.
 */

import React, { useEffect, useMemo } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PageState } from '../../components/shared/PageState';
import { useCopilotStore } from '../../stores/copilotStore';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject, useRFIs, useSubmittals, usePunchItems, useIncidents, useWorkforceMembers, useCrews } from '../../hooks/queries';
import { useProjectMetrics } from '../../hooks/useProjectMetrics';
import { useScheduleActivities } from '../../hooks/useScheduleActivities';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIsMobile } from '../../hooks/useWindowSize';
import { colors, typography, transitions } from '../../styles/theme';
import {
  OrangeDot,
  Eyebrow,
} from '../../components/atoms';
import {
  WifiOff,
  ChevronRight,
  Calendar,
  DollarSign,
  HelpCircle,
  CheckSquare,
  Shield,
  FileText,
  Users,
  Layers,
  Archive,
  Sun,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// ── Currency formatter ────────────────────────────────────────

function formatCurrency(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Health score color ────────────────────────────────────────

function healthScoreColor(score: number): string {
  if (score >= 70) return colors.statusActive;
  if (score >= 40) return colors.statusPending;
  return colors.statusCritical;
}

// ── The Site Page ─────────────────────────────────────────────

const SitePage: React.FC = () => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const { setPageContext } = useCopilotStore();
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();

  useEffect(() => { setPageContext('site'); }, [setPageContext]);

  // ── Data ──────────────────────────────────────────────────
  const { data: metrics, isPending: metricsLoading } = useProjectMetrics(projectId);
  const { data: rfiData, isPending: rfisLoading } = useRFIs(projectId);
  const { data: submittalData, isPending: submittalsLoading } = useSubmittals(projectId);
  const { data: punchData, isPending: punchLoading } = usePunchItems(projectId);
  const { data: incidentData } = useIncidents(projectId);
  const { data: workforceData } = useWorkforceMembers(projectId);
  const { data: crewData } = useCrews(projectId);
  const { isLoading: scheduleLoading } = useScheduleActivities(projectId ?? '');

  const isLoading = rfisLoading || submittalsLoading || punchLoading;

  // ── Actual data arrays ─────────────────────────────────
  const rfis = useMemo(() => (rfiData?.data ?? []) as Record<string, unknown>[], [rfiData]);
  const submittalsList = useMemo(() => (submittalData?.data ?? []) as Record<string, unknown>[], [submittalData]);
  const punchItems = useMemo(() => (punchData?.data ?? []) as Record<string, unknown>[], [punchData]);
  const incidentsList = useMemo(() => (incidentData ?? []) as Record<string, unknown>[], [incidentData]);
  const workforceMembers = useMemo(() => (workforceData ?? []) as Record<string, unknown>[], [workforceData]);
  const crews = useMemo(() => (crewData ?? []) as Array<{ id: string; status?: string }>, [crewData]);

  // No project selected
  if (!projectId) return <ProjectGate />;

  // ── Derived counts from actual data ────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const monthStr = todayStr.slice(0, 7);

  const openRfis = rfis.filter((r) => {
    const s = ((r.status as string) ?? '').toLowerCase();
    return s !== 'closed' && s !== 'answered';
  });
  const overdueRfis = openRfis.filter((r) => {
    const due = (r.due_date as string) ?? (r.dueDate as string) ?? '';
    return due && due.split('T')[0] < todayStr;
  });

  const pendingSubmittals = submittalsList.filter((s) => {
    const st = ((s.status as string) ?? '').toLowerCase();
    return st === 'pending_review' || st === 'in_review' || st === 'submitted' || st === 'draft';
  });
  const approvedSubmittals = submittalsList.filter((s) => ((s.status as string) ?? '').toLowerCase() === 'approved');

  const openPunchItems = punchItems.filter((p) => {
    const s = ((p.status as string) ?? (p.verification_status as string) ?? '').toLowerCase();
    return s !== 'verified' && s !== 'closed' && s !== 'completed';
  });

  const safetyIncidentCount = incidentsList.filter((i) => {
    const d = (i.date as string) ?? (i.created_at as string) ?? '';
    return d.startsWith(monthStr);
  }).length;

  const activeCrews = crews.filter((c) => (c.status ?? '').toLowerCase() === 'active');

  // Health score (from metrics if available, otherwise null)
  const aiScore = metrics?.aiHealthScore ?? null;

  const budgetPct = metrics && metrics.budget_total > 0
    ? Math.round((metrics.budget_spent / metrics.budget_total) * 100)
    : null;
  const budgetRemaining = metrics && metrics.budget_total > 0
    ? metrics.budget_total - metrics.budget_spent
    : null;

  const submittalApprovalRate = submittalsList.length > 0
    ? Math.round((approvedSubmittals.length / submittalsList.length) * 100)
    : null;

  // Status colors
  const scheduleVariance = metrics?.schedule_variance_days ?? 0;
  const scheduleStatusColor =
    scheduleVariance <= -5 ? colors.statusCritical
    : scheduleVariance < 0 ? colors.statusPending
    : colors.statusActive;

  const budgetStatusColor =
    budgetPct != null && budgetPct > 95 ? colors.statusCritical
    : budgetPct != null && budgetPct > 90 ? colors.statusPending
    : colors.statusActive;

  const safetyStatusColor =
    safetyIncidentCount === 0 ? colors.statusActive
    : safetyIncidentCount <= 2 ? colors.statusPending
    : colors.statusCritical;

  const punchStatusColor =
    openPunchItems.length > 10 ? colors.statusPending
    : colors.statusActive;

  const rfiStatusColor =
    overdueRfis.length > 0 ? colors.statusCritical
    : colors.statusActive;

  const submittalStatusColor =
    pendingSubmittals.length > 5 ? colors.statusPending
    : colors.statusActive;

  return (
    <ErrorBoundary>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          backgroundColor: colors.parchment,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            padding: isMobile ? '16px 16px 0' : '36px 36px 0',
          }}
        >
          {/* ── Compact Header ──────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: typography.fontFamilySerif, fontSize: isMobile ? '20px' : '24px', color: colors.ink, lineHeight: 1.2 }}>
                The Site
              </span>
              <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
                {project?.name ?? 'Project'}
              </span>
            </div>
            <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
              {!isOnline ? 'Offline' : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {isLoading ? (
            <PageState status="loading" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
              {/* Score + progress inline */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{
                  fontFamily: typography.fontFamilySerif,
                  fontSize: isMobile ? '56px' : '72px',
                  fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em',
                  color: aiScore != null ? healthScoreColor(aiScore) : colors.ink4,
                }}>
                  {aiScore != null ? aiScore : '—'}
                </span>
                <span style={{ fontFamily: typography.fontFamily, fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.16em', color: colors.ink3 }}>
                  / 100
                </span>
              </div>
              {metrics?.overall_progress != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12 }}>
                  <div style={{ width: isMobile ? 100 : 160, height: 4, backgroundColor: 'var(--hairline-2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, metrics.overall_progress)}%`, height: '100%', backgroundColor: colors.primaryOrange, borderRadius: 2, transition: transitions.quick }} />
                  </div>
                  <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', fontWeight: 500, color: colors.ink2 }}>
                    {Math.round(metrics.overall_progress)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Domain Health Cards ──────────────────── */}

          {isLoading ? (
            <PageState status="loading" />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap: 16,
                marginBottom: 40,
              }}
            >
              {/* Schedule */}
              <DomainCard
                href="#/plan"
                icon={Calendar}
                label="Schedule"
                statusColor={scheduleStatusColor}
                metric={metrics?.overall_progress != null ? `${Math.round(metrics.overall_progress)}% complete` : '—'}
                sub={
                  metrics?.schedule_variance_days != null
                    ? `${metrics.schedule_variance_days >= 0 ? '+' : ''}${metrics.schedule_variance_days} days variance`
                    : 'No variance data'
                }
                subColor={scheduleStatusColor}
                subIcon={
                  scheduleVariance < 0
                    ? <TrendingDown size={12} style={{ color: scheduleStatusColor }} />
                    : <TrendingUp size={12} style={{ color: scheduleStatusColor }} />
                }
              />

              {/* Budget */}
              <DomainCard
                href="#/ledger"
                icon={DollarSign}
                label="Budget"
                statusColor={budgetStatusColor}
                metric={budgetPct != null ? `${budgetPct}% spent` : '—'}
                sub={
                  budgetRemaining != null
                    ? `${formatCurrency(budgetRemaining)} remaining`
                    : 'No budget data'
                }
                subColor={budgetStatusColor}
              />

              {/* RFIs */}
              <DomainCard
                href="#/conversation"
                icon={HelpCircle}
                label="RFIs"
                statusColor={rfiStatusColor}
                metric={`${openRfis.length} open`}
                sub={
                  overdueRfis.length > 0
                    ? `${overdueRfis.length} overdue`
                    : 'No overdue RFIs'
                }
                subColor={rfiStatusColor}
                showDot={overdueRfis.length > 0}
              />

              {/* Submittals */}
              <DomainCard
                href="#/conversation"
                icon={FileText}
                label="Submittals"
                statusColor={submittalStatusColor}
                metric={`${pendingSubmittals.length} pending`}
                sub={
                  submittalApprovalRate != null
                    ? `${submittalApprovalRate}% approval rate`
                    : 'No submittal data'
                }
                subColor={submittalStatusColor}
              />

              {/* Punch List */}
              <DomainCard
                href="#/field"
                icon={CheckSquare}
                label="Punch List"
                statusColor={punchStatusColor}
                metric={`${openPunchItems.length} open`}
                sub={`of ${punchItems.length} total items`}
                subColor={punchStatusColor}
              />

              {/* Safety */}
              <DomainCard
                href="#/field"
                icon={Shield}
                label="Safety"
                statusColor={safetyStatusColor}
                metric={`${safetyIncidentCount} incident${safetyIncidentCount !== 1 ? 's' : ''}`}
                sub="this month"
                subColor={safetyStatusColor}
                showDot={safetyIncidentCount > 0}
              />
            </div>
          )}

          {/* ── Workforce Strip ─────────────────────── */}

          <a
            href="#/crew"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 32,
              padding: '20px 24px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--hairline)',
              borderRadius: 10,
              textDecoration: 'none',
              color: 'inherit',
              marginBottom: 40,
              transition: transitions.quick,
              flexWrap: 'wrap',
            }}
          >
            <WorkforceMetric
              icon={Users}
              value={workforceMembers.length}
              label="Workers on site"
            />
            <div
              style={{
                width: 1,
                height: 40,
                backgroundColor: 'var(--hairline)',
                flexShrink: 0,
              }}
            />
            <WorkforceMetric
              icon={Layers}
              value={activeCrews.length}
              label="Crews active"
            />
            <div style={{ flex: 1 }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: typography.fontFamily,
                fontSize: '12px',
                color: colors.ink3,
              }}
            >
              View Crew <ChevronRight size={14} style={{ color: colors.primaryOrange }} />
            </div>
          </a>

          {/* ── The Nine Navigation ──────────── */}
          <Eyebrow style={{ marginBottom: 12, marginTop: 24 }}>The Nine</Eyebrow>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: 12,
              marginBottom: 64,
            }}
          >
            <NineLink
              href="#/day"
              icon={Sun}
              title="The Day"
              question="What do I need to do right now?"
            />
            <NineLink
              href="#/field"
              icon={CheckSquare}
              title="The Field"
              question="What happened on site today?"
            />
            <NineLink
              href="#/conversation"
              icon={HelpCircle}
              title="The Conversation"
              question="What needs a response or decision?"
            />
            <NineLink
              href="#/plan"
              icon={Calendar}
              title="The Plan"
              question="Are we on schedule?"
            />
            <NineLink
              href="#/ledger"
              icon={DollarSign}
              title="The Ledger"
              question="Where does the money stand?"
            />
            <NineLink
              href="#/set"
              icon={Layers}
              title="The Set"
              question="What are the current drawings?"
            />
            <NineLink
              href="#/crew"
              icon={Users}
              title="The Crew"
              question="Who is on this project and what are they doing?"
            />
            <NineLink
              href="#/file"
              icon={Archive}
              title="The File"
              question="Where is the document I need?"
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

// ── Domain Health Card ────────────────────────────────────────

interface DomainCardProps {
  href: string;
  icon: React.ElementType;
  label: string;
  statusColor: string;
  metric: string;
  sub: string;
  subColor: string;
  subIcon?: React.ReactNode;
  showDot?: boolean;
}

const DomainCard: React.FC<DomainCardProps> = ({
  href,
  icon: Icon,
  label,
  statusColor,
  metric,
  sub,
  subColor,
  subIcon,
  showDot = false,
}) => (
  <a
    href={href}
    style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 20px 16px',
      backgroundColor: '#FFFFFF',
      border: '1px solid var(--hairline)',
      borderRadius: 10,
      textDecoration: 'none',
      color: 'inherit',
      transition: transitions.quick,
      gap: 8,
    }}
  >
    {/* Header row */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: statusColor,
            flexShrink: 0,
          }}
        />
        <Eyebrow>{label}</Eyebrow>
      </div>
      <Icon size={14} style={{ color: colors.ink4 }} />
    </div>

    {/* Metric */}
    <div
      style={{
        fontFamily: typography.fontFamilySerif,
        fontSize: '28px',
        fontWeight: 400,
        color: colors.ink,
        lineHeight: 1.1,
      }}
    >
      {metric}
    </div>

    {/* Sub-metric */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {showDot && <OrangeDot size={6} haloSpread={2} label="Needs attention" />}
      {subIcon}
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '12px',
          color: showDot || subIcon ? subColor : colors.ink3,
          fontWeight: showDot ? 500 : 400,
        }}
      >
        {sub}
      </span>
    </div>
  </a>
);

// ── Workforce Metric ──────────────────────────────────────────

const WorkforceMetric: React.FC<{
  icon: React.ElementType;
  value: number;
  label: string;
}> = ({ icon: Icon, value, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <Icon size={20} style={{ color: colors.ink3, flexShrink: 0 }} />
    <div>
      <div
        style={{
          fontFamily: typography.fontFamilySerif,
          fontSize: '32px',
          fontWeight: 400,
          color: colors.ink,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '11px',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          color: colors.ink4,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  </div>
);

// ── Nine Navigation Link ──────────────────────────────────────

const NineLink: React.FC<{
  href: string;
  icon: React.ElementType;
  title: string;
  question: string;
}> = ({ href, icon: Icon, title, question }) => (
  <a
    href={href}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '16px 20px',
      backgroundColor: '#FFFFFF',
      border: '1px solid var(--hairline)',
      borderRadius: 10,
      textDecoration: 'none',
      color: 'inherit',
      transition: transitions.quick,
    }}
  >
    <Icon size={18} style={{ color: colors.ink3, flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '13px',
          fontWeight: 600,
          color: colors.ink,
          marginBottom: 2,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: typography.fontFamilySerif,
          fontSize: '14px',
          fontStyle: 'italic',
          color: colors.ink3,
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {question}
      </div>
    </div>
    <ChevronRight size={14} style={{ color: colors.ink4, flexShrink: 0 }} />
  </a>
);

// ── Export ────────────────────────────────────────────────────

export default SitePage;
