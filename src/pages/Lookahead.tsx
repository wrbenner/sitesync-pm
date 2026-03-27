import React, { useState, useCallback } from 'react';
import { Printer, Share2, Sparkles } from 'lucide-react';
import { PageContainer, Card, Btn, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { LookaheadBoard } from '../components/schedule/LookaheadBoard';
import type { LookaheadTask } from '../components/schedule/LookaheadBoard';

const generateDays = (weeks: number): string[] => {
  const days: string[] = [];
  const start = new Date();
  // Start from Monday
  const dayOfWeek = start.getDay();
  const mondayOffset = dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 2 : -(dayOfWeek - 1);
  start.setDate(start.getDate() + mondayOffset);

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 5; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      days.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    }
  }
  return days;
};

const crews = ['Steel Crew A', 'MEP Crew B', 'Electrical Crew C', 'Exterior Crew D', 'Framing Crew E', 'Finishing Crew F'];

const initialTasks: LookaheadTask[] = [
  { id: 1, title: 'Floor 7 steel erection', crew: 'Steel Crew A', crewId: 1, dayIndex: 0, duration: 3, readiness: 'ready', constraints: [{ type: 'material', label: 'Steel delivered', resolved: true }], progress: 67 },
  { id: 2, title: 'Floor 8 steel layout', crew: 'Steel Crew A', crewId: 1, dayIndex: 3, duration: 2, readiness: 'constrained', constraints: [{ type: 'predecessor', label: 'Floor 7 complete', resolved: false }], progress: 0 },
  { id: 3, title: 'HVAC rough in F4 F5', crew: 'MEP Crew B', crewId: 2, dayIndex: 0, duration: 4, readiness: 'ready', constraints: [{ type: 'inspection', label: 'Pre rough in inspect', resolved: true }], progress: 40 },
  { id: 4, title: 'Ductwork F6', crew: 'MEP Crew B', crewId: 2, dayIndex: 5, duration: 3, readiness: 'constrained', constraints: [{ type: 'material', label: 'Duct sections', resolved: false }, { type: 'predecessor', label: 'F5 rough in', resolved: false }], progress: 0 },
  { id: 5, title: 'Conduit run F1 F2', crew: 'Electrical Crew C', crewId: 3, dayIndex: 0, duration: 3, readiness: 'ready', constraints: [], progress: 60 },
  { id: 6, title: 'Panel install F1', crew: 'Electrical Crew C', crewId: 3, dayIndex: 3, duration: 2, readiness: 'blocked', constraints: [{ type: 'material', label: 'Panels on site', resolved: false }, { type: 'inspection', label: 'Rough in inspect', resolved: false }], progress: 0 },
  { id: 7, title: 'Curtain wall south', crew: 'Exterior Crew D', crewId: 4, dayIndex: 0, duration: 5, readiness: 'constrained', constraints: [{ type: 'predecessor', label: 'RFI-004 resolved', resolved: false }], progress: 55 },
  { id: 8, title: 'Curtain wall east', crew: 'Exterior Crew D', crewId: 4, dayIndex: 5, duration: 5, readiness: 'blocked', constraints: [{ type: 'predecessor', label: 'South face done', resolved: false }, { type: 'equipment', label: 'Crane available', resolved: false }], progress: 0 },
  { id: 9, title: 'Interior framing F8', crew: 'Framing Crew E', crewId: 5, dayIndex: 0, duration: 4, readiness: 'ready', constraints: [{ type: 'material', label: 'Studs delivered', resolved: true }], progress: 25 },
  { id: 10, title: 'Interior framing F9', crew: 'Framing Crew E', crewId: 5, dayIndex: 5, duration: 4, readiness: 'constrained', constraints: [{ type: 'predecessor', label: 'F8 complete', resolved: false }], progress: 0 },
  { id: 11, title: 'Drywall lower levels', crew: 'Finishing Crew F', crewId: 6, dayIndex: 1, duration: 4, readiness: 'ready', constraints: [{ type: 'inspection', label: 'Framing inspect', resolved: true }], progress: 10 },
  { id: 12, title: 'Paint prep L1 L2', crew: 'Finishing Crew F', crewId: 6, dayIndex: 6, duration: 3, readiness: 'constrained', constraints: [{ type: 'predecessor', label: 'Drywall finish', resolved: false }], progress: 0 },
];

export const Lookahead: React.FC = () => {
  const { addToast } = useToast();
  const [weekView, setWeekView] = useState<1 | 2 | 3>(3);
  const [tasks, setTasks] = useState(initialTasks);
  const days = generateDays(3);

  const handleTaskMove = useCallback((taskId: number, newDayIndex: number, newCrew: string) => {
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, dayIndex: newDayIndex, crew: newCrew } : t
    ));
    addToast('success', 'Task moved');
  }, [addToast]);

  const handleConstraintToggle = useCallback((taskId: number, constraintIndex: number) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const newConstraints = t.constraints.map((c, i) =>
        i === constraintIndex ? { ...c, resolved: !c.resolved } : c
      );
      const allResolved = newConstraints.every((c) => c.resolved);
      const anyBlocked = newConstraints.some((c) => !c.resolved);
      return {
        ...t,
        constraints: newConstraints,
        readiness: allResolved ? 'ready' as const : anyBlocked ? 'constrained' as const : 'ready' as const,
      };
    }));
    addToast('info', 'Constraint updated');
  }, [addToast]);

  const readyCount = tasks.filter((t) => t.readiness === 'ready').length;
  const constrainedCount = tasks.filter((t) => t.readiness === 'constrained').length;
  const blockedCount = tasks.filter((t) => t.readiness === 'blocked').length;

  return (
    <PageContainer
      title="Lookahead"
      subtitle={`${weekView} week view · ${readyCount} ready, ${constrainedCount} constrained, ${blockedCount} blocked`}
      actions={
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
            {([1, 2, 3] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWeekView(w)}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                  backgroundColor: weekView === w ? colors.surfaceRaised : 'transparent',
                  color: weekView === w ? colors.textPrimary : colors.textTertiary,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                  boxShadow: weekView === w ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {w}W
              </button>
            ))}
          </div>
          <Btn variant="secondary" size="sm" icon={<Printer size={14} />} onClick={() => addToast('info', 'Preparing print layout...')}>Print</Btn>
          <Btn variant="secondary" size="sm" icon={<Share2 size={14} />} onClick={() => addToast('success', 'Lookahead sent to field team')}>Send to Foreman</Btn>
        </div>
      }
    >
      {/* AI Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.normal }}>2 tasks have unresolved material constraints that may delay next week. Recommend confirming delivery schedules for duct sections and electrical panels today.</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3'], marginBottom: spacing['5'] }}>
        {[
          { label: 'Ready to Go', count: readyCount, color: colors.statusActive },
          { label: 'Has Constraints', count: constrainedCount, color: colors.statusPending },
          { label: 'Blocked', count: blockedCount, color: colors.statusCritical },
        ].map((s) => (
          <div key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: `${s.color}06`,
            borderRadius: borderRadius.md, border: `1px solid ${s.color}15`,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s.color }} />
            <div>
              <span style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{s.count}</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['2'] }}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Board */}
      <Card padding={spacing['3']}>
        <LookaheadBoard
          tasks={tasks}
          days={days}
          crews={crews}
          weekView={weekView}
          onTaskMove={handleTaskMove}
          onConstraintToggle={handleConstraintToggle}
        />
      </Card>
    </PageContainer>
  );
};
