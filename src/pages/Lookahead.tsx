import React, { useState, useCallback, useMemo } from 'react';
import { AlertTriangle, Calendar, Printer, RefreshCw, Share2, Sparkles } from 'lucide-react';
import { PageContainer, Card, Btn, Skeleton, EmptyState, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { LookaheadBoard } from '../components/schedule/LookaheadBoard';
import type { LookaheadTask } from '../components/schedule/LookaheadBoard';
import { useCrews, useLookaheadTasks } from '../hooks/queries';
import { useProjectId } from '../hooks/useProjectId';
import { getWeatherForecast } from '../lib/weather';
import type { WeatherDay } from '../lib/weather';

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

export const Lookahead: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const [weekView, setWeekView] = useState<1 | 2 | 3>(3);
  const days = generateDays(3);

  // Fetch crews from API
  const { data: crewData = [], isLoading: crewsLoading } = useCrews(projectId);

  // Fetch lookahead tasks from API
  const { data: lookaheadTasks = [], isLoading: tasksLoading, error: tasksError, refetch } = useLookaheadTasks(projectId);

  // State for creating new task
  const [isCreating, setIsCreating] = useState(false);
  const [weatherForecast, setWeatherForecast] = useState<WeatherDay[]>([]);

  React.useEffect(() => {
    if (!projectId) return;
    getWeatherForecast(projectId, 21)
      .then(setWeatherForecast)
      .catch(() => setWeatherForecast([]));
  }, [projectId]);

  // Map crew data to name strings for the board
  const crews = useMemo(() => crewData.map((c: any) => c.name as string), [crewData]);

  // Map API tasks to LookaheadTask shape for the board
  const boardStartDate = useMemo(() => {
    const start = new Date();
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 2 : -(dayOfWeek - 1);
    start.setDate(start.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  const mappedTasks: LookaheadTask[] = useMemo(() => {
    return lookaheadTasks.map((t: any, idx: number) => {
      const taskStart = t.start_date ? new Date(t.start_date) : new Date();
      const taskEnd = t.end_date ? new Date(t.end_date) : taskStart;
      const diffMs = taskStart.getTime() - boardStartDate.getTime();
      const dayIndex = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      const durationMs = taskEnd.getTime() - taskStart.getTime();
      const duration = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1);

      const crewName = t.crew?.name || t.trade || 'Unassigned';
      const crewIndex = crews.indexOf(crewName);

      const constraints: LookaheadTask['constraints'] = [];
      if (t.material_delivery_required) constraints.push({ type: 'material', label: 'Material delivery required', resolved: false });
      if (t.inspection_required) constraints.push({ type: 'inspection', label: 'Inspection required', resolved: false });
      if (t.constraint_notes) constraints.push({ type: 'predecessor', label: t.constraint_notes, resolved: false });

      let readiness: LookaheadTask['readiness'] = 'ready';
      if (constraints.length > 0 && constraints.some(c => !c.resolved)) {
        readiness = constraints.every(c => !c.resolved) && constraints.length > 1 ? 'blocked' : 'constrained';
      }

      return {
        id: idx + 1,
        title: t.title,
        crew: crewName,
        crewId: crewIndex >= 0 ? crewIndex + 1 : idx + 1,
        dayIndex,
        duration,
        readiness,
        constraints,
        progress: t.percent_complete ?? 0,
        work_type: t.work_type as string | undefined,
        location: t.location as string | undefined,
      };
    });
  }, [lookaheadTasks, crews, boardStartDate]);

  const [tasks, setTasks] = useState<LookaheadTask[]>([]);

  // Sync mapped tasks from API into local state for drag/drop
  React.useEffect(() => {
    if (mappedTasks.length > 0) {
      setTasks(mappedTasks);
    }
  }, [mappedTasks]);

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

  if (crewsLoading || tasksLoading) {
    return (
      <PageContainer title="Lookahead" subtitle="Loading schedule...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height="40px" />
          ))}
        </div>
      </PageContainer>
    );
  }

  if (tasksError) {
    return (
      <PageContainer title="Lookahead" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Failed to load lookahead</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{(tasksError as Error).message || 'Unable to fetch schedule data'}</p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Try Again</Btn>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (!lookaheadTasks.length) {
    return (
      <PageContainer title="Lookahead" subtitle="No tasks in view">
        <EmptyState
          icon={<Calendar size={40} color={colors.textTertiary} />}
          title="No tasks planned"
          description="Start planning by creating the first lookahead task or importing from your schedule."
          action={<Btn variant="primary" size="sm" onClick={() => setIsCreating(true)}>Create Task</Btn>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Lookahead"
      subtitle={`${weekView} week view · ${readyCount} ready, ${constrainedCount} constrained, ${blockedCount} blocked`}
      actions={
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <div role="group" aria-label="Week view" style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
            {([1, 2, 3] as const).map((w) => (
              <button
                key={w}
                aria-pressed={weekView === w}
                aria-label={`${w} week view`}
                onClick={() => setWeekView(w)}
                style={{
                  padding: `0 ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                  minHeight: '36px',
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
          weatherForecast={weatherForecast}
          onTaskMove={handleTaskMove}
          onConstraintToggle={handleConstraintToggle}
        />
      </Card>
    </PageContainer>
  );
};
