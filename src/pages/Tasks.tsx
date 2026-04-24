import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronRight, ChevronDown, CornerDownRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  PageContainer,
  Card,
  SectionHeader,
  Btn,
  Skeleton,
  Modal,
  InputField,
  EmptyState,
} from '../components/Primitives';
import { PermissionGate } from '../components/auth/PermissionGate';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useTasks } from '../hooks/queries/tasks';
import { useCreateTask, useUpdateTask, useDeleteTask } from '../hooks/mutations/tasks';
import type { Task } from '../types/database';

// ── Types ─────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

interface TaskNode extends Task {
  children: TaskNode[];
  depth: number;
}

// ── Badge configs ─────────────────────────────────────────

const statusCfg: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: 'To Do', color: colors.statusPending, bg: colors.statusPendingSubtle },
  in_progress: { label: 'In Progress', color: colors.statusInfo, bg: colors.statusInfoSubtle },
  in_review: { label: 'In Review', color: colors.statusReview, bg: colors.statusReviewSubtle },
  done: { label: 'Done', color: colors.statusActive, bg: colors.statusActiveSubtle },
};

const priorityCfg: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: colors.textTertiary, bg: colors.statusNeutralSubtle },
  medium: { label: 'Medium', color: colors.statusInfo, bg: colors.statusInfoSubtle },
  high: { label: 'High', color: colors.statusPending, bg: colors.statusPendingSubtle },
  critical: { label: 'Critical', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
};

const STATUS_KEYS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
const PRIORITY_KEYS: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

// ── Tree helpers ──────────────────────────────────────────

function buildTree(rows: Task[]): TaskNode[] {
  const map = new Map<string, TaskNode>();
  for (const r of rows) map.set(r.id, { ...r, children: [], depth: 0 });

  const roots: TaskNode[] = [];
  for (const node of map.values()) {
    const parentId = (node.parent_task_id as string | null) ?? null;
    const parent = parentId ? map.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const assignDepth = (arr: TaskNode[], depth: number) => {
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const n of arr) {
      n.depth = depth;
      assignDepth(n.children, depth + 1);
    }
  };
  assignDepth(roots, 0);
  return roots;
}

function flattenTree(tree: TaskNode[], collapsed: Set<string>): TaskNode[] {
  const out: TaskNode[] = [];
  const walk = (n: TaskNode) => {
    out.push(n);
    if (!collapsed.has(n.id)) n.children.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}

// ── Badges ────────────────────────────────────────────────

const Pill: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `2px ${spacing.sm}`,
    borderRadius: borderRadius.full,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    color,
    backgroundColor: bg,
  }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color }} />
    {label}
  </span>
);

// ── Inline select (for status/priority) ───────────────────

interface InlineSelectProps<V extends string> {
  value: V;
  options: V[];
  labels: Record<V, string>;
  onChange: (v: V) => void;
  ariaLabel: string;
  disabled?: boolean;
}

function InlineSelect<V extends string>({ value, options, labels, onChange, ariaLabel, disabled }: InlineSelectProps<V>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as V)}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: '4px 8px',
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.base,
        backgroundColor: 'transparent',
        fontSize: typography.fontSize.caption,
        fontFamily: typography.fontFamily,
        color: colors.textPrimary,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>{labels[o]}</option>
      ))}
    </select>
  );
}

// ── Main ──────────────────────────────────────────────────

export const Tasks: React.FC = () => {
  const projectId = useProjectId();
  const { data: tasksResult, isPending } = useTasks(projectId);
  const tasks: Task[] = useMemo(() => tasksResult?.data ?? [], [tasksResult]);

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const tree = useMemo(() => buildTree(tasks), [tasks]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Create-task form state
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo' as TaskStatus,
    priority: 'medium' as TaskPriority,
    due_date: '',
    parent_task_id: '' as string,
  });

  const resetForm = () =>
    setForm({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', parent_task_id: '' });

  const openCreate = (parentId?: string | null) => {
    resetForm();
    if (parentId) setForm((f) => ({ ...f, parent_task_id: parentId }));
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!projectId) return;
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      await createTask.mutateAsync({
        data: {
          project_id: projectId,
          title: form.title.trim(),
          description: form.description,
          status: form.status,
          priority: form.priority,
          due_date: form.due_date || null,
          parent_task_id: form.parent_task_id || null,
          is_critical_path: false,
        },
        projectId,
      });
      toast.success('Task created');
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      // useAuditedMutation already surfaces an errorMessage toast; this is a backstop.
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const updateField = async (
    id: string,
    patch: Partial<Pick<Task, 'status' | 'priority'>>,
  ) => {
    if (!projectId) return;
    try {
      await updateTask.mutateAsync({ id, updates: patch, projectId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!projectId) return;
    if (!window.confirm('Delete this task? Any sub-tasks will also be deleted.')) return;
    try {
      await deleteTask.mutateAsync({ id, projectId });
      toast.success('Task deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  // Metrics
  const counts = useMemo(() => {
    const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, in_review: 0, done: 0 };
    for (const t of tasks) {
      const s = (t.status as TaskStatus) ?? 'todo';
      if (s in byStatus) byStatus[s] += 1;
    }
    return byStatus;
  }, [tasks]);

  return (
    <PageContainer
      title="Tasks"
      subtitle={`${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${counts.done} done · ${counts.in_progress} in progress`}
      actions={
        <PermissionGate permission="tasks.create">
          <Btn icon={<Plus size={14} />} onClick={() => openCreate(null)}>New Task</Btn>
        </PermissionGate>
      }
    >
      <Card padding="0">
        <div style={{ padding: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <SectionHeader title="All tasks" />
        </div>

        {isPending ? (
          <div style={{ padding: spacing['6'] }}>
            <Skeleton height={32} />
            <div style={{ height: spacing['3'] }} />
            <Skeleton height={32} />
            <div style={{ height: spacing['3'] }} />
            <Skeleton height={32} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: spacing['8'] }}>
            <EmptyState
              title="No tasks yet"
              description="Create the first task to start planning your project."
              action={
                <PermissionGate permission="tasks.create">
                  <Btn icon={<Plus size={14} />} onClick={() => openCreate(null)}>New Task</Btn>
                </PermissionGate>
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <Th>Title</Th>
                  <Th width="160px">Status</Th>
                  <Th width="130px">Priority</Th>
                  <Th width="130px">Due date</Th>
                  <Th width="80px">Sub-task</Th>
                  <Th width="60px" />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const status = ((t.status as TaskStatus) ?? 'todo');
                  const priority = ((t.priority as TaskPriority) ?? 'medium');
                  const hasChildren = t.children.length > 0;
                  const isCollapsed = collapsed.has(t.id);
                  const due = (t.due_date as string | null) ?? '';
                  return (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], paddingLeft: t.depth * 20 }}>
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(t.id)}
                              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textTertiary }}
                            >
                              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                          ) : (
                            <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: colors.textTertiary }}>
                              {t.depth > 0 ? <CornerDownRight size={12} /> : null}
                            </span>
                          )}
                          <span style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, fontWeight: t.depth === 0 ? typography.fontWeight.medium : typography.fontWeight.normal }}>
                            {t.title || '(untitled)'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          <Pill label={statusCfg[status].label} color={statusCfg[status].color} bg={statusCfg[status].bg} />
                          <PermissionGate permission="tasks.edit">
                            <InlineSelect<TaskStatus>
                              value={status}
                              options={STATUS_KEYS}
                              labels={{ todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done' }}
                              onChange={(v) => updateField(t.id, { status: v })}
                              ariaLabel={`Change status for ${t.title}`}
                            />
                          </PermissionGate>
                        </div>
                      </td>
                      <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          <Pill label={priorityCfg[priority].label} color={priorityCfg[priority].color} bg={priorityCfg[priority].bg} />
                          <PermissionGate permission="tasks.edit">
                            <InlineSelect<TaskPriority>
                              value={priority}
                              options={PRIORITY_KEYS}
                              labels={{ low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }}
                              onChange={(v) => updateField(t.id, { priority: v })}
                              ariaLabel={`Change priority for ${t.title}`}
                            />
                          </PermissionGate>
                        </div>
                      </td>
                      <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                        <span style={{ fontSize: typography.fontSize.sm, color: due ? colors.textSecondary : colors.textTertiary }}>
                          {due ? due.slice(0, 10) : '—'}
                        </span>
                      </td>
                      <td style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                        <PermissionGate permission="tasks.create">
                          <Btn variant="ghost" onClick={() => openCreate(t.id)} aria-label={`Add sub-task under ${t.title}`} style={{ fontSize: typography.fontSize.caption, padding: `${spacing['1']} ${spacing['2']}` }}>
                            <Plus size={11} /> Sub
                          </Btn>
                        </PermissionGate>
                      </td>
                      <td style={{ padding: `${spacing['3']} ${spacing['4']}`, textAlign: 'right' }}>
                        <PermissionGate permission="tasks.delete">
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id)}
                            aria-label={`Delete ${t.title}`}
                            title="Delete task"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: spacing['1'], color: colors.textTertiary }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create task">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField
            label="Title *"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholder="e.g. Install rooftop HVAC unit"
            required
          />
          <InputField
            label="Description"
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="Scope, references, constraints…"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
                style={selectStyle}
              >
                {STATUS_KEYS.map((s) => <option key={s} value={s}>{statusCfg[s].label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                style={selectStyle}
              >
                {PRIORITY_KEYS.map((p) => <option key={p} value={p}>{priorityCfg[p].label}</option>)}
              </select>
            </div>
          </div>
          <InputField
            label="Due date"
            value={form.due_date}
            onChange={(v) => setForm((f) => ({ ...f, due_date: v }))}
            type="date"
            placeholder="YYYY-MM-DD"
          />
          <div>
            <label style={labelStyle}>Parent task (optional)</label>
            <select
              value={form.parent_task_id}
              onChange={(e) => setForm((f) => ({ ...f, parent_task_id: e.target.value }))}
              style={selectStyle}
              aria-label="Parent task"
            >
              <option value="">— No parent (top-level task) —</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title || '(untitled)'}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={createTask.isPending}>
              {createTask.isPending ? 'Creating…' : 'Create task'}
            </Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

// ── Shared styles ─────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.medium,
  color: colors.textSecondary,
  marginBottom: spacing.sm,
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.base,
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  backgroundColor: 'transparent',
  color: colors.textPrimary,
  cursor: 'pointer',
  boxSizing: 'border-box',
};

const Th: React.FC<{ children?: React.ReactNode; width?: string }> = ({ children, width }) => (
  <th style={{
    width,
    padding: `${spacing['3']} ${spacing['4']}`,
    textAlign: 'left',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }}>
    {children}
  </th>
);
