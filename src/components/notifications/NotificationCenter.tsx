import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Bell, HelpCircle, DollarSign, Sparkles, CheckSquare,
  ChevronRight, CheckCheck, ExternalLink, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { useUiStore } from '../../stores';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications, useUnreadCount } from '../../hooks/queries/notifications';
import { useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/mutations/notifications';
import type { Notification } from '../../types/database';

// ── Type Maps ────────────────────────────────────────────────

const typeIcons: Record<string, React.ReactNode> = {
  warning: <Sparkles size={14} />,
  info: <HelpCircle size={14} />,
  success: <CheckSquare size={14} />,
  error: <DollarSign size={14} />,
  rfi_assigned: <HelpCircle size={14} />,
  submittal_review: <HelpCircle size={14} />,
  punch_item: <CheckSquare size={14} />,
  task_update: <CheckSquare size={14} />,
  meeting_reminder: <HelpCircle size={14} />,
  ai_alert: <Sparkles size={14} />,
  daily_log_approval: <CheckSquare size={14} />,
};

const typeColors: Record<string, string> = {
  warning: colors.statusPending,
  info: colors.statusInfo,
  success: colors.statusActive,
  error: colors.statusCritical,
  rfi_assigned: colors.statusInfo,
  submittal_review: colors.statusInfo,
  punch_item: colors.statusPending,
  task_update: colors.statusActive,
  meeting_reminder: colors.statusInfo,
  ai_alert: colors.statusCritical,
  daily_log_approval: colors.statusActive,
};

const remoteTypeIcons: Record<string, string> = {
  rfi_assigned: '📋',
  submittal_review: '📑',
  punch_item: '🔨',
  task_update: '✅',
  meeting_reminder: '📅',
  ai_alert: '🤖',
  daily_log_approval: '📝',
  weekly_digest: '📊',
  mention: '💬',
  status_change: '🔄',
  approval_needed: '⚡',
  overdue: '⏰',
};

// ── Click-through routing ────────────────────────────────────
// Maps a notification's entity_type + entity_id to an in-app route.
// Returns null when there's no matching detail route, in which case the
// caller should fall back to the row's `link` field.

function routeForNotification(n: Notification): string | null {
  if (n.entity_type && n.entity_id) {
    switch (n.entity_type) {
      case 'rfi':
        return `/rfis/${n.entity_id}`;
      case 'submittal':
        return `/submittals/${n.entity_id}`;
      case 'punch_item':
        return `/punch-list/${n.entity_id}`;
      case 'change_order':
        // No per-item detail route exists; land on the list and let the
        // user filter from there.
        return '/change-orders';
    }
  }
  return n.link ?? null;
}

// ── Helpers ──────────────────────────────────────────────────

function groupByTime(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const now = Date.now();
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const week: Notification[] = [];
  const older: Notification[] = [];

  notifications.forEach((n) => {
    const ts = n.created_at ? new Date(n.created_at).getTime() : now;
    const diff = now - ts;
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) today.push(n);
    else if (hours < 48) yesterday.push(n);
    else if (hours < 168) week.push(n);
    else older.push(n);
  });

  const groups: { label: string; items: Notification[] }[] = [];
  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (week.length) groups.push({ label: 'This Week', items: week });
  if (older.length) groups.push({ label: 'Older', items: older });
  return groups;
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const EMPTY_LIST: Notification[] = [];

// ── NotificationList (mobile-optimized, embeddable) ─────────

interface NotificationListProps {
  onNavigate?: (route: string) => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { data, isLoading } = useNotifications(user?.id, { pageSize: 50 });
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();

  const notifications = data?.data ?? EMPTY_LIST;
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const rowTouchStart = useRef<Record<string, { x: number; y: number }>>({});

  const handleRowTouchStart = (id: string, e: React.TouchEvent) => {
    rowTouchStart.current[id] = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleRowTouchMove = (id: string, e: React.TouchEvent) => {
    const start = rowTouchStart.current[id];
    if (!start) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = Math.abs(e.touches[0].clientY - start.y);
    if (dy > 20) return;
    if (dx < 0) {
      setSwipeOffsets((prev) => ({ ...prev, [id]: Math.max(dx, -80) }));
    }
  };

  const handleRowTouchEnd = (id: string) => {
    const offset = swipeOffsets[id] || 0;
    if (offset < -40 && user?.id) {
      markRead.mutate({ id, userId: user.id });
    }
    setSwipeOffsets((prev) => ({ ...prev, [id]: 0 }));
  };

  const handleClick = (n: Notification) => {
    if (user?.id && !n.read) {
      markRead.mutate({ id: n.id, userId: user.id });
    }
    const route = routeForNotification(n);
    if (route) {
      if (onNavigate) onNavigate(route);
      else navigate(route);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: spacing['8'], textAlign: 'center', color: colors.textTertiary }}>
        <p style={{ fontSize: typography.fontSize.sm, margin: 0 }}>Loading notifications…</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div style={{ padding: spacing['8'], textAlign: 'center', color: colors.textTertiary }}>
        <Bell size={32} style={{ marginBottom: spacing['2'], opacity: 0.3 }} />
        <p style={{ fontSize: typography.fontSize.sm, margin: 0 }}>You&apos;re all caught up</p>
      </div>
    );
  }

  return (
    <div>
      {notifications.map((n) => {
        const typeKey = n.type ?? 'info';
        const color = typeColors[typeKey] || colors.textSecondary;
        const offset = swipeOffsets[n.id] || 0;
        const route = routeForNotification(n);

        return (
          <div key={n.id} style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
              backgroundColor: colors.primaryOrange,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                color: colors.white, fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
              }}>Read</span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onTouchStart={(e) => handleRowTouchStart(n.id, e)}
              onTouchMove={(e) => handleRowTouchMove(n.id, e)}
              onTouchEnd={() => handleRowTouchEnd(n.id)}
              onClick={() => handleClick(n)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick(n);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: `0 ${spacing['4']}`,
                minHeight: '64px',
                backgroundColor: n.read ? colors.surfaceRaised : `${colors.primaryOrange}06`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                cursor: 'pointer',
                transform: `translateX(${offset}px)`,
                transition: offset === 0 ? `transform 0.2s ease` : 'none',
              }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                backgroundColor: n.read ? 'transparent' : colors.primaryOrange,
              }} />

              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                backgroundColor: `${color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color }}>{typeIcons[typeKey] ?? <Bell size={14} />}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: typography.fontSize.body, margin: 0,
                  lineHeight: typography.lineHeight.snug,
                  fontWeight: n.read ? typography.fontWeight.normal : typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{n.title}</p>
                <p style={{
                  fontSize: typography.fontSize.caption, color: colors.textTertiary,
                  margin: '2px 0 0',
                }}>{formatRelativeTime(n.created_at)}</p>
              </div>

              {route && (
                <ChevronRight size={16} color={colors.textTertiary} style={{ flexShrink: 0 }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── NotificationCenter (desktop dropdown overlay) ───────────

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ open, onClose }) => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data } = useNotifications(user?.id, { page, pageSize: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  // Reset to first page whenever the panel reopens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state or loading state; no external system sync
    if (open) setPage(1);
  }, [open]);

  const notifications = data?.data ?? EMPTY_LIST;
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const groups = useMemo(() => groupByTime(notifications), [notifications]);

  const handleMarkRead = (id: string) => {
    if (user?.id) markRead.mutate({ id, userId: user.id });
  };

  const handleClick = (n: Notification) => {
    if (user?.id && !n.read) {
      markRead.mutate({ id: n.id, userId: user.id });
    }
    const route = routeForNotification(n);
    if (route) {
      navigate(route);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: zIndex.dropdown as number - 1 }} />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed', top: 60, right: 24,
              width: '380px', maxWidth: '90vw', maxHeight: '80vh',
              backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
              boxShadow: shadows.panel, zIndex: zIndex.dropdown as number,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${spacing['3']} ${spacing['4']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Bell size={16} color={colors.textPrimary} />
                <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Notifications</span>
                {total > 0 && (
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    ({total})
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <button
                  onClick={() => { if (user?.id) markAllRead.mutate(user.id); }}
                  disabled={markAllRead.isPending}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['1'],
                    padding: `${spacing['1']} ${spacing['2']}`,
                    backgroundColor: 'transparent', border: 'none',
                    borderRadius: borderRadius.sm, cursor: markAllRead.isPending ? 'not-allowed' : 'pointer',
                    color: colors.textTertiary, fontSize: typography.fontSize.caption,
                    fontFamily: typography.fontFamily,
                  }}
                >
                  <Check size={12} /> Mark all read
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'transparent', border: 'none',
                    borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textTertiary,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {groups.map((group) => (
                <div key={group.label}>
                  <p style={{
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                    color: colors.textTertiary, textTransform: 'uppercase',
                    letterSpacing: typography.letterSpacing.wider,
                    padding: `${spacing['2']} ${spacing['4']}`, margin: 0,
                    backgroundColor: colors.surfaceInset,
                  }}>
                    {group.label}
                  </p>
                  {group.items.map((n) => {
                    const typeKey = n.type ?? 'info';
                    const color = typeColors[typeKey] || colors.textSecondary;
                    return (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleClick(n)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(n); } }}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
                          padding: `${spacing['3']} ${spacing['4']}`,
                          backgroundColor: n.read ? 'transparent' : `${colors.primaryOrange}03`,
                          borderBottom: `1px solid ${colors.borderSubtle}`,
                          cursor: 'pointer', transition: `background-color ${transitions.instant}`,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = n.read ? 'transparent' : `${colors.primaryOrange}03`; }}
                      >
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: n.read ? 'transparent' : colors.primaryOrange, marginTop: 6, flexShrink: 0 }} />
                        <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color }}>{typeIcons[typeKey] ?? <Bell size={14} />}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: typography.fontSize.sm, fontWeight: n.read ? typography.fontWeight.normal : typography.fontWeight.medium, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.snug }}>{n.title}</p>
                          {n.body && (
                            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>
                          )}
                          <p style={{ fontSize: '10px', color: colors.textTertiary, margin: 0, marginTop: 2 }}>
                            {formatRelativeTime(n.created_at)}
                          </p>
                        </div>
                        {!n.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                            aria-label="Mark as read"
                            style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textTertiary, opacity: 0.6, flexShrink: 0 }}
                          >
                            <Check size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {notifications.length === 0 && (
                <div style={{ padding: spacing['8'], textAlign: 'center', color: colors.textTertiary }}>
                  <Inbox size={28} style={{ marginBottom: spacing['2'], opacity: 0.3 }} />
                  <p style={{ fontSize: typography.fontSize.sm, margin: 0 }}>You&apos;re all caught up</p>
                </div>
              )}
            </div>

            {/* Pagination footer */}
            {(page > 1 || hasMore) && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: `${spacing['2']} ${spacing['4']}`,
                borderTop: `1px solid ${colors.borderSubtle}`, flexShrink: 0,
                backgroundColor: colors.surfaceInset,
              }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    fontSize: typography.fontSize.caption, color: colors.textTertiary,
                    backgroundColor: 'transparent', border: 'none',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 ? 0.4 : 1,
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  Page {page}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore}
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: hasMore ? colors.orangeText : colors.textTertiary,
                    backgroundColor: 'transparent', border: 'none',
                    cursor: hasMore ? 'pointer' : 'not-allowed',
                    opacity: hasMore ? 1 : 0.4,
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ── NotificationBell (used by TopBar) ───────────────────────

interface NotificationBellProps {
  onClick: () => void;
  isOpen: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onClick, isOpen }) => {
  const { user } = useAuth();
  const { data: unreadCount = 0 } = useUnreadCount(user?.id);
  const announceStatus = useUiStore(s => s.announceStatus);
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevUnreadRef.current !== null && prevUnreadRef.current !== unreadCount) {
      announceStatus(`You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, announceStatus]);

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        width: 36, height: 36,
        backgroundColor: isOpen ? colors.surfaceFlat : 'transparent',
        border: 'none',
        borderRadius: borderRadius.md,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: `background-color ${transitions.fast}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat; }}
      onMouseLeave={(e) => { if (!isOpen) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell size={18} color={unreadCount > 0 ? colors.textPrimary : colors.textSecondary} />
      {unreadCount > 0 && (
        <span style={{
          position: 'absolute', top: 4, right: 4,
          minWidth: 16, height: 16,
          backgroundColor: colors.primaryOrange, color: colors.white,
          borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: `0 ${spacing['1']}`,
          border: `2px solid ${colors.surfaceRaised}`,
          lineHeight: 1,
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

// ── NotificationPanel (dropdown, used by TopBar) ────────────

interface NotificationPanelProps {
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, isPending: loading } = useNotifications(user?.id, { page, pageSize: 20 });
  const { data: unreadCount = 0 } = useUnreadCount(user?.id);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const items = data?.data ?? EMPTY_LIST;
  const filtered = filter === 'unread' ? items.filter((n) => !n.read) : items;
  const hasMore = data?.hasMore ?? false;

  const handleMarkRead = (id: string) => {
    if (user?.id) markRead.mutate({ id, userId: user.id });
  };

  const handleMarkAllRead = () => {
    if (user?.id) markAllRead.mutate(user.id);
  };

  const handleClickNotification = (n: Notification) => {
    if (!n.read) handleMarkRead(n.id);
    const route = routeForNotification(n);
    if (route) {
      navigate(route);
      onClose();
    }
  };

  return (
    <>
      <div onClick={onClose} role="presentation" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: zIndex.dropdown as number }} />
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: spacing['1'],
        width: 380, maxHeight: '70vh',
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.dropdown,
        zIndex: (zIndex.dropdown as number) + 1, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['3']} ${spacing['4']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                color: colors.orangeText, backgroundColor: colors.orangeSubtle,
                padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
              }}>{unreadCount}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                title="Mark all as read"
                aria-label="Mark all as read"
                disabled={markAllRead.isPending}
                style={{
                  padding: spacing['1'], backgroundColor: 'transparent', border: 'none',
                  borderRadius: borderRadius.sm, cursor: markAllRead.isPending ? 'not-allowed' : 'pointer',
                  color: colors.textTertiary,
                  display: 'flex', alignItems: 'center',
                  transition: `color ${transitions.fast}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
              >
                <CheckCheck size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                padding: spacing['1'], backgroundColor: 'transparent', border: 'none',
                borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textTertiary,
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: spacing['1'], padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          {(['all', 'unread'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
              fontWeight: filter === f ? typography.fontWeight.semibold : typography.fontWeight.medium,
              color: filter === f ? colors.textPrimary : colors.textTertiary,
              backgroundColor: filter === f ? colors.surfaceInset : 'transparent',
              border: 'none', borderRadius: borderRadius.full, cursor: 'pointer',
              textTransform: 'capitalize',
            }}>
              {f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: spacing['6'], textAlign: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Loading...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: spacing['6'], textAlign: 'center' }}>
              <Inbox size={32} color={colors.textTertiary} style={{ marginBottom: spacing['2'] }} />
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
                {filter === 'unread' ? 'No unread notifications' : "You're all caught up"}
              </p>
            </div>
          )}

          {filtered.map((notification) => {
            const route = routeForNotification(notification);
            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => handleClickNotification(notification)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClickNotification(notification); } }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
                  padding: `${spacing['3']} ${spacing['4']}`,
                  backgroundColor: notification.read ? 'transparent' : `${colors.primaryOrange}04`,
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                  cursor: 'pointer',
                  transition: `background-color ${transitions.fast}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = notification.read ? 'transparent' : `${colors.primaryOrange}04`; }}
              >
                <div style={{ width: 8, paddingTop: 6, flexShrink: 0 }}>
                  {!notification.read && (
                    <div style={{ width: 6, height: 6, borderRadius: borderRadius.full, backgroundColor: colors.primaryOrange }} />
                  )}
                </div>
                <span style={{ fontSize: typography.fontSize.title, flexShrink: 0, marginTop: 1 }}>
                  {remoteTypeIcons[notification.type ?? ''] || '📌'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: typography.fontSize.sm, color: colors.textPrimary,
                    fontWeight: notification.read ? typography.fontWeight.normal : typography.fontWeight.medium,
                    margin: 0, lineHeight: typography.lineHeight.snug,
                  }}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p style={{
                      fontSize: typography.fontSize.caption, color: colors.textTertiary,
                      margin: `${spacing['1']} 0 0`, lineHeight: typography.lineHeight.normal,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {notification.body}
                    </p>
                  )}
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'], display: 'block' }}>
                    {formatRelativeTime(notification.created_at)}
                  </span>
                </div>
                {route && (
                  <ExternalLink size={12} color={colors.textTertiary} style={{ marginTop: 4, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination footer */}
        {(page > 1 || hasMore) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${spacing['2']} ${spacing['4']}`,
            borderTop: `1px solid ${colors.borderSubtle}`,
            backgroundColor: colors.surfaceInset,
          }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                fontSize: typography.fontSize.caption, color: colors.textTertiary,
                backgroundColor: 'transparent', border: 'none',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.4 : 1,
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Page {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              style={{
                fontSize: typography.fontSize.caption,
                color: hasMore ? colors.orangeText : colors.textTertiary,
                backgroundColor: 'transparent', border: 'none',
                cursor: hasMore ? 'pointer' : 'not-allowed',
                opacity: hasMore ? 1 : 0.4,
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
};
