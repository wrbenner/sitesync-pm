import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Bell, HelpCircle, DollarSign, Sparkles, CheckSquare,
  ChevronRight, CheckCheck, ExternalLink, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { useNotificationStore, useUiStore } from '../../stores';
import type { Notification } from '../../stores/notificationStore';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/queries';
import { useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/mutations';

// ── Type Maps ────────────────────────────────────────────────

const typeIcons: Record<string, React.ReactNode> = {
  warning: <Sparkles size={14} />,
  info: <HelpCircle size={14} />,
  success: <CheckSquare size={14} />,
  error: <DollarSign size={14} />,
};

const typeColors: Record<string, string> = {
  warning: colors.statusPending,
  info: colors.statusInfo,
  success: colors.statusActive,
  error: colors.statusCritical,
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

// ── Helpers ──────────────────────────────────────────────────

function groupByTime(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const now = Date.now();
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const week: Notification[] = [];
  const older: Notification[] = [];

  notifications.forEach((n) => {
    const diff = now - n.timestamp.getTime();
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

function formatRelTime(timestamp: Date): string {
  const diff = Date.now() - timestamp.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatRelativeTime(dateStr: string): string {
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

// ── NotificationList (mobile-optimized, embeddable) ─────────

interface NotificationListProps {
  onNavigate?: (route: string) => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({ onNavigate }) => {
  const { notifications, markRead } = useNotificationStore();
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
    if (offset < -40) {
      markRead(id);
    }
    setSwipeOffsets((prev) => ({ ...prev, [id]: 0 }));
  };

  if (notifications.length === 0) {
    return (
      <div style={{ padding: spacing['8'], textAlign: 'center', color: colors.textTertiary }}>
        <Bell size={32} style={{ marginBottom: spacing['2'], opacity: 0.3 }} />
        <p style={{ fontSize: typography.fontSize.sm, margin: 0 }}>No notifications</p>
      </div>
    );
  }

  return (
    <div>
      {notifications.map((n) => {
        const color = typeColors[n.type] || colors.textSecondary;
        const offset = swipeOffsets[n.id] || 0;

        return (
          <div key={n.id} style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Swipe-left action background */}
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

            {/* Row */}
            <div
              onTouchStart={(e) => handleRowTouchStart(n.id, e)}
              onTouchMove={(e) => handleRowTouchMove(n.id, e)}
              onTouchEnd={() => handleRowTouchEnd(n.id)}
              onClick={() => {
                markRead(n.id);
                if (n.actionRoute) onNavigate?.(n.actionRoute);
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
              {/* Unread dot */}
              <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                backgroundColor: n.read ? 'transparent' : colors.primaryOrange,
              }} />

              {/* Type icon */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                backgroundColor: `${color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color }}>{typeIcons[n.type]}</span>
              </div>

              {/* Content */}
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
                }}>{formatRelTime(n.timestamp)}</p>
              </div>

              {/* Chevron */}
              {n.actionRoute && (
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
  const { notifications, markRead, markAllRead, dismiss } = useNotificationStore();
  const groups = groupByTime(notifications);

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
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${spacing['3']} ${spacing['4']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Bell size={16} color={colors.textPrimary} />
                <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Notifications</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <button
                  onClick={markAllRead}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['1'],
                    padding: `${spacing['1']} ${spacing['2']}`,
                    backgroundColor: 'transparent', border: 'none',
                    borderRadius: borderRadius.sm, cursor: 'pointer',
                    color: colors.textTertiary, fontSize: typography.fontSize.caption,
                    fontFamily: typography.fontFamily,
                  }}
                >
                  <Check size={12} /> Mark all read
                </button>
                <button
                  onClick={onClose}
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

            {/* Notifications */}
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
                    const color = typeColors[n.type] || colors.textSecondary;
                    return (
                      <div
                        key={n.id}
                        onClick={() => markRead(n.id)}
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
                          <span style={{ color }}>{typeIcons[n.type]}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: typography.fontSize.sm, fontWeight: n.read ? typography.fontWeight.normal : typography.fontWeight.medium, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.snug }}>{n.title}</p>
                          {n.message && (
                            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</p>
                          )}
                          <p style={{ fontSize: '10px', color: colors.textTertiary, margin: 0, marginTop: 2 }}>
                            {Math.floor((Date.now() - n.timestamp.getTime()) / 3600000)}h ago
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                          style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textTertiary, opacity: 0.4, flexShrink: 0 }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}

              {notifications.length === 0 && (
                <div style={{ padding: spacing['8'], textAlign: 'center', color: colors.textTertiary }}>
                  <Bell size={24} style={{ marginBottom: spacing['2'], opacity: 0.3 }} />
                  <p style={{ fontSize: typography.fontSize.sm, margin: 0 }}>No notifications</p>
                </div>
              )}
            </div>
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
  const { data: notifications } = useNotifications(user?.id);
  const unreadCount = (notifications || []).filter((n: unknown) => !n.read).length;
  const announceStatus = useUiStore(s => s.announceStatus);
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip the initial mount; only announce genuine changes
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
  const { data: notifications, isPending: loading } = useNotifications(user?.id);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const items = notifications || [];
  const filtered = filter === 'unread' ? items.filter((n: unknown) => !n.read) : items;
  const unreadCount = items.filter((n: unknown) => !n.read).length;

  const handleMarkRead = (id: string) => {
    if (user?.id) markRead.mutate({ id, userId: user.id });
  };

  const handleMarkAllRead = () => {
    if (user?.id) markAllRead.mutate(user.id);
  };

  const handleClickNotification = (notification: unknown) => {
    handleMarkRead(notification.id);
    if (notification.link) {
      window.location.assign(`#${notification.link}`);
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
        {/* Header */}
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
                style={{
                  padding: spacing['1'], backgroundColor: 'transparent', border: 'none',
                  borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textTertiary,
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

        {/* Filter tabs */}
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

        {/* List */}
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
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
            </div>
          )}

          {filtered.slice(0, 50).map((notification: unknown) => (
            <div
              key={notification.id}
              onClick={() => handleClickNotification(notification)}
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
                {remoteTypeIcons[notification.type] || '📌'}
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
              {notification.link && (
                <ExternalLink size={12} color={colors.textTertiary} style={{ marginTop: 4, flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
