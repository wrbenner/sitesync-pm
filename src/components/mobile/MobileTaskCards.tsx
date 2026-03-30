import React, { useState, useRef, useCallback } from 'react';
import { Check, MoreHorizontal, Clock, AlertTriangle, ChevronRight, User, Flag } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { useHaptics } from '../../hooks/useMobileCapture';

// ── Types ────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface MobileTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee?: string;
  assigneeInitials?: string;
  dueDate?: string;
  tags?: string[];
}

interface MobileTaskCardsProps {
  tasks: MobileTask[];
  onComplete: (taskId: string) => void;
  onTap: (taskId: string) => void;
  onAction: (taskId: string, action: 'edit' | 'reassign' | 'flag') => void;
}

// ── Constants ────────────────────────────────────────────

const SWIPE_COMPLETE_THRESHOLD = 100;
const SWIPE_ACTION_THRESHOLD = -80;

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: colors.statusCritical,
  high: colors.statusPending,
  medium: colors.statusInfo,
  low: colors.statusNeutral,
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: 'To Do', color: colors.textTertiary },
  in_progress: { label: 'In Progress', color: colors.statusInfo },
  in_review: { label: 'Review', color: colors.statusReview },
  done: { label: 'Done', color: colors.statusActive },
};

// ── Single Task Card ─────────────────────────────────────

const MobileTaskCard: React.FC<{
  task: MobileTask;
  onComplete: () => void;
  onTap: () => void;
  onAction: (action: 'edit' | 'reassign' | 'flag') => void;
}> = ({ task, onComplete, onTap, onAction }) => {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [completing, setCompleting] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const isHorizontal = useRef<boolean | null>(null);
  const { impact, notification } = useHaptics();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isHorizontal.current = null;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;

    // Determine swipe direction on first significant move
    if (isHorizontal.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (isHorizontal.current) {
      e.preventDefault();
      // Clamp: allow right swipe (complete) and left swipe (actions)
      setOffsetX(Math.max(-120, Math.min(160, dx)));

      // Haptic at threshold
      if (dx > SWIPE_COMPLETE_THRESHOLD && offsetX <= SWIPE_COMPLETE_THRESHOLD) {
        impact('medium');
      }
    }
  }, [swiping, offsetX, impact]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);

    if (offsetX > SWIPE_COMPLETE_THRESHOLD) {
      // Complete task
      setCompleting(true);
      notification('success');
      setTimeout(() => {
        onComplete();
        setCompleting(false);
        setOffsetX(0);
      }, 400);
      return;
    }

    if (offsetX < SWIPE_ACTION_THRESHOLD) {
      // Show actions (keep offset to reveal action buttons)
      setOffsetX(-120);
      return;
    }

    setOffsetX(0);
  }, [offsetX, onComplete, notification]);

  const statusConfig = STATUS_CONFIG[task.status];
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: borderRadius.lg, marginBottom: spacing['2'] }}>
      {/* Complete action (behind, left side) */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '160px',
        backgroundColor: colors.statusActive, display: 'flex', alignItems: 'center',
        paddingLeft: spacing['5'], gap: spacing['2'],
      }}>
        <Check size={24} color="white" />
        <span style={{ color: 'white', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold }}>
          Complete
        </span>
      </div>

      {/* Action buttons (behind, right side) */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '120px',
        display: 'flex', alignItems: 'stretch',
      }}>
        <button onClick={() => { onAction('edit'); setOffsetX(0); }} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.statusInfo, border: 'none', cursor: 'pointer', color: 'white',
        }}>
          <MoreHorizontal size={18} />
        </button>
        <button onClick={() => { onAction('reassign'); setOffsetX(0); }} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.statusPending, border: 'none', cursor: 'pointer', color: 'white',
        }}>
          <User size={18} />
        </button>
        <button onClick={() => { onAction('flag'); setOffsetX(0); }} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.statusCritical, border: 'none', cursor: 'pointer', color: 'white',
        }}>
          <Flag size={18} />
        </button>
      </div>

      {/* Card face */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (Math.abs(offsetX) < 5) onTap(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: spacing['4'],
          backgroundColor: completing ? colors.statusActiveSubtle : colors.surfaceRaised,
          boxShadow: shadows.card,
          borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : `transform ${transitions.quick}, background-color ${transitions.quick}`,
          cursor: 'pointer',
          touchAction: 'pan-y',
          minHeight: '72px',
        }}
      >
        {/* Status indicator */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          border: task.status === 'done' ? 'none' : `2px solid ${statusConfig.color}`,
          backgroundColor: task.status === 'done' ? colors.statusActive : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {task.status === 'done' && <Check size={14} color="white" />}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
            color: task.status === 'done' ? colors.textTertiary : colors.textPrimary,
            margin: 0, lineHeight: typography.lineHeight.snug,
            textDecoration: task.status === 'done' ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {task.title}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginTop: spacing['1'] }}>
            <span style={{
              fontSize: typography.fontSize.caption, color: statusConfig.color,
              fontWeight: typography.fontWeight.medium,
            }}>
              {statusConfig.label}
            </span>
            {task.dueDate && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: '2px',
                fontSize: typography.fontSize.caption,
                color: isOverdue ? colors.statusCritical : colors.textTertiary,
              }}>
                {isOverdue && <AlertTriangle size={10} />}
                <Clock size={10} /> {formatDate(task.dueDate)}
              </span>
            )}
            {task.tags?.map((tag) => (
              <span key={tag} style={{
                fontSize: '10px', padding: '1px 6px',
                backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full,
                color: colors.textTertiary,
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Assignee */}
        {task.assigneeInitials && (
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            backgroundColor: colors.surfaceInset, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: colors.textSecondary,
          }}>
            {task.assigneeInitials}
          </div>
        )}

        <ChevronRight size={16} color={colors.textTertiary} style={{ flexShrink: 0 }} />
      </div>
    </div>
  );
};

// ── Task List ────────────────────────────────────────────

export const MobileTaskCards: React.FC<MobileTaskCardsProps> = ({ tasks, onComplete, onTap, onAction }) => {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const { impact } = useHaptics();

  const filters: { id: TaskStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'Active' },
    { id: 'in_review', label: 'Review' },
    { id: 'done', label: 'Done' },
  ];

  const filteredTasks = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div>
      {/* Filter chips */}
      <div style={{
        display: 'flex', gap: spacing['2'], padding: `${spacing['3']} ${spacing['4']}`,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {filters.map((f) => {
          const count = f.id === 'all' ? tasks.length : tasks.filter((t) => t.status === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => { impact('light'); setFilter(f.id); }}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['2']} ${spacing['3']}`, minHeight: '40px',
                backgroundColor: filter === f.id ? colors.primaryOrange : colors.surfaceRaised,
                color: filter === f.id ? 'white' : colors.textSecondary,
                border: filter === f.id ? 'none' : `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.full, cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
              }}
            >
              {f.label}
              <span style={{
                fontSize: '10px', padding: '0 4px', minWidth: '16px', textAlign: 'center',
                borderRadius: borderRadius.full,
                backgroundColor: filter === f.id ? 'rgba(255,255,255,0.25)' : colors.surfaceInset,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Swipe hint (first time) */}
      <div style={{ padding: `0 ${spacing['4']} ${spacing['2']}`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
        Swipe right to complete, left for actions
      </div>

      {/* Task cards */}
      <div style={{ padding: `0 ${spacing['4']}` }}>
        {filteredTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: spacing['10'], color: colors.textTertiary }}>
            <Check size={32} style={{ marginBottom: spacing['3'], opacity: 0.3 }} />
            <p style={{ fontSize: typography.fontSize.body, margin: 0 }}>No tasks here</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <MobileTaskCard
              key={task.id}
              task={task}
              onComplete={() => onComplete(task.id)}
              onTap={() => onTap(task.id)}
              onAction={(action) => onAction(task.id, action)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
