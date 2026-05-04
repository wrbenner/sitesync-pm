import React, { useState, useCallback, useMemo } from 'react';
import { AlertTriangle, Calendar, Plus, Printer, RefreshCw, Share2, X } from 'lucide-react';
import { PageContainer, Card, Btn, Skeleton, EmptyState, useToast } from '../components/Primitives';

import { PageInsightBanners } from '../components/ai/PredictiveAlert';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../styles/theme';
import { LookaheadBoard } from '../components/schedule/LookaheadBoard';
import type { LookaheadTask } from '../components/schedule/LookaheadBoard';
import { useCrews, useLookaheadTasks } from '../hooks/queries';
import { useCreateLookaheadTask } from '../hooks/queries/lookahead-tasks';
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation';
import { useProjectId } from '../hooks/useProjectId';
import { supabase } from '../lib/supabase';
import { fromTable } from '../lib/db/queries'
import { getWeatherForecast } from '../lib/weather';
import type { WeatherDay } from '../lib/weather';
import type { Task, Crew } from '../types/database';

const WORK_TYPES = [
  { value: 'rough-in', label: 'Rough-In' },
  { value: 'finish', label: 'Finish' },
  { value: 'demolition', label: 'Demolition' },
  { value: 'excavation', label: 'Excavation' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'framing', label: 'Framing' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'MEP', label: 'MEP' },
  { value: 'other', label: 'Other' },
] as const;

const inputStyle: React.CSSProperties = {
  padding: spacing['2'],
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  background: colors.surfaceInset,
  color: colors.textPrimary,
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: typography.fontSize.caption,
  fontWeight: typography.fontWeight.semibold,
  color: colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
  display: 'block',
};

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
  const days = useMemo(() => generateDays(weekView), [weekView]);

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

  useRealtimeInvalidation(projectId);

  // Map crew data to name strings for the board
  const crews = useMemo(() => crewData.map((c: Crew) => c.name), [crewData]);

  // Map API tasks to LookaheadTask shape for the board
  const boardStartDate = useMemo(() => {
    const start = new Date();
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 2 : -(dayOfWeek - 1);
    start.setDate(start.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  // Task with joined crew relation from Supabase
  type TaskWithCrew = Task & { crew?: { id: string; name: string } | null };

  const mappedTasks: LookaheadTask[] = useMemo(() => {
    return (lookaheadTasks as TaskWithCrew[]).map((t, idx) => {
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
        _taskId: t.id, // preserve DB id for mutations
      };
    });
  }, [lookaheadTasks, crews, boardStartDate]);

  const [tasks, setTasks] = useState<LookaheadTask[]>([]);

  // Sync mapped tasks from API into local state for drag/drop
  React.useEffect(() => {
    setTasks(mappedTasks);
  }, [mappedTasks]);

  const handleTaskMove = useCallback(async (taskId: number, newDayIndex: number, newCrew: string) => {
    const task = tasks.find(t => t.id === taskId);
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, dayIndex: newDayIndex, crew: newCrew } : t
    ));

    // Persist new start_date to Supabase
    const dbId = (task as (LookaheadTask & { _taskId?: string }))?._taskId;
    if (dbId) {
      const newStart = new Date(boardStartDate);
      newStart.setDate(newStart.getDate() + newDayIndex);
      const { error } = await fromTable('tasks')
        .update({ start_date: newStart.toISOString().slice(0, 10), trade: newCrew } as Record<string, unknown>)
        .eq('id' as never, dbId);
      if (error) {
        addToast('error', 'Failed to save task move');
        return;
      }
    }
    addToast('success', 'Task moved');
  }, [addToast, tasks, boardStartDate]);

  const handleConstraintToggle = useCallback(async (taskId: number, constraintIndex: number) => {
    let resolvedConstraint: { type: string; resolved: boolean } | null = null;
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const newConstraints = t.constraints.map((c, i) => {
        if (i === constraintIndex) {
          resolvedConstraint = { type: c.type, resolved: !c.resolved };
          return { ...c, resolved: !c.resolved };
        }
        return c;
      });
      const allResolved = newConstraints.every((c) => c.resolved);
      const anyBlocked = newConstraints.some((c) => !c.resolved);
      return {
        ...t,
        constraints: newConstraints,
        readiness: allResolved ? 'ready' as const : anyBlocked ? 'constrained' as const : 'ready' as const,
      };
    }));

    // Persist constraint state to Supabase
    const task = tasks.find(t => t.id === taskId);
    const dbId = (task as (LookaheadTask & { _taskId?: string }))?._taskId;
    if (dbId && resolvedConstraint) {
      const field = resolvedConstraint.type === 'material' ? 'material_delivery_required'
        : resolvedConstraint.type === 'inspection' ? 'inspection_required'
        : null;
      // For material/inspection constraints, resolved means the requirement is fulfilled
      // We store a constraint_notes update for other types
      if (field) {
        await fromTable('tasks').update({ [field]: !resolvedConstraint.resolved } as Record<string, unknown>).eq('id' as never, dbId);
      }
    }
    addToast('info', 'Constraint updated');
  }, [addToast, tasks]);

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
          actionLabel="Create Task"
          onAction={() => setIsCreating(true)}
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
          <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
            {([1, 2, 3] as const).map((w) => (
              <button
                key={w}
                aria-pressed={weekView === w}
                aria-label={`${w} week view`}
                onClick={() => setWeekView(w)}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                  backgroundColor: weekView === w ? colors.surfaceRaised : 'transparent',
                  color: weekView === w ? colors.textPrimary : colors.textTertiary,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                  boxShadow: weekView === w ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  minHeight: '56px', minWidth: '40px',
                }}
              >
                {w}W
              </button>
            ))}
          </div>
          <Btn variant="secondary" size="sm" icon={<Printer size={14} />} onClick={() => { addToast('info', 'Preparing print layout...'); setTimeout(() => window.print(), 300); }}>Print</Btn>
          <Btn variant="secondary" size="sm" icon={<Share2 size={14} />} onClick={async () => {
            if (!projectId) return;
            try {
              const { data: { user } } = await supabase.auth.getUser();
              await fromTable('notifications').insert({
                project_id: projectId,
                title: `${weekView}-Week Lookahead Published`,
                body: `Lookahead schedule with ${tasks.length} tasks sent to field team.`,
                type: 'lookahead_published',
                entity_type: 'lookahead',
                user_id: user?.id ?? '',
                link: '/lookahead',
              } as Record<string, unknown>);
              addToast('success', 'Lookahead sent to field team');
            } catch {
              addToast('error', 'Failed to send notification');
            }
          }}>Send to Foreman</Btn>
        </div>
      }
    >
      {/* AI Insights */}
      <div style={{ marginBottom: spacing['4'] }}>
        <PageInsightBanners page="lookahead" />
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

      {isCreating && (
        <CreateLookaheadTaskModal
          projectId={projectId!}
          crews={crewData}
          onClose={() => setIsCreating(false)}
          onSuccess={() => {
            setIsCreating(false);
            addToast('success', 'Lookahead task created');
          }}
        />
      )}
    </PageContainer>
  );
};

// ── Create Lookahead Task Modal ─────────────────────────

interface CreateLookaheadTaskModalProps {
  projectId: string;
  crews: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateLookaheadTaskModal: React.FC<CreateLookaheadTaskModalProps> = ({
  projectId,
  crews,
  onClose,
  onSuccess,
}) => {
  const createTask = useCreateLookaheadTask();

  const [title, setTitle] = useState('');
  const [crewId, setCrewId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workType, setWorkType] = useState('');
  const [location, setLocation] = useState('');
  const [materialDeliveryRequired, setMaterialDeliveryRequired] = useState(false);
  const [inspectionRequired, setInspectionRequired] = useState(false);
  const [constraintNotes, setConstraintNotes] = useState('');
  const [percentComplete, setPercentComplete] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createTask.mutate(
      {
        project_id: projectId,
        title: title.trim(),
        crew_id: crewId || null,
        start_date: startDate || null,
        end_date: endDate || null,
        work_type: workType || null,
        location: location.trim() || null,
        material_delivery_required: materialDeliveryRequired,
        inspection_required: inspectionRequired,
        constraint_notes: constraintNotes.trim() || null,
        percent_complete: percentComplete,
        status: 'todo',
      },
      { onSuccess },
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: zIndex.modal,
        padding: spacing['4'],
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          width: 'min(580px, 100%)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: shadows.lg,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing['4'],
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <Plus size={18} color={colors.primaryOrange} />
            <h2
              id="create-task-title"
              style={{
                margin: 0,
                fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
              }}
            >
              Create Lookahead Task
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              padding: spacing['2'],
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: spacing['4'], overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Install ductwork Level 3"
              style={inputStyle}
            />
          </div>

          {/* Crew + Work Type */}
          <div style={{ display: 'flex', gap: spacing['3'] }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Crew</label>
              <select value={crewId} onChange={(e) => setCrewId(e.target.value)} style={inputStyle}>
                <option value="">-- Select Crew --</option>
                {crews.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Work Type</label>
              <select value={workType} onChange={(e) => setWorkType(e.target.value)} style={inputStyle}>
                <option value="">-- Select --</option>
                {WORK_TYPES.map((wt) => (
                  <option key={wt.value} value={wt.value}>{wt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'flex', gap: spacing['3'] }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Building A, Floor 3"
              style={inputStyle}
            />
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', gap: spacing['5'] }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.body, color: colors.textPrimary, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={materialDeliveryRequired}
                onChange={(e) => setMaterialDeliveryRequired(e.target.checked)}
              />
              Material delivery required
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.body, color: colors.textPrimary, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={inspectionRequired}
                onChange={(e) => setInspectionRequired(e.target.checked)}
              />
              Inspection required
            </label>
          </div>

          {/* Constraint Notes */}
          <div>
            <label style={labelStyle}>Constraint Notes</label>
            <textarea
              value={constraintNotes}
              onChange={(e) => setConstraintNotes(e.target.value)}
              placeholder="Any constraints or dependencies..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Percent Complete */}
          <div>
            <label style={labelStyle}>Percent Complete ({percentComplete}%)</label>
            <input
              type="range"
              min={0}
              max={100}
              value={percentComplete}
              onChange={(e) => setPercentComplete(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Error */}
          {createTask.isError && (
            <div
              role="alert"
              style={{
                padding: spacing['3'],
                background: `${colors.statusCritical}11`,
                border: `1px solid ${colors.statusCritical}55`,
                borderRadius: borderRadius.md,
                fontSize: typography.fontSize.body,
                color: colors.statusCritical,
              }}
            >
              {(createTask.error as Error)?.message || 'Failed to create task'}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', paddingTop: spacing['2'], borderTop: `1px solid ${colors.borderSubtle}` }}>
            <Btn variant="secondary" size="md" onClick={onClose}>Cancel</Btn>
            <Btn
              variant="primary"
              size="md"
              icon={<Plus size={14} />}
              disabled={!title.trim() || createTask.isPending}
              onClick={handleSubmit}
            >
              {createTask.isPending ? 'Creating...' : 'Create Task'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
};
