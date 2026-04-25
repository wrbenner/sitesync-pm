import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Calendar, AlertCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { Modal } from '../../components/Primitives';
import { useAuth } from '../../hooks/useAuth';
import { useUpdateTask } from '../../hooks/mutations/tasks';
import { toast } from 'sonner';

// ────────────────────────────────────────────────────────────────
// My Tasks — tasks assigned to current user (cross-project)
// Upcoming + overdue bucketing, status badges, inline detail modal.
// ────────────────────────────────────────────────────────────────

interface AssignedTask {
  id: string;
  project_id: string;
  project_name: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  due_date: string | null;
}

const STATUS_LABELS: Record<AssignedTask['status'], string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

const STATUS_COLORS: Record<AssignedTask['status'], { fg: string; bg: string }> = {
  todo: { fg: colors.textSecondary, bg: colors.surfaceInset },
  in_progress: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  in_review: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  done: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
};

function useMyTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['my_tasks', userId],
    queryFn: async (): Promise<AssignedTask[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('id, project_id, title, description, status, priority, due_date, projects(name)')
        .eq('assigned_to', userId)
        .in('status', ['todo', 'in_progress', 'in_review'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []).map((t) => {
        const proj = t.projects as { name?: string } | { name?: string }[] | null;
        const projName = Array.isArray(proj) ? proj[0]?.name ?? null : proj?.name ?? null;
        return {
          id: t.id as string,
          project_id: t.project_id as string,
          project_name: projName,
          title: t.title as string,
          description: (t.description as string | null) ?? null,
          status: t.status as AssignedTask['status'],
          priority: (t.priority as AssignedTask['priority']) ?? null,
          due_date: (t.due_date as string | null) ?? null,
        };
      });
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function dueContext(dueDate: string | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: 'No due date', overdue: false };
  const days = daysUntil(dueDate);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { label: 'Due today', overdue: false };
  if (days === 1) return { label: 'Due tomorrow', overdue: false };
  if (days <= 7) return { label: `Due in ${days}d`, overdue: false };
  return { label: new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), overdue: false };
}

interface TaskDetailModalProps {
  task: AssignedTask | null;
  onClose: () => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose }) => {
  const update = useUpdateTask();
  if (!task) return null;

  const handleStatusChange = async (status: AssignedTask['status']) => {
    try {
      await update.mutateAsync({ id: task.id, updates: { status }, projectId: task.project_id });
      toast.success('Task updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const due = dueContext(task.due_date);
  const statusCfg = STATUS_COLORS[task.status];

  return (
    <Modal open={!!task} onClose={onClose} title={task.title} width="520px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
            padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: statusCfg.fg, backgroundColor: statusCfg.bg,
          }}>
            {STATUS_LABELS[task.status]}
          </span>
          {task.priority && (
            <span style={{
              padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              color: task.priority === 'critical' || task.priority === 'high' ? colors.statusCritical : colors.textSecondary,
              backgroundColor: task.priority === 'critical' || task.priority === 'high' ? colors.statusCriticalSubtle : colors.surfaceInset,
              textTransform: 'capitalize',
            }}>
              {task.priority}
            </span>
          )}
          <span style={{
            padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
            fontSize: typography.fontSize.caption,
            color: due.overdue ? colors.statusCritical : colors.textSecondary,
            backgroundColor: due.overdue ? colors.statusCriticalSubtle : colors.surfaceInset,
            fontWeight: typography.fontWeight.medium,
          }}>
            {due.label}
          </span>
        </div>

        {task.project_name && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing['1'] }}>
              Project
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{task.project_name}</div>
          </div>
        )}

        {task.description && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing['1'] }}>
              Description
            </div>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {task.description}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
          {(['todo', 'in_progress', 'in_review', 'done'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={s === task.status || update.isPending}
              style={{
                padding: `${spacing['1.5']} ${spacing['3']}`,
                border: `1px solid ${s === task.status ? colors.brand400 : colors.borderSubtle}`,
                backgroundColor: s === task.status ? colors.brand400 : colors.surfaceRaised,
                color: s === task.status ? colors.white : colors.textSecondary,
                borderRadius: borderRadius.md,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
                cursor: s === task.status || update.isPending ? 'default' : 'pointer',
                opacity: update.isPending && s !== task.status ? 0.5 : 1,
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export const DashboardMyTasks: React.FC = () => {
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useMyTasks(user?.id);
  const [openTask, setOpenTask] = useState<AssignedTask | null>(null);

  const { overdue, upcoming } = useMemo(() => {
    const o: AssignedTask[] = [];
    const u: AssignedTask[] = [];
    for (const t of tasks) {
      const ctx = dueContext(t.due_date);
      if (ctx.overdue) o.push(t);
      else u.push(t);
    }
    return { overdue: o, upcoming: u };
  }, [tasks]);

  const visible = useMemo(() => [...overdue, ...upcoming].slice(0, 6), [overdue, upcoming]);

  return (
    <div style={{
      padding: spacing['4'],
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.borderSubtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <ClipboardList size={12} color={colors.textTertiary} />
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            My Tasks
          </span>
        </div>
        <span style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>
          {overdue.length > 0 && (
            <span style={{ color: colors.statusCritical, marginRight: spacing['2'] }}>{overdue.length} overdue</span>
          )}
          {tasks.length} open
        </span>
      </div>

      {isLoading ? (
        <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, padding: spacing['2'] }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: spacing['3'], backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: typography.fontSize.sm,
        }}>
          <Calendar size={14} />
          <span>No open tasks assigned to you.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
          {visible.map((task) => {
            const due = dueContext(task.due_date);
            const statusCfg = STATUS_COLORS[task.status];
            return (
              <button
                key={task.id}
                onClick={() => setOpenTask(task)}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['3'],
                  padding: `${spacing['2']} ${spacing['2.5']}`,
                  border: 'none',
                  background: 'none',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: typography.fontFamily,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: borderRadius.full,
                  backgroundColor: due.overdue ? colors.statusCriticalSubtle : colors.surfaceInset,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {due.overdue ? <AlertCircle size={11} color={colors.statusCritical} /> : <Calendar size={11} color={colors.textTertiary} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: '10px', color: due.overdue ? colors.statusCritical : colors.textSecondary, marginTop: 1 }}>
                    {due.label}{task.project_name && ` · ${task.project_name}`}
                  </div>
                </div>
                <span style={{
                  padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                  fontSize: '10px', fontWeight: typography.fontWeight.semibold,
                  color: statusCfg.fg, backgroundColor: statusCfg.bg, flexShrink: 0,
                }}>
                  {STATUS_LABELS[task.status]}
                </span>
                <ChevronRight size={12} color={colors.textTertiary} style={{ flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}

      <TaskDetailModal task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  );
};

DashboardMyTasks.displayName = 'DashboardMyTasks';
