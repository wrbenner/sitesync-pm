import React, { useState, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Card, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { ActivityCard } from '../components/activity/ActivityCard';
import type { ActivityItem } from '../components/activity/ActivityCard';
import { MentionInput } from '../components/activity/MentionInput';
import { useProjectId } from '../hooks/useProjectId';
import { useRealtimeActivityFeed } from '../hooks/queries/realtime';
import { insertActivity, notifyMentionedUsers } from '../api/endpoints/activity';
import type { ActivityFeedItem } from '../types/entities';

type FilterType = 'all' | 'rfi' | 'submittal' | 'photo' | 'task' | 'budget' | 'schedule';

const filterOptions: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'rfi', label: 'RFIs' },
  { id: 'submittal', label: 'Submittals' },
  { id: 'photo', label: 'Photos' },
  { id: 'task', label: 'Tasks' },
  { id: 'budget', label: 'Budget' },
  { id: 'schedule', label: 'Schedule' },
];

/** Maps entity type to the app route for detail navigation. */
function resolveEntityPath(entityType: string): string | undefined {
  switch (entityType) {
    case 'rfi': return '/rfis';
    case 'submittal': return '/submittals';
    case 'change_order': return '/change-orders';
    case 'task': return '/tasks';
    case 'punch': return '/punch-list';
    case 'daily_log': return '/daily-log';
    case 'budget': return '/budget';
    case 'schedule': return '/schedule';
    case 'photo': return '/field-capture';
    default: return undefined;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function mapFeedItem(item: ActivityFeedItem): ActivityItem {
  const meta = item.metadata;
  return {
    id: item.id,
    type: item.entityType || 'task',
    user: item.actorName,
    userInitials: getInitials(item.actorName),
    actorAvatar: item.actorAvatar,
    action: item.verb,
    target: item.entityLabel || (meta.title as string) || '',
    entityPath: item.entityId ? resolveEntityPath(item.entityType) : undefined,
    timestamp: new Date(item.createdAt),
    preview: (meta.body as string) || undefined,
    commentCount: typeof meta.comment_count === 'number' ? meta.comment_count : undefined,
  };
}

/** Mark consecutive items from the same actor within 5 minutes as grouped. */
function applyGrouping(items: ActivityItem[]): ActivityItem[] {
  return items.map((item, i) => {
    if (i === 0) return item;
    const prev = items[i - 1];
    const sameActor = prev.user === item.user;
    const withinWindow = Math.abs(item.timestamp.getTime() - prev.timestamp.getTime()) <= 5 * 60 * 1000;
    return sameActor && withinWindow ? { ...item, isGrouped: true } : item;
  });
}

function groupByTime(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const now = Date.now();
  const today: ActivityItem[] = [];
  const yesterday: ActivityItem[] = [];
  const earlier: ActivityItem[] = [];

  items.forEach(item => {
    const hours = (now - item.timestamp.getTime()) / (1000 * 60 * 60);
    if (hours < 24) today.push(item);
    else if (hours < 48) yesterday.push(item);
    else earlier.push(item);
  });

  const groups: { label: string; items: ActivityItem[] }[] = [];
  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier });
  return groups;
}

export const Activity: React.FC = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const projectId = useProjectId();
  const { data: rawActivities } = useRealtimeActivityFeed(projectId);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [following, setFollowing] = useState<Set<string>>(new Set(['rfi', 'task']));
  const [readItems, setReadItems] = useState<Set<string>>(new Set());

  const activities = useMemo(
    () => (rawActivities ?? []).map(mapFeedItem),
    [rawActivities]
  );

  const filtered = activeFilter === 'all'
    ? activities
    : activities.filter((a) => a.type === activeFilter);

  const withGrouping = useMemo(() => applyGrouping(filtered), [filtered]);
  const unreadCount = withGrouping.filter(i => !readItems.has(i.id)).length;
  const grouped = groupByTime(withGrouping);

  return (
    <PageContainer title="Activity" subtitle="Everything happening on Meridian Tower">
      {/* Post input */}
      <Card padding={spacing['4']}>
        <MentionInput
          onSend={async (text, mentionedUserIds) => {
            if (!projectId) return;
            try {
              const activityId = await insertActivity(projectId, {
                type: 'comment',
                title: text,
                body: text,
              });
              if (mentionedUserIds.length > 0) {
                await notifyMentionedUsers(mentionedUserIds, activityId, projectId);
              }
              addToast('success', 'Posted to activity feed');
            } catch {
              addToast('error', 'Failed to post comment');
            }
          }}
          placeholder="Share an update with the team... Use @ to mention someone"
          projectId={projectId}
        />
      </Card>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], marginTop: spacing['4'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
          {filterOptions.map((f) => (
            <button
              key={f.id}
              aria-pressed={activeFilter === f.id}
              onClick={() => setActiveFilter(f.id)}
              style={{
                padding: `0 ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                minHeight: '36px',
                backgroundColor: activeFilter === f.id ? colors.orangeSubtle : 'transparent',
                color: activeFilter === f.id ? colors.orangeText : colors.textTertiary,
                fontSize: typography.fontSize.caption, fontWeight: activeFilter === f.id ? typography.fontWeight.semibold : typography.fontWeight.medium,
                fontFamily: typography.fontFamily, cursor: 'pointer', transition: `all ${transitions.instant}`,
              }}
            >
              {f.label}
            </button>
          ))}
          {unreadCount > 0 && (
            <button
              onClick={() => setReadItems(new Set(activities.map(i => i.id)))}
              style={{
                fontSize: typography.fontSize.caption, color: colors.orangeText,
                backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium,
                minHeight: '36px', padding: `0 ${spacing['2']}`,
              }}
            >
              Mark all as read ({unreadCount})
            </button>
          )}
        </div>

        {/* Watching toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary }}>Watching</span>
            <button
              aria-label="Notification preferences"
              onClick={() => addToast('info', 'Notification preferences feature pending configuration')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '32px', minHeight: '32px', backgroundColor: 'transparent', border: 'none',
                cursor: 'pointer', color: colors.textTertiary, borderRadius: borderRadius.sm,
              }}
            >
              <Settings size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: spacing['1'] }}>
            {['rfi', 'task', 'photo', 'budget'].map((type) => (
              <button
                key={type}
                aria-pressed={following.has(type)}
                onClick={() => {
                  setFollowing((prev) => {
                    const next = new Set(prev);
                    if (next.has(type)) next.delete(type); else next.add(type);
                    return next;
                  });
                }}
                style={{
                  padding: `0 ${spacing['2']}`, border: `1px solid ${following.has(type) ? colors.primaryOrange : colors.borderDefault}`,
                  borderRadius: borderRadius.full, backgroundColor: following.has(type) ? colors.orangeSubtle : 'transparent',
                  color: following.has(type) ? colors.orangeText : colors.textTertiary,
                  fontSize: '10px', fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily, cursor: 'pointer', textTransform: 'capitalize',
                  minHeight: '28px',
                }}
              >
                {type}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '10px', color: colors.textTertiary }}>You will be notified about activity in these categories</span>
        </div>
      </div>

      {/* Activity stream grouped by time */}
      <Card padding="0">
        {grouped.map(group => (
          <div key={group.label}>
            <div style={{ padding: `${spacing['2']} ${spacing['5']}`, backgroundColor: colors.surfaceInset }}>
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{group.label}</span>
            </div>
            {group.items.map((item, i) => (
              <div
                key={item.id}
                style={{
                  borderBottom: i < group.items.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                  position: 'relative',
                }}
              >
                {!readItems.has(item.id) && !item.isGrouped && (
                  <div style={{
                    position: 'absolute', left: spacing['2'], top: '50%', transform: 'translateY(-50%)',
                    width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.statusInfo, zIndex: 1,
                  }} />
                )}
                <ActivityCard
                  item={item}
                  onComment={() => addToast('info', 'Comment thread opened')}
                  onClick={() => {
                    setReadItems(prev => { const n = new Set(prev); n.add(item.id); return n; });
                  }}
                  onEntityClick={(path) => {
                    setReadItems(prev => { const n = new Set(prev); n.add(item.id); return n; });
                    navigate(path);
                  }}
                />
              </div>
            ))}
          </div>
        ))}
        {grouped.length === 0 && (
          <div style={{ padding: `${spacing['8']} ${spacing['6']}`, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: typography.fontSize.body, color: colors.textTertiary }}>
              {activeFilter === 'all'
                ? 'No activity yet. Post an update above to get started.'
                : `No ${activeFilter} activity found. Try a different filter.`}
            </p>
          </div>
        )}
      </Card>
    </PageContainer>
  );
};
