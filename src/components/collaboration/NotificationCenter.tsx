import React, { useState } from 'react';
import { Bell, CheckCheck, X, ExternalLink, Inbox } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/queries';
import { useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/mutations';

const typeIcons: Record<string, string> = {
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

// ── Notification Bell with Badge ───────────────────────────

interface NotificationBellProps {
  onClick: () => void;
  isOpen: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onClick, isOpen }) => {
  const { user } = useAuth();
  const { data: notifications } = useNotifications(user?.id);
  const unreadCount = (notifications || []).filter(n => !n.read).length;

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
          fontSize: '10px', fontWeight: typography.fontWeight.semibold,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px',
          border: `2px solid ${colors.surfaceRaised}`,
          lineHeight: 1,
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

// ── Notification Panel (dropdown) ──────────────────────────

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
  const filtered = filter === 'unread' ? items.filter(n => !n.read) : items;
  const unreadCount = items.filter(n => !n.read).length;

  const handleMarkRead = (id: string) => {
    if (user?.id) markRead.mutate({ id, userId: user.id });
  };

  const handleMarkAllRead = () => {
    if (user?.id) markAllRead.mutate(user.id);
  };

  const handleClickNotification = (notification: any) => {
    handleMarkRead(notification.id);
    if (notification.link) {
      window.location.hash = `#${notification.link}`;
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />

      {/* Panel */}
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: spacing['1'],
        width: 380, maxHeight: '70vh',
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.dropdown,
        zIndex: 999, overflow: 'hidden',
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
                color: colors.primaryOrange, backgroundColor: colors.orangeSubtle,
                padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
              }}>{unreadCount}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} title="Mark all as read" style={{
                padding: spacing['1'], backgroundColor: 'transparent', border: 'none',
                borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textTertiary,
                display: 'flex', alignItems: 'center',
                transition: `color ${transitions.fast}`,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
              >
                <CheckCheck size={16} />
              </button>
            )}
            <button onClick={onClose} style={{
              padding: spacing['1'], backgroundColor: 'transparent', border: 'none',
              borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textTertiary,
              display: 'flex', alignItems: 'center',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: spacing['1'], padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
              fontWeight: filter === f ? typography.fontWeight.semibold : typography.fontWeight.medium,
              color: filter === f ? colors.textPrimary : colors.textTertiary,
              backgroundColor: filter === f ? colors.surfaceInset : 'transparent',
              border: 'none', borderRadius: borderRadius.full, cursor: 'pointer',
              textTransform: 'capitalize',
            }}>{f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}</button>
          ))}
        </div>

        {/* Notification list */}
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

          {filtered.slice(0, 50).map((notification: any) => (
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
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = notification.read ? 'transparent' : `${colors.primaryOrange}04`; }}
            >
              {/* Unread dot */}
              <div style={{ width: 8, paddingTop: 6, flexShrink: 0 }}>
                {!notification.read && (
                  <div style={{ width: 6, height: 6, borderRadius: borderRadius.full, backgroundColor: colors.primaryOrange }} />
                )}
              </div>

              {/* Icon */}
              <span style={{ fontSize: '16px', flexShrink: 0, marginTop: 1 }}>
                {typeIcons[notification.type] || '📌'}
              </span>

              {/* Content */}
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

              {/* Link indicator */}
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
