import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText, MessageSquare, AlertCircle, CheckCircle2,
  DollarSign, Calendar, Shield,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useActivityFeed } from '../../hooks/queries';
import type { LucideIcon } from 'lucide-react';

// ── Icon mapping ───────────────────────────────────────

const TYPE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  rfi: { icon: MessageSquare, color: colors.statusInfo },
  submittal: { icon: FileText, color: colors.statusReview },
  change_order: { icon: DollarSign, color: colors.statusPending },
  punch_item: { icon: AlertCircle, color: colors.statusCritical },
  punch_list_item: { icon: AlertCircle, color: colors.statusCritical },
  daily_log: { icon: Calendar, color: colors.textTertiary },
  safety: { icon: Shield, color: colors.statusCritical },
  task: { icon: CheckCircle2, color: colors.statusActive },
  drawing: { icon: FileText, color: colors.statusInfo },
  meeting: { icon: Calendar, color: colors.statusReview },
};

const DEFAULT_ICON = { icon: FileText, color: colors.textTertiary };

// ── Entity type → route ────────────────────────────────

const ENTITY_ROUTES: Record<string, string> = {
  rfi: '/rfis',
  submittal: '/submittals',
  change_order: '/change-orders',
  punch_item: '/punch-list',
  punch_list_item: '/punch-list',
  daily_log: '/daily-log',
  task: '/schedule',
  drawing: '/drawings',
  meeting: '/meetings',
  safety: '/safety',
};

// ── Relative time ──────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Verb formatting ────────────────────────────────────

function formatVerb(verb: string): string {
  // Convert snake_case verbs to readable text
  return verb
    .replace(/_/g, ' ')
    .replace(/^(rfi|submittal|punch|change order|daily log|task|drawing|meeting)\s*/i, '')
    .trim() || 'updated';
}

// ── Component ──────────────────────────────────────────

export const DashboardActivityFeed: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const { data: activities } = useActivityFeed(projectId);

  const items = useMemo(() => (activities ?? []).slice(0, 6), [activities]);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.18 }}
      style={{ marginBottom: spacing['6'] }}
    >
      <h3 style={{
        margin: 0,
        marginBottom: spacing['3'],
        fontSize: typography.fontSize.body,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
      }}>
        Recent activity
      </h3>

      <div style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadows.card,
        overflow: 'hidden',
      }}>
        {items.map((item, i) => {
          const { icon: Icon, color: iconColor } = TYPE_ICONS[item.entityType] ?? DEFAULT_ICON;
          const isLast = i === items.length - 1;
          const route = ENTITY_ROUTES[item.entityType];

          return (
            <button
              key={item.id}
              onClick={route ? () => navigate(route) : undefined}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: spacing['3'],
                padding: `${spacing['3']} ${spacing['4']}`,
                borderBottom: isLast ? 'none' : `1px solid ${colors.borderSubtle}`,
                background: 'none',
                border: isLast ? 'none' : undefined,
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                width: '100%',
                textAlign: 'left',
                fontFamily: typography.fontFamily,
                cursor: route ? 'pointer' : 'default',
                transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={route ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; } : undefined}
              onMouseLeave={route ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; } : undefined}
            >
              {/* Timeline dot */}
              <div style={{
                width: 28,
                height: 28,
                borderRadius: borderRadius.full,
                backgroundColor: colors.surfaceInset,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}>
                <Icon size={13} color={iconColor} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontSize: typography.fontSize.sm,
                  color: colors.textPrimary,
                  lineHeight: typography.lineHeight.tight,
                }}>
                  <span style={{ fontWeight: typography.fontWeight.medium }}>{item.actorName}</span>
                  {' '}
                  <span style={{ color: colors.textSecondary }}>{formatVerb(item.verb)}</span>
                  {item.entityLabel && (
                    <>
                      {' '}
                      <span style={{ fontWeight: typography.fontWeight.medium }}>{item.entityLabel}</span>
                    </>
                  )}
                </p>
              </div>

              {/* Time */}
              <span style={{
                fontSize: typography.fontSize.caption,
                color: colors.textTertiary,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {relativeTime(item.createdAt)}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
});
DashboardActivityFeed.displayName = 'DashboardActivityFeed';
