import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { PageContainer, Card, SectionHeader, MetricBox, Skeleton, Btn, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useScheduleStore } from '../stores/scheduleStore';
import { useProjectContext } from '../stores/projectContextStore';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { GanttChart } from '../components/schedule/GanttChart';

export const Schedule: React.FC = () => {
  const { activeProject } = useProjectContext();
  const { phases: schedulePhases, metrics, loading, loadSchedule } = useScheduleStore();

  useEffect(() => {
    if (activeProject?.id) loadSchedule(activeProject.id);
  }, [activeProject?.id]);

  const [whatIfMode, setWhatIfMode] = useState(false);
  const [recoveryExpanded, setRecoveryExpanded] = useState(false);
  const { addToast } = useToast();

  if (loading && schedulePhases.length === 0) {
    return (
      <PageContainer title="Schedule" subtitle="Loading...">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: spacing.lg,
            marginBottom: spacing['2xl'],
          }}
        >
          <Skeleton height="80px" />
          <Skeleton height="80px" />
          <Skeleton height="80px" />
        </div>
        <SectionHeader title="Project Timeline" />
        <Card padding={spacing.xl}>
          <Skeleton height="24px" width="60%" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ marginTop: spacing.md }}>
              <Skeleton height="28px" />
            </div>
          ))}
        </Card>
      </PageContainer>
    );
  }
  const pageAlerts = getPredictiveAlertsForPage('schedule');

  return (
    <PageContainer
      title="Schedule"
      subtitle={`${metrics.daysBeforeSchedule} days ahead \u00B7 ${metrics.milestonesHit}/${metrics.milestoneTotal} milestones`}
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} onAction={() => setRecoveryExpanded(!recoveryExpanded)} />
      ))}

      {recoveryExpanded && (
        <div style={{
          padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'],
          backgroundColor: `${colors.statusPending}06`, borderRadius: borderRadius.md,
          border: `1px solid ${colors.statusPending}15`,
          animation: 'slideInUp 200ms ease-out',
        }}>
          <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusPending, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>Recovery Plan</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {[
              'Authorize MEP overtime on floors 4 through 6 to recover 4 days of schedule float.',
              'Redirect Exterior Crew D to secondary facade sections while RFI 004 is resolved.',
              'Batch Tuesday RFI reviews with MEP consultant to reduce average response time by 40%.',
            ].map((action, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.semibold }}>{i + 1}.</span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>{action}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setRecoveryExpanded(false)} style={{ marginTop: spacing['3'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, color: colors.textTertiary, cursor: 'pointer' }}>
            Collapse
          </button>
        </div>
      )}

      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: spacing.lg,
          marginBottom: spacing['2xl'],
        }}
      >
        <MetricBox label="Days Ahead" value={metrics.daysBeforeSchedule} />
        <MetricBox label="Milestones" value={`${metrics.milestonesHit}/${metrics.milestoneTotal}`} />
        <MetricBox label="AI Confidence" value={metrics.aiConfidenceLevel} unit="%" />
      </div>

      {/* Gantt */}
      <div style={{ marginTop: spacing['5'] }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
          <SectionHeader title="Project Timeline" />
          <Btn
            variant={whatIfMode ? 'primary' : 'secondary'}
            size="sm"
            icon={<Sparkles size={14} />}
            onClick={() => setWhatIfMode(!whatIfMode)}
          >
            {whatIfMode ? 'Exit What If Mode' : 'What If Mode'}
          </Btn>
        </div>
        <div style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          padding: spacing['5'],
          boxShadow: whatIfMode ? `0 0 0 2px ${colors.statusPending}40` : shadows.card,
          transition: `box-shadow ${transitions.quick}`,
        }}>
          {whatIfMode && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
              backgroundColor: `${colors.statusPending}08`, borderRadius: borderRadius.md,
              border: `1px solid ${colors.statusPending}20`,
            }}>
              <Sparkles size={14} color={colors.statusPending} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>
                What If Mode is active. Drag phase bars to simulate schedule changes and see cascade effects.
              </span>
            </div>
          )}
          <GanttChart
            phases={schedulePhases}
            whatIfMode={whatIfMode}
            onPhaseClick={(phase) => addToast('info', `${phase.name}: ${phase.progress}% complete`)}
            baselinePhases={schedulePhases}
          />
        </div>
      </div>
    </PageContainer>
  );
};
