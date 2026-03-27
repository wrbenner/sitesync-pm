import React from 'react';
import { X, Check, Bell, HelpCircle, DollarSign, Sparkles, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { useNotificationStore } from '../../stores';
import type { Notification } from '../../stores/notificationStore';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Bell size={16} color={colors.textPrimary} />
                <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Notifications</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <button
                  onClick={markAllRead}
                  style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily }}
                >
                  <Check size={12} /> Mark all read
                </button>
                <button onClick={onClose} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textTertiary }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {groups.map((group) => (
                <div key={group.label}>
                  <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, padding: `${spacing['2']} ${spacing['4']}`, margin: 0, backgroundColor: colors.surfaceInset }}>
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
                        {/* Unread dot */}
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: n.read ? 'transparent' : colors.primaryOrange, marginTop: 6, flexShrink: 0 }} />

                        {/* Icon */}
                        <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color }}>{typeIcons[n.type]}</span>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: typography.fontSize.sm, fontWeight: n.read ? typography.fontWeight.normal : typography.fontWeight.medium, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.snug }}>{n.title}</p>
                          {n.message && (
                            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</p>
                          )}
                          <p style={{ fontSize: '10px', color: colors.textTertiary, margin: 0, marginTop: 2 }}>
                            {Math.floor((Date.now() - n.timestamp.getTime()) / 3600000)}h ago
                          </p>
                        </div>

                        {/* Dismiss */}
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
