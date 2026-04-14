import React, { useMemo } from 'react';
import { Activity, User } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useActivityFeed } from '../../../hooks/queries';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatVerb(verb: string): string {
  const verbMap: Record<string, string> = {
    rfi: 'updated RFI',
    submittal: 'updated submittal',
    punch_item: 'updated punch item',
    change_order: 'updated change order',
    daily_log: 'logged daily report',
    task: 'updated task',
    drawing: 'uploaded drawing',
    meeting: 'scheduled meeting',
    comment: 'commented',
    created: 'created',
    updated: 'updated',
    deleted: 'removed',
    approved: 'approved',
    rejected: 'rejected',
    submitted: 'submitted',
    closed: 'closed',
  };
  return verbMap[verb] || verb;
}

export const ActivityFeedWidget: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const { data: activities, isPending } = useActivityFeed(projectId);

  const recentItems = useMemo(() => {
    if (!activities) return [];
    return activities.slice(0, 10);
  }, [activities]);

  if (isPending) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
          <Activity size={16} color={colors.primaryOrange} />
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Recent Activity
          </span>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['3'], opacity: 0.4 }}>
            <div style={{ width: 28, height: 28, borderRadius: borderRadius.full, backgroundColor: colors.surfaceInset }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: '70%', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base, marginBottom: 4 }} />
              <div style={{ height: 10, width: '40%', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recentItems.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
          <Activity size={16} color={colors.primaryOrange} />
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Recent Activity
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
          No recent activity yet. Actions taken on this project will appear here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <Activity size={16} color={colors.primaryOrange} />
        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          Recent Activity
        </span>
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>
          Live
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {recentItems.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              gap: spacing['2'],
              padding: `${spacing['2']} 0`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
            }}
          >
            {item.actorAvatar ? (
              <img
                src={item.actorAvatar}
                alt=""
                style={{ width: 28, height: 28, borderRadius: borderRadius.full, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 28,
                height: 28,
                borderRadius: borderRadius.full,
                backgroundColor: colors.primaryOrange,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <User size={14} color={colors.white} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0,
                fontSize: typography.fontSize.caption,
                color: colors.textPrimary,
                lineHeight: typography.lineHeight.normal,
              }}>
                <span style={{ fontWeight: typography.fontWeight.semibold }}>{item.actorName}</span>
                {' '}{formatVerb(item.verb)}
                {item.entityLabel ? (
                  <span style={{ color: colors.primaryOrange, fontWeight: typography.fontWeight.medium }}>
                    {' '}{item.entityLabel}
                  </span>
                ) : null}
              </p>
              <p style={{
                margin: 0,
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 1,
              }}>
                {formatRelativeTime(item.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

ActivityFeedWidget.displayName = 'ActivityFeedWidget';
