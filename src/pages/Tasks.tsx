import React, { useState, useMemo } from 'react';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';
import {
  AlertTriangle,
  CheckSquare,
  Plus,
  RefreshCw,
  Search,
  Calendar,
  MessageSquare,
  Paperclip,
  X,
  ArrowRight,
  GitBranch,
  Zap,
  Copy,
  Trash2,
  LayoutTemplate,
} from 'lucide-react';
import {
  Btn,
  Card,
  Avatar,
  PriorityTag,
  TabBar,
  Modal,
  ProgressBar,
  PageContainer,
  RelatedItems,
  Skeleton,
  EmptyState,
  useToast,
} from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useTasks } from '../hooks/queries';
import { useProfileNames } from '../hooks/queries/profiles';
import { useAppNavigate, getRelatedItemsForTask } from '../utils/connections';
import { useCreateTask, useUpdateTask, useBulkUpdateTasks, useBulkDeleteTasks, useApplyTaskTemplate } from '../hooks/mutations';
import { useDirectoryContacts, useTaskCriticalPath, useTaskTemplates, useWorkingDaysConfig, useTaskRelations, useCreateTaskRelation, useDeleteTaskRelation } from '../hooks/queries';
import type { RelationType } from '../hooks/queries/scheduling';
import { useProjectId } from '../hooks/useProjectId';
import { countWorkingDays } from '../services/schedulingEngine';
import { deriveProgress, getScheduleHealth, getScheduleHealthDisplay } from '../services/progressEngine';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { PermissionGate } from '../components/auth/PermissionGate';

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

const statusConfig: Record<TaskStatus, { label: string; color: string; dotColor: string }> = {
  todo: { label: 'To Do', color: colors.statusPending, dotColor: colors.statusPending },
  in_progress: { label: 'In Progress', color: colors.statusInfo, dotColor: colors.statusInfo },
  in_review: { label: 'In Review', color: colors.statusReview, dotColor: colors.statusReview },
  done: { label: 'Done', color: colors.statusSuccess, dotColor: colors.statusActive },
};

const columns: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
const priorities: Array<TaskPriority | 'all'> = ['all', 'critical', 'high', 'medium', 'low'];

interface MappedTask {
  id: number;
  uuid: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee: { name: string; initials: string; company: string };
  dueDate: string;
  tags: string[];
  commentsCount: number;
  attachmentsCount: number;
  createdDate: string;
  subtasks: { total: number; completed: number };
  linkedItems: Array<{ type: string; id: string }>;
  predecessorIds: string[];
  predecessor_ids: string[];
  successor_ids: string[];
  percent_complete: number | null;
  isCriticalPath: boolean;
  is_critical_path: boolean;
  parent_task_id: string | null;
}

export const Tasks: React.FC = () => {
  const [nowMs] = useState(() => Date.now());
  const projectId = useProjectId();
  const { data: tasksResult, isPending: loading, error: tasksError, refetch } = useTasks(projectId);
  const tasksRaw = tasksResult?.data ?? [];

  const assigneeIds = useMemo(
    () => tasksRaw.map((t: Record<string, unknown>) => t.assigned_to as string | null),
    [tasksRaw],
  );
  const { data: profileMap } = useProfileNames(assigneeIds);

  // Map API tasks to component shape
  const fetchedTasks: MappedTask[] = useMemo(() => tasksRaw.map((t: Record<string, unknown>) => {
    const assignedId = t.assigned_to as string | null;
    const name = assignedId ? (profileMap?.get(assignedId)?.full_name || 'Unassigned') : 'Unassigned';
    const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'NA';
    const predecessorIds = (t.predecessor_ids as string[] | null) || [];
    const successorIds = (t.successor_ids as string[] | null) || [];
    const percentComplete = typeof t.percent_complete === 'number' ? t.percent_complete : null;
    const tags: string[] = [];
    if (t.is_critical_path) tags.push('critical path');
    return {
      id: typeof t.id === 'number' ? t.id : parseInt(String(t.id).replace(/\D/g, '').slice(0, 8) || '0', 10),
      uuid: String(t.id || ''),
      title: (t.title as string) || '',
      description: (t.description as string) || '',
      status: ((t.status as string) || 'todo') as MappedTask['status'],
      priority: ((t.priority as string) || 'medium') as MappedTask['priority'],
      assignee: { name, initials, company: '' },
      dueDate: (t.due_date as string) || (t.end_date as string) || '',
      tags,
      commentsCount: 0,
      attachmentsCount: 0,
      createdDate: ((t.created_at as string) || '').slice(0, 10),
      subtasks: { total: 0, completed: 0 },
      linkedItems: [],
      predecessorIds,
      predecessor_ids: predecessorIds,
      successor_ids: successorIds,
      percent_complete: percentComplete,
      isCriticalPath: !!t.is_critical_path,
      is_critical_path: !!t.is_critical_path,
      parent_task_id: (t.parent_task_id as string | null) ?? null,
    };
  }), [tasksRaw, profileMap]);

  type TaskList = MappedTask[];
  const [localTasks, setLocalTasks] = useState<TaskList>([]);
  const [initialized, setInitialized] = useState(false);

  // Sync fetched data into local state once loaded
  React.useEffect(() => {
    if (fetchedTasks.length > 0 && !initialized) {
      setLocalTasks(fetchedTasks);
      setInitialized(true);
    }
  }, [fetchedTasks, initialized]);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [selectedTask, setSelectedTask] = useState<NonNullable<typeof localTasks>[0] | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newAssignee, setNewAssignee] = useState('');
  const [criticalFilter, setCriticalFilter] = useState(false);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showTemplates, setShowTemplates] = useState(false);
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const bulkUpdate = useBulkUpdateTasks();
  const bulkDelete = useBulkDeleteTasks();
  const applyTemplate = useApplyTaskTemplate();
  const { data: cpmResults } = useTaskCriticalPath(projectId);
  const { data: templates } = useTaskTemplates();
  const { data: teamMembersResult } = useDirectoryContacts(projectId);
  const teamMembers = teamMembersResult?.data ?? [];
  const { data: workingDaysConfig } = useWorkingDaysConfig(projectId);
  const createRelation = useCreateTaskRelation();
  const deleteRelation = useDeleteTaskRelation();
  const { data: selectedTaskRelations } = useTaskRelations(selectedTask?.uuid || undefined);

  // New task form: scheduling fields
  const [newEstimatedHours, setNewEstimatedHours] = useState<string>('');
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [newEndDate, setNewEndDate] = useState<string>('');
  const [newScheduleManually, setNewScheduleManually] = useState(false);
  // Dependency creation fields
  const [showAddDep, setShowAddDep] = useState(false);
  const [depPredecessorId, setDepPredecessorId] = useState('');
  const [depRelationType, setDepRelationType] = useState<RelationType>('follows');
  const [depLagDays, setDepLagDays] = useState<string>('0');

  // Build hierarchical maps. Subtask counts come from children where parent_task_id === this.uuid.
  const childrenByParent = useMemo(() => {
    const map = new Map<string, MappedTask[]>();
    localTasks.forEach((t) => {
      if (t.parent_task_id) {
        const arr = map.get(t.parent_task_id) ?? [];
        arr.push(t);
        map.set(t.parent_task_id, arr);
      }
    });
    return map;
  }, [localTasks]);

  const tasksWithComputedSubtasks = useMemo(() => {
    return localTasks.map((t) => {
      const kids = childrenByParent.get(t.uuid) ?? [];
      return {
        ...t,
        subtasks: {
          total: kids.length,
          completed: kids.filter((k) => k.status === 'done').length,
        },
      };
    });
  }, [localTasks, childrenByParent]);

  const filteredTasks = useMemo(() => {
    return tasksWithComputedSubtasks.filter((t) => {
      const matchesSearch = searchQuery === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
      const matchesMy = !myTasksOnly || t.assignee.initials === 'MP';
      if (criticalFilter) return matchesSearch && matchesPriority && matchesMy && (t.priority === 'critical' || t.priority === 'high');
      return matchesSearch && matchesPriority && matchesMy;
    });
  }, [tasksWithComputedSubtasks, searchQuery, filterPriority, criticalFilter, myTasksOnly]);

  // Sub-task creation state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [parentTaskForNew, setParentTaskForNew] = useState('');

  useTableKeyboardNavigation(filteredTasks, selectedTask?.id ?? null, setSelectedTask);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, typeof filteredTasks> = { todo: [], in_progress: [], in_review: [], done: [] };
    // Board view shows only root tasks — subtasks are surfaced in their parent's detail panel.
    filteredTasks.filter((t) => !t.parent_task_id).forEach((t) => grouped[t.status].push(t));
    return grouped;
  }, [filteredTasks]);

  const rootTasks = useMemo(() => filteredTasks.filter((t) => !t.parent_task_id), [filteredTasks]);

  const formatDue = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - nowMs) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: colors.white, bg: colors.statusCritical };
    if (days === 0) return { text: 'Due today', color: colors.white, bg: colors.statusPending };
    if (days <= 2) return { text: `${days}d left`, color: colors.statusPending, bg: `${colors.statusPending}14` };
    return { text: `${days}d left`, color: colors.textTertiary, bg: 'transparent' };
  };

  const priorityDotColor: Record<string, string> = {
    critical: colors.statusCritical,
    high: colors.statusPending,
    medium: colors.statusInfo,
    low: colors.textTertiary,
  };

  const toggleSelect = (taskId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleBulkStatusChange = async (status: TaskStatus) => {
    const ids = Array.from(selectedIds).map(String);
    try {
      await bulkUpdate.mutateAsync({ ids, updates: { status }, projectId: projectId! });
      setLocalTasks(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, status } : t));
      setSelectedIds(new Set());
      addToast('success', `${ids.length} tasks moved to ${statusConfig[status].label}`);
    } catch {
      addToast('error', 'Failed to update tasks');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).map(String);
    try {
      await bulkDelete.mutateAsync({ ids, projectId: projectId! });
      setLocalTasks(prev => prev.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      addToast('success', `${ids.length} tasks deleted`);
    } catch {
      addToast('error', 'Failed to delete tasks');
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      await applyTemplate.mutateAsync({ templateId, projectId: projectId! });
      addToast('success', 'Template tasks created');
      setShowTemplates(false);
    } catch {
      addToast('error', 'Failed to apply template');
    }
  };

  const renderTaskCard = (task: typeof localTasks[0]) => {
    const due = formatDue(task.dueDate);
    const cpmResult = cpmResults?.get(task.uuid);
    const isCriticalPath = cpmResult?.isCritical || task.is_critical_path;
    return (
      <div
        key={task.id}
        draggable
        role="button"
        tabIndex={0}
        onClick={(e) => { if (e.shiftKey) { toggleSelect(task.id); } else { setSelectedTask(task); } }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (e.shiftKey) { toggleSelect(task.id); } else { setSelectedTask(task); } } }}
        style={{
          backgroundColor: selectedIds.has(task.id) ? `${colors.primaryOrange}08` : colors.surfaceRaised,
          outline: selectedIds.has(task.id) ? `2px solid ${colors.primaryOrange}` : 'none',
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          cursor: 'grab',
          boxShadow: shadows.base,
          transition: `box-shadow ${transitions.quick}, transform ${transitions.quick}`,
          position: 'relative',
          minHeight: '140px',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.md;
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.base;
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        }}
      >
        {/* Priority dot */}
        <div
          style={{
            position: 'absolute',
            top: spacing.lg,
            right: spacing.lg,
            width: 6,
            height: 6,
            borderRadius: borderRadius.full,
            backgroundColor: priorityDotColor[task.priority],
          }}
        />

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm, paddingRight: spacing.lg }}>
          <p style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.normal }}>
            {task.title}
          </p>
          {getAnnotationsForEntity('task', task.id).map((ann) => (
            <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
          ))}
        </div>

        {/* Tags */}
        {task.tags.length > 0 ? (
          <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' }}>
            {task.tags.slice(0, 2).map((tag) => (
              <span key={tag} style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, backgroundColor: colors.surfaceFlat, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full }}>
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ height: '20px', marginBottom: spacing.md }} />
        )}

        {/* Critical Path flag + float */}
        {isCriticalPath && (
          <div style={{ marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <span style={{ fontSize: typography.fontSize.xs, color: colors.statusCritical, backgroundColor: `${colors.statusCritical}0A`, padding: '1px 6px', borderRadius: borderRadius.full, fontWeight: typography.fontWeight.semibold }}>Critical Path</span>
          </div>
        )}
        {!isCriticalPath && cpmResult && cpmResult.totalFloat > 0 && (
          <div style={{ marginBottom: spacing.md }}>
            <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, backgroundColor: colors.surfaceFlat, padding: '1px 6px', borderRadius: borderRadius.full }}>{cpmResult.totalFloat}d float</span>
          </div>
        )}
        {/* Dependency indicator */}
        {task.predecessor_ids?.length > 0 && (
          <div style={{ marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <GitBranch size={10} color={colors.textTertiary} />
            <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{task.predecessor_ids.length} dep{task.predecessor_ids.length > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Subtask progress */}
        {task.subtasks.total > 0 && (
          <div style={{ marginBottom: spacing.md }}>
            <ProgressBar
              value={task.subtasks.completed}
              max={task.subtasks.total}
              height={3}
              color={task.subtasks.completed === task.subtasks.total ? colors.tealSuccess : colors.statusInfo}
            />
            <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: spacing.xs, display: 'block' }}>
              {task.subtasks.completed}/{task.subtasks.total}
            </span>
          </div>
        )}

        {/* Percent complete progress bar */}
        {task.percent_complete != null && task.percent_complete > 0 && (
          <div style={{ marginBottom: spacing.md }}>
            <ProgressBar value={task.percent_complete} max={100} height={3} color={task.percent_complete === 100 ? colors.tealSuccess : colors.primaryOrange} />
            <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: spacing.xs, display: 'block' }}>{task.percent_complete}%</span>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Avatar initials={task.assignee.initials} size={24} />
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            {task.commentsCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <MessageSquare size={11} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{task.commentsCount}</span>
              </div>
            )}
            <span style={{ fontSize: typography.fontSize.xs, color: due.color, backgroundColor: due.bg, padding: due.bg !== 'transparent' ? '1px 6px' : '0', borderRadius: borderRadius.full, fontWeight: typography.fontWeight.medium }}>
              {due.text}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderBoard = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg, alignItems: 'start' }}>
      {columns.map((status) => {
        const config = statusConfig[status];
        const columnTasks = tasksByStatus[status];
        return (
          <div key={status}>
            {/* Column header with colored top border */}
            <div
              style={{
                borderTop: `3px solid ${config.dotColor}`,
                borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`,
                padding: `${spacing.md} ${spacing.lg}`,
                marginBottom: spacing.md,
                backgroundColor: colors.surfaceFlat,
                borderBottomLeftRadius: borderRadius.md,
                borderBottomRightRadius: borderRadius.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  {config.label}
                </span>
                <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                  {columnTasks.length}
                </span>
              </div>
              <PermissionGate permission="tasks.create">
              <button
                aria-label={`Add task to ${config.label}`}
                onClick={() => setShowNewTask(true)}
                style={{
                  width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm,
                  cursor: 'pointer', color: colors.textTertiary, transition: `color ${transitions.quick}`,
                  margin: '-17px -17px -17px 0',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textPrimary; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
              >
                <Plus size={14} />
              </button>
              </PermissionGate>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {columnTasks.map(renderTaskCard)}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Flatten root tasks interleaved with their children for the list view.
  const hierarchicalList: Array<{ task: typeof filteredTasks[0]; depth: number }> = [];
  rootTasks.forEach((root) => {
    hierarchicalList.push({ task: root, depth: 0 });
    const kids = childrenByParent.get(root.uuid) ?? [];
    kids.forEach((child) => {
      // Children aren't independently filtered by the search box beyond inheritance from the parent's visibility.
      hierarchicalList.push({ task: tasksWithComputedSubtasks.find((t) => t.uuid === child.uuid) ?? child, depth: 1 });
    });
  });

  const renderList = () => (
    <Card padding="0">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 140px 120px 120px 100px 80px',
          padding: `${spacing.md} ${spacing.xl}`,
          borderBottom: `1px solid ${colors.borderLight}`,
        }}
      >
        {['Task', 'Assignee', 'Status', 'Priority', 'Due', ''].map((h) => (
          <p key={h} style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, margin: 0 }}>
            {h}
          </p>
        ))}
      </div>
      {hierarchicalList.map(({ task, depth }, idx) => {
        const due = formatDue(task.dueDate);
        const sc = statusConfig[task.status];
        return (
          <div
            key={task.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedTask(task)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTask(task); } }}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 140px 120px 120px 100px 80px',
              padding: `${spacing.lg} ${spacing.xl}`,
              borderBottom: idx < hierarchicalList.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
              cursor: 'pointer',
              transition: `background-color ${transitions.quick}`,
              alignItems: 'center',
              backgroundColor: depth > 0 ? colors.surfaceFlat : colors.surfaceRaised,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceInset; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = depth > 0 ? colors.surfaceFlat : colors.surfaceRaised; }}
          >
            <div style={{ paddingLeft: depth > 0 ? spacing.xl : 0, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              {depth > 0 && (
                <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, fontFamily: 'monospace' }} aria-hidden="true">└─</span>
              )}
              <div>
                <p style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>
                  {task.title}
                </p>
                {task.subtasks.total > 0 && (
                  <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{task.subtasks.completed}/{task.subtasks.total} subtasks</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <Avatar initials={task.assignee.initials} size={24} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{task.assignee.name.split(' ')[0]}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <div style={{ width: 7, height: 7, borderRadius: borderRadius.full, backgroundColor: sc.dotColor }} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{sc.label}</span>
            </div>
            <PriorityTag priority={task.priority} />
            <span style={{ fontSize: typography.fontSize.sm, color: due.color, backgroundColor: due.bg, padding: due.bg !== 'transparent' ? '1px 6px' : '0', borderRadius: borderRadius.full, fontWeight: typography.fontWeight.medium }}>{due.text}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
              {task.commentsCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <MessageSquare size={12} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{task.commentsCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );

  const renderDetailPanel = () => {
    if (!selectedTask) return null;
    const due = formatDue(selectedTask.dueDate);

    return (
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px',
          backgroundColor: colors.surfaceRaised, boxShadow: shadows.lg,
          zIndex: 1040, overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: `${spacing.lg} ${spacing.xl}`, position: 'sticky', top: 0, backgroundColor: colors.surfaceRaised, zIndex: 1 }}>
          <button
            aria-label="Close task detail"
            onClick={() => setSelectedTask(null)}
            style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary, transition: `background-color ${transitions.quick}` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: `0 ${spacing.xl} ${spacing.xl}` }}>
          <h2 style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0, marginBottom: spacing.xl, lineHeight: typography.lineHeight.tight, letterSpacing: '-0.3px' }}>
            {selectedTask.title}
          </h2>

          {/* Meta rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, marginBottom: spacing['2xl'] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Assignee</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <Avatar initials={selectedTask.assignee.initials} size={24} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selectedTask.assignee.name}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Company</span>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{selectedTask.assignee.company}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Priority</span>
              <PriorityTag priority={selectedTask.priority} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Due</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <Calendar size={14} color={due.color} />
                <span style={{ fontSize: typography.fontSize.sm, color: due.color, fontWeight: typography.fontWeight.medium }}>
                  {new Date(selectedTask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <div style={{ width: 7, height: 7, borderRadius: borderRadius.full, backgroundColor: statusConfig[selectedTask.status].dotColor }} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{statusConfig[selectedTask.status].label}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: spacing['2xl'] }}>
            <h3 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.sm }}>Description</h3>
            <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>
              {selectedTask.description}
            </p>
          </div>

          {/* Subtasks */}
          {(() => {
            const kids = childrenByParent.get(selectedTask.uuid) ?? [];
            const completed = kids.filter((k) => k.status === 'done').length;
            return (
              <div style={{ marginBottom: spacing['2xl'] }}>
                <h3 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>
                  Subtasks ({completed}/{kids.length})
                </h3>
                {kids.length > 0 && (
                  <>
                    <ProgressBar
                      value={completed} max={kids.length} height={6}
                      color={completed === kids.length ? colors.tealSuccess : colors.statusInfo}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, marginTop: spacing.md }}>
                      {kids.map((k) => {
                        const isDone = k.status === 'done';
                        return (
                          <button
                            key={k.uuid}
                            type="button"
                            onClick={async () => {
                              const next: TaskStatus = isDone ? 'todo' : 'done';
                              try {
                                await updateTask.mutateAsync({ id: k.uuid, updates: { status: next }, projectId: projectId! });
                                setLocalTasks((prev) => prev.map((t) => t.uuid === k.uuid ? { ...t, status: next } : t));
                                addToast('success', isDone ? 'Subtask reopened' : 'Subtask completed');
                              } catch {
                                addToast('error', 'Failed to update subtask');
                              }
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: spacing.sm,
                              textAlign: 'left', background: 'transparent', border: 'none',
                              padding: `${spacing.sm} ${spacing.md}`,
                              borderRadius: borderRadius.sm, cursor: 'pointer',
                              color: isDone ? colors.textTertiary : colors.textPrimary,
                              fontSize: typography.fontSize.sm,
                              fontFamily: typography.fontFamily,
                            }}
                          >
                            <span style={{
                              width: 14, height: 14, borderRadius: borderRadius.sm,
                              border: `1.5px solid ${isDone ? colors.tealSuccess : colors.textTertiary}`,
                              backgroundColor: isDone ? colors.tealSuccess : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              {isDone && <span style={{ color: colors.white, fontSize: 10, lineHeight: 1 }}>&#10003;</span>}
                            </span>
                            <span style={{ textDecoration: isDone ? 'line-through' : 'none' }}>{k.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <PermissionGate permission="tasks.create">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const title = newSubtaskTitle.trim();
                      if (!title) return;
                      try {
                        const result = await createTask.mutateAsync({
                          projectId: projectId!,
                          data: {
                            project_id: projectId!,
                            title,
                            status: 'todo',
                            priority: 'medium',
                            parent_task_id: selectedTask.uuid,
                          },
                        });
                        const newUuid = String((result?.data as Record<string, unknown> | undefined)?.id ?? '');
                        const newId = parseInt(newUuid.replace(/\D/g, '').slice(0, 8) || String(Date.now()), 10);
                        const newRow: MappedTask = {
                          id: newId,
                          uuid: newUuid,
                          title,
                          description: '',
                          status: 'todo',
                          priority: 'medium',
                          assignee: { name: 'Unassigned', initials: 'NA', company: '' },
                          dueDate: '',
                          tags: [],
                          commentsCount: 0,
                          attachmentsCount: 0,
                          createdDate: new Date().toISOString().slice(0, 10),
                          subtasks: { total: 0, completed: 0 },
                          linkedItems: [],
                          predecessorIds: [],
                          predecessor_ids: [],
                          successor_ids: [],
                          percent_complete: null,
                          isCriticalPath: false,
                          is_critical_path: false,
                          parent_task_id: selectedTask.uuid,
                        };
                        setLocalTasks((prev) => [newRow, ...prev]);
                        setNewSubtaskTitle('');
                        addToast('success', 'Subtask added');
                      } catch {
                        addToast('error', 'Failed to add subtask');
                      }
                    }}
                    style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}
                  >
                    <input
                      type="text"
                      placeholder="Add a subtask…"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      style={{
                        flex: 1,
                        padding: `${spacing.sm} ${spacing.md}`,
                        fontSize: typography.fontSize.sm,
                        fontFamily: typography.fontFamily,
                        border: 'none',
                        backgroundColor: colors.surfaceFlat,
                        borderRadius: borderRadius.sm,
                        outline: 'none',
                      }}
                      data-testid="subtask-title-input"
                    />
                    <Btn
                      variant="secondary"
                      size="sm"
                      onClick={() => { /* submit via form */ }}
                      disabled={!newSubtaskTitle.trim() || createTask.isPending}
                    >
                      Add
                    </Btn>
                  </form>
                </PermissionGate>
              </div>
            );
          })()}

          {/* Dependencies */}
          {(selectedTask.predecessor_ids?.length > 0 || selectedTask.successor_ids?.length > 0) && (
            <div style={{ marginBottom: spacing['2xl'] }}>
              <h3 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <GitBranch size={14} /> Dependencies
              </h3>
              {selectedTask.predecessor_ids?.length > 0 && (
                <div style={{ marginBottom: spacing.md }}>
                  <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Predecessors</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, marginTop: spacing.xs }}>
                    {selectedTask.predecessor_ids.map((pid: string) => {
                      const pred = localTasks.find(t => t.uuid === pid || String(t.id) === pid);
                      return (
                        <div key={pid} style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, padding: `${spacing.xs} ${spacing.sm}`, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.sm }}>
                          {pred ? pred.title : pid.slice(0, 8)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {selectedTask.successor_ids?.length > 0 && (
                <div>
                  <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Successors</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, marginTop: spacing.xs }}>
                    {selectedTask.successor_ids.map((sid: string) => {
                      const succ = localTasks.find(t => t.uuid === sid || String(t.id) === sid);
                      return (
                        <div key={sid} style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, padding: `${spacing.xs} ${spacing.sm}`, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.sm }}>
                          {succ ? succ.title : sid.slice(0, 8)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CPM Data */}
          {(() => {
            const cpm = cpmResults?.get(selectedTask.uuid);
            if (!cpm) return null;
            return (
              <div style={{ marginBottom: spacing['2xl'], padding: spacing.lg, backgroundColor: cpm.isCritical ? `${colors.statusCritical}06` : colors.surfaceFlat, borderRadius: borderRadius.md, borderLeft: `3px solid ${cpm.isCritical ? colors.statusCritical : colors.statusInfo}` }}>
                <h3 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <Zap size={14} color={cpm.isCritical ? colors.statusCritical : colors.statusInfo} /> Schedule Analysis
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                  <div>
                    <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Early Start</span>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: `${spacing.xs} 0 0`, fontWeight: typography.fontWeight.medium }}>Day {cpm.earlyStart}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Early Finish</span>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: `${spacing.xs} 0 0`, fontWeight: typography.fontWeight.medium }}>Day {cpm.earlyFinish}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Total Float</span>
                    <p style={{ fontSize: typography.fontSize.sm, color: cpm.totalFloat === 0 ? colors.statusCritical : colors.textPrimary, margin: `${spacing.xs} 0 0`, fontWeight: typography.fontWeight.semibold }}>{cpm.totalFloat} days</p>
                  </div>
                  <div>
                    <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Critical Path</span>
                    <p style={{ fontSize: typography.fontSize.sm, color: cpm.isCritical ? colors.statusCritical : colors.statusActive, margin: `${spacing.xs} 0 0`, fontWeight: typography.fontWeight.semibold }}>{cpm.isCritical ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Percent Complete */}
          {selectedTask.percent_complete != null && (
            <div style={{ marginBottom: spacing['2xl'] }}>
              <h3 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>Progress</h3>
              <ProgressBar
                value={selectedTask.percent_complete}
                max={100}
                height={8}
                color={selectedTask.percent_complete === 100 ? colors.tealSuccess : colors.primaryOrange}
              />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, display: 'block' }}>{selectedTask.percent_complete}% complete</span>
            </div>
          )}

          {/* Schedule Health & Working Days */}
          {(() => {
            const rawTask = tasksRaw.find((t: Record<string, unknown>) => String(t.id) === selectedTask.uuid);
            const startDate = rawTask?.start_date as string | null;
            const endDate = (rawTask?.end_date as string | null) || selectedTask.dueDate;
            const health = getScheduleHealth({ start_date: startDate || null, end_date: endDate || null, percent_complete: selectedTask.percent_complete });
            const healthDisplay = getScheduleHealthDisplay(health);
            const healthColors: Record<string, string> = { green: colors.tealSuccess, yellow: colors.statusPending, red: colors.statusCritical, blue: colors.statusInfo };
            const workingDays = (startDate && endDate && workingDaysConfig)
              ? countWorkingDays(new Date(startDate), new Date(endDate), workingDaysConfig)
              : null;

            return (
              <div style={{ marginBottom: spacing['2xl'], padding: spacing.lg, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: workingDays != null ? spacing.md : 0 }}>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Schedule Health</span>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: healthColors[healthDisplay.color] || colors.textSecondary }}>{healthDisplay.label}</span>
                </div>
                {workingDays != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Working Days</span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{workingDays} day{workingDays !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Task Relations (from task_relations table) */}
          {selectedTaskRelations && selectedTaskRelations.all.length > 0 && (
            <div style={{ marginBottom: spacing['2xl'] }}>
              <h3 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>Task Relations</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                {selectedTaskRelations.all.map((rel) => {
                  const otherTaskId = rel.from_task_id === selectedTask.uuid ? rel.to_task_id : rel.from_task_id;
                  const otherTask = localTasks.find(t => t.uuid === otherTaskId);
                  const direction = rel.from_task_id === selectedTask.uuid ? 'outgoing' : 'incoming';
                  return (
                    <div key={rel.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: typography.fontSize.sm, padding: `${spacing.xs} ${spacing.sm}`, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.sm }}>
                      <div style={{ color: colors.textSecondary }}>
                        <span style={{ color: colors.textTertiary, textTransform: 'capitalize' }}>{rel.relation_type}</span>
                        {direction === 'incoming' ? ' from ' : ' to '}
                        <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{otherTask?.title || otherTaskId.slice(0, 8)}</span>
                        {rel.lag_days > 0 && <span style={{ color: colors.textTertiary }}> (+{rel.lag_days}d lag)</span>}
                      </div>
                      <button onClick={() => deleteRelation.mutate({ id: rel.id, fromTaskId: rel.from_task_id, toTaskId: rel.to_task_id })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing.xs }}><X size={12} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          <div style={{ marginBottom: spacing['2xl'] }}>
            <h3 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.sm }}>Tags</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
              {selectedTask.tags.map((tag) => (
                <span key={tag} style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, backgroundColor: colors.surfaceFlat, padding: `${spacing.xs} ${spacing.md}`, borderRadius: borderRadius.full }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Linked Items */}
          <div style={{ marginBottom: spacing['2xl'] }}>
            <RelatedItems items={getRelatedItemsForTask(selectedTask.id)} onNavigate={appNavigate} />
          </div>

          {/* Activity summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, marginBottom: spacing['2xl'] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <MessageSquare size={14} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{selectedTask.commentsCount} comments</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <Paperclip size={14} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{selectedTask.attachmentsCount} attachments</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: spacing.md }}>
            {selectedTask.status !== 'done' && (
              <PermissionGate permission="tasks.edit">
              <Btn variant="primary" size="md" icon={<ArrowRight size={16} />} iconPosition="right" onClick={async () => {
                const nextStatus: Record<string, TaskStatus> = { todo: 'in_progress', in_progress: 'in_review', in_review: 'done' };
                const newStatus = nextStatus[selectedTask.status];
                if (!newStatus) return;
                try {
                  await updateTask.mutateAsync({
                    id: String(selectedTask.id),
                    updates: { status: newStatus },
                    projectId: projectId!,
                  });
                  // Update local state so the UI reflects immediately
                  setLocalTasks((prev) => prev.map((t) => t.id === selectedTask.id ? { ...t, status: newStatus } : t));
                  setSelectedTask({ ...selectedTask, status: newStatus });
                  addToast('success', `Task moved to ${statusConfig[newStatus].label}`);
                } catch {
                  addToast('error', 'Failed to update task');
                }
              }}>
                {selectedTask.status === 'todo' ? 'Start Task' : selectedTask.status === 'in_progress' ? 'Move to Review' : 'Mark Complete'}
              </Btn>
              </PermissionGate>
            )}
            <Btn variant="secondary" size="md" icon={<MessageSquare size={16} />}>Comment</Btn>
          </div>
        </div>
      </div>
    );
  };

  const pageAlerts = getPredictiveAlertsForPage('tasks');

  if (!projectId) {
    return (
      <PageContainer title="Tasks">
        <EmptyState
          icon={<CheckSquare size={32} color={colors.textTertiary} />}
          title="No project selected"
          description="Select a project from the sidebar to view and manage tasks."
        />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer title="Tasks" subtitle="Loading...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <Skeleton width="100%" height="48px" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg }}>
            {[1, 2, 3, 4].map((col) => (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                <Skeleton width="100%" height="40px" />
                <Skeleton width="100%" height="120px" />
                <Skeleton width="100%" height="120px" />
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (tasksError) {
    return (
      <PageContainer title="Tasks" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Failed to load tasks</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{(tasksError as Error).message || 'Unable to fetch task data'}</p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Try Again</Btn>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (localTasks.length === 0 && initialized) {
    return (
      <PageContainer
        title="Tasks"
        subtitle="No items"
        actions={<PermissionGate permission="tasks.create"><Btn onClick={() => setShowNewTask(true)}><Plus size={16} style={{ marginRight: spacing.xs }} />New Task</Btn></PermissionGate>}
      >
        <EmptyState
          icon={<CheckSquare size={40} color={colors.textTertiary} />}
          title="No tasks yet"
          description="Create a task to assign work and track progress across your project."
          action={<PermissionGate permission="tasks.create"><Btn variant="primary" onClick={() => setShowNewTask(true)}>Create Task</Btn></PermissionGate>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Tasks"
      subtitle={`${localTasks.length} tasks · ${localTasks.filter((t) => t.status !== 'done').length} active`}
      actions={
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <Btn variant="ghost" size="md" icon={<LayoutTemplate size={16} />} onClick={() => setShowTemplates(true)}>Templates</Btn>
          <PermissionGate permission="tasks.create"><Btn variant="primary" size="md" icon={<Plus size={16} />} onClick={() => setShowNewTask(true)} data-testid="create-task-button">New Task</Btn></PermissionGate>
        </div>
      }
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} onAction={() => setCriticalFilter(true)} />
      ))}

      {/* Critical filter active banner */}
      {criticalFilter && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing.md} ${spacing.lg}`,
          backgroundColor: `${colors.statusCritical}0A`,
          borderRadius: borderRadius.md,
          marginBottom: spacing.lg,
        }}>
          <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
            Showing critical and high priority tasks only
          </span>
          <button
            onClick={() => setCriticalFilter(false)}
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.semibold,
              color: colors.statusCritical,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: `${spacing.xs} ${spacing.md}`,
              borderRadius: borderRadius.full,
              transition: `background-color ${transitions.quick}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${colors.statusCritical}14`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl, flexWrap: 'wrap' }}>
        {/* Search */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: spacing.sm,
            padding: `${spacing.sm} ${spacing.lg}`,
            backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.full,
            flex: '1 1 200px', maxWidth: '320px',
          }}
        >
          <Search size={15} color={colors.textTertiary} />
          <input
            type="text" placeholder="Search tasks..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily, color: colors.textPrimary }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Priority pills */}
        <div style={{ display: 'flex', gap: spacing.xs }}>
          {priorities.map((p) => {
            const isActive = filterPriority === p;
            return (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                style={{
                  padding: `${spacing.xs} ${spacing.md}`,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
                  backgroundColor: isActive ? colors.surfaceInset : 'transparent',
                  color: isActive ? colors.textPrimary : colors.textTertiary,
                  border: 'none',
                  borderRadius: borderRadius.full,
                  cursor: 'pointer',
                  transition: `all ${transitions.quick}`,
                  textTransform: 'capitalize',
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* My Tasks toggle */}
        <button
          onClick={() => setMyTasksOnly(!myTasksOnly)}
          style={{
            padding: `${spacing.xs} ${spacing.lg}`,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            fontWeight: myTasksOnly ? typography.fontWeight.semibold : typography.fontWeight.medium,
            backgroundColor: myTasksOnly ? colors.primaryOrange : 'transparent',
            color: myTasksOnly ? colors.white : colors.textTertiary,
            border: myTasksOnly ? 'none' : `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.full,
            cursor: 'pointer',
            transition: `all ${transitions.quick}`,
          }}
        >
          My Tasks
        </button>

        {/* View Toggle */}
        <TabBar
          tabs={[{ id: 'board', label: 'Board' }, { id: 'list', label: 'List' }]}
          activeTab={viewMode}
          onChange={(id) => setViewMode(id as 'board' | 'list')}
        />
      </div>

      {/* Content */}
      {viewMode === 'board' ? renderBoard() : renderList()}

      {/* Detail Panel */}
      {selectedTask && (
        <>
          <div onClick={() => setSelectedTask(null)} role="presentation" aria-hidden="true" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 1039 }} />
          {renderDetailPanel()}
        </>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: spacing.xl, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: spacing.md,
          padding: `${spacing.md} ${spacing.xl}`,
          backgroundColor: colors.darkNavy, color: colors.white,
          borderRadius: borderRadius.lg, boxShadow: shadows.lg, zIndex: 1050,
        }}>
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>{selectedIds.size} selected</span>
          <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <PermissionGate permission="tasks.edit">
            {(['todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map(s => (
              <button key={s} onClick={() => handleBulkStatusChange(s)} style={{
                padding: `${spacing.xs} ${spacing.md}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                backgroundColor: 'rgba(255,255,255,0.1)', color: colors.white, border: 'none',
                borderRadius: borderRadius.sm, cursor: 'pointer',
              }}>{statusConfig[s].label}</button>
            ))}
          </PermissionGate>
          <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <PermissionGate permission="tasks.delete">
            <button onClick={handleBulkDelete} style={{
              padding: `${spacing.xs} ${spacing.md}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
              backgroundColor: colors.statusCriticalSubtle, color: colors.chartPink, border: 'none',
              borderRadius: borderRadius.sm, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: spacing.xs,
            }}><Trash2 size={13} /> Delete</button>
          </PermissionGate>
          <button onClick={() => setSelectedIds(new Set())} style={{
            padding: `${spacing.xs} ${spacing.md}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
            backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', border: 'none',
            cursor: 'pointer',
          }}><X size={14} /></button>
        </div>
      )}

      {/* Template Modal */}
      <Modal open={showTemplates} onClose={() => setShowTemplates(false)} title="Apply Task Template">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
            Select a template to create a set of pre configured tasks with dependencies.
          </p>
          {(templates || []).map((tmpl: Record<string, unknown>) => (
            <div key={String(tmpl.id)} onClick={() => handleApplyTemplate(String(tmpl.id))} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleApplyTemplate(String(tmpl.id)); } }} style={{
              padding: spacing.lg, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md,
              cursor: 'pointer', transition: `background-color ${transitions.quick}`,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceInset; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceFlat; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{String(tmpl.name || '')}</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `${spacing.xs} 0 0` }}>{String(tmpl.description || tmpl.phase || '')}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, backgroundColor: colors.surfaceRaised, padding: `${spacing.xs} ${spacing.sm}`, borderRadius: borderRadius.full }}>
                    {Array.isArray(tmpl.task_data) ? tmpl.task_data.length : 0} tasks
                  </span>
                  <Copy size={14} color={colors.textTertiary} />
                </div>
              </div>
            </div>
          ))}
          {(!templates || templates.length === 0) && (
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing.xl }}>No templates available</p>
          )}
        </div>
      </Modal>

      {/* New Task Modal */}
      <Modal open={showNewTask} onClose={() => setShowNewTask(false)} title="New Task">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.sm }}>Title</label>
            <input type="text" placeholder="What needs to be done?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus
              style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, fontSize: typography.fontSize.base, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.sm }}>Parent Task (optional)</label>
            <select
              value={parentTaskForNew}
              onChange={(e) => setParentTaskForNew(e.target.value)}
              style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, fontSize: typography.fontSize.base, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none' }}
              data-testid="parent-task-select"
            >
              <option value="">None — create as a top-level task</option>
              {rootTasks.map((t) => (
                <option key={t.uuid} value={t.uuid}>{t.title}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.sm }}>Priority</label>
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, fontSize: typography.fontSize.base, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none' }}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.sm }}>Assignee</label>
              <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}
                style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, fontSize: typography.fontSize.base, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none' }}>
                <option value="">Select...</option>
                {teamMembers.map((m: Record<string, unknown>) => (
                  <option key={String(m.id)} value={String(m.id)}>{String(m.name || m.full_name || m.email || m.id)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.sm }}>Description</label>
            <textarea placeholder="Add details..." rows={3}
              style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, fontSize: typography.fontSize.base, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          {/* Scheduling Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.lg }}>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.sm }}>Start Date</label>
              <input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)}
                style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, fontSize: typography.fontSize.base, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.sm }}>End Date</label>
              <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)}
                style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, fontSize: typography.fontSize.base, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.sm }}>Estimated Hours</label>
              <input type="number" min="0" step="0.5" placeholder="0" value={newEstimatedHours} onChange={(e) => setNewEstimatedHours(e.target.value)}
                style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, fontSize: typography.fontSize.base, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          {/* Working days display */}
          {newStartDate && newEndDate && workingDaysConfig && (
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginTop: `-${spacing.md}` }}>
              {countWorkingDays(new Date(newStartDate), new Date(newEndDate), workingDaysConfig)} working days between selected dates
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: typography.fontSize.sm, color: colors.textSecondary, cursor: 'pointer' }}>
              <input type="checkbox" checked={newScheduleManually} onChange={(e) => setNewScheduleManually(e.target.checked)} />
              Schedule manually
            </label>
          </div>

          {/* Dependencies Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>Dependencies</label>
              <button onClick={() => setShowAddDep(!showAddDep)} style={{ fontSize: typography.fontSize.xs, color: colors.primaryOrange, background: 'none', border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily }}>
                {showAddDep ? 'Cancel' : '+ Add Dependency'}
              </button>
            </div>
            {showAddDep && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px', gap: spacing.sm, alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs }}>Predecessor</label>
                  <select value={depPredecessorId} onChange={(e) => setDepPredecessorId(e.target.value)}
                    style={{ width: '100%', padding: `${spacing.sm} ${spacing.md}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.sm, outline: 'none' }}>
                    <option value="">Select task...</option>
                    {localTasks.map(t => (
                      <option key={t.uuid} value={t.uuid}>{t.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs }}>Type</label>
                  <select value={depRelationType} onChange={(e) => setDepRelationType(e.target.value as RelationType)}
                    style={{ width: '100%', padding: `${spacing.sm} ${spacing.md}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.sm, outline: 'none' }}>
                    <option value="follows">Follows</option>
                    <option value="blocks">Blocks</option>
                    <option value="relates">Relates</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs }}>Lag</label>
                  <input type="number" min="0" value={depLagDays} onChange={(e) => setDepLagDays(e.target.value)}
                    style={{ width: '100%', padding: `${spacing.sm} ${spacing.md}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.sm, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <Btn variant="secondary" size="sm" onClick={() => {
                  if (!depPredecessorId) { addToast('error', 'Select a predecessor task'); return; }
                  addToast('info', `Dependency will be created after task is saved`);
                  setShowAddDep(false);
                }}>Add</Btn>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.md }}>
            <Btn variant="ghost" size="md" onClick={() => setShowNewTask(false)}>Cancel</Btn>
            <Btn variant="primary" size="md" onClick={async () => {
              if (!newTitle.trim()) {
                addToast('error', 'Please enter a task title');
                return;
              }
              const member = teamMembers.find((m: Record<string, unknown>) => String(m.id) === newAssignee);
              const memberName = member ? String(member.name || member.full_name || member.email || '') : 'Unassigned';
              const assignee = { name: memberName, initials: memberName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'UA', company: member ? String(member.company || '') : '' };
              const newTask = {
                id: Date.now(),
                title: newTitle.trim(),
                description: '',
                status: 'todo' as const,
                priority: newPriority as 'low' | 'medium' | 'high' | 'critical',
                assignee,
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                tags: [] as string[],
                commentsCount: 0,
                attachmentsCount: 0,
                createdDate: new Date().toISOString().split('T')[0],
                subtasks: { total: 0, completed: 0 },
                linkedItems: [] as { type: string; id: string }[],
              };
              setLocalTasks([{ ...newTask, parent_task_id: parentTaskForNew || null } as typeof localTasks[0], ...localTasks]);
              const taskData: Record<string, unknown> = { project_id: projectId!, title: newTask.title, status: 'todo', priority: newPriority };
              if (parentTaskForNew) taskData.parent_task_id = parentTaskForNew;
              if (newStartDate) taskData.start_date = newStartDate;
              if (newEndDate) taskData.end_date = newEndDate;
              if (newEstimatedHours) taskData.estimated_hours = parseFloat(newEstimatedHours);
              if (newScheduleManually) taskData.schedule_manually = true;
              // Derive remaining_hours from estimated when creating
              if (newEstimatedHours) taskData.remaining_hours = parseFloat(newEstimatedHours);
              try {
                const result = await createTask.mutateAsync({
                  projectId: projectId!,
                  data: taskData,
                });
                // Create dependency relation if one was set
                if (depPredecessorId && result?.data?.id) {
                  try {
                    await createRelation.mutateAsync({
                      from_task_id: depPredecessorId,
                      to_task_id: String(result.data.id),
                      relation_type: depRelationType,
                      lag_days: parseInt(depLagDays) || 0,
                    });
                  } catch {
                    addToast('error', 'Task created but failed to add dependency');
                  }
                }
                addToast('success', `Task created: ${newTask.title}`);
              } catch {
                addToast('error', 'Failed to create task');
              }
              setShowNewTask(false);
              setNewTitle('');
              setNewPriority('medium');
              setNewAssignee('');
              setNewEstimatedHours('');
              setNewStartDate('');
              setNewEndDate('');
              setNewScheduleManually(false);
              setShowAddDep(false);
              setDepPredecessorId('');
              setDepRelationType('follows');
              setDepLagDays('0');
              setParentTaskForNew('');
            }}>Create Task</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
