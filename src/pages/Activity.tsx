import React, { useState, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { PageContainer, Card, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { ActivityCard } from '../components/activity/ActivityCard';
import type { ActivityItem } from '../components/activity/ActivityCard';
import { MentionInput } from '../components/activity/MentionInput';
import { useProjectId } from '../hooks/useProjectId';
import { useActivityFeed } from '../hooks/queries';
import type { ActivityFeedItem } from '../types/database';

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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function mapFeedItem(item: ActivityFeedItem): ActivityItem & { photoUrl?: string } {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const userName = (meta.user_name as string) || 'Unknown User';
  const type = (item.type || 'task') as ActivityItem['type'];
  const action = (meta.action as string) || '';
  const photoUrl = (meta.photo_url as string) || undefined;

  return {
    id: typeof meta.numeric_id === 'number' ? meta.numeric_id : Math.abs(hashCode(item.id)),
    type,
    user: userName,
    userInitials: getInitials(userName),
    action,
    target: item.title,
    timestamp: new Date(item.created_at ?? Date.now()),
    preview: item.body || undefined,
    commentCount: typeof meta.comment_count === 'number' ? meta.comment_count : undefined,
    photoUrl,
  };
}

/** Simple string hash so we get a stable numeric id from the uuid */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function groupByTime(items: (ActivityItem & { photoUrl?: string })[]): { label: string; items: (ActivityItem & { photoUrl?: string })[] }[] {
  const now = Date.now();
  const today: (ActivityItem & { photoUrl?: string })[] = [];
  const yesterday: (ActivityItem & { photoUrl?: string })[] = [];
  const earlier: (ActivityItem & { photoUrl?: string })[] = [];

  items.forEach(item => {
    const hours = (now - item.timestamp.getTime()) / (1000 * 60 * 60);
    if (hours < 24) today.push(item);
    else if (hours < 48) yesterday.push(item);
    else earlier.push(item);
  });

  const groups: { label: string; items: (ActivityItem & { photoUrl?: string })[] }[] = [];
  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier });
  return groups;
}

export const Activity: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const { data: rawActivities } = useActivityFeed(projectId);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [following, setFollowing] = useState<Set<string>>(new Set(['rfi', 'task']));
  const [readItems, setReadItems] = useState<Set<number>>(new Set());

  const activities = useMemo(
    () => (rawActivities ?? []).map(mapFeedItem),
    [rawActivities]
  );

  const filtered = activeFilter === 'all'
    ? activities
    : activities.filter((a) => a.type === activeFilter);

  const unreadCount = filtered.filter(i => !readItems.has(i.id)).length;
  const grouped = groupByTime(filtered);

  return (
    <PageContainer title="Activity" subtitle="Everything happening on Meridian Tower">
      {/* Post input */}
      <Card padding={spacing['4']}>
        <MentionInput
          onSend={(_text) => addToast('success', 'Posted to activity feed')}
          placeholder="Share an update with the team... Use @ to mention someone"
        />
      </Card>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], marginTop: spacing['4'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              style={{
                padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                backgroundColor: activeFilter === f.id ? colors.orangeSubtle : 'transparent',
                color: activeFilter === f.id ? colors.primaryOrange : colors.textTertiary,
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
                fontSize: typography.fontSize.caption, color: colors.primaryOrange,
                backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium,
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
              onClick={() => addToast('info', 'Notification preferences feature pending configuration')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, backgroundColor: 'transparent', border: 'none',
                cursor: 'pointer', color: colors.textTertiary, borderRadius: borderRadius.sm,
              }}
            >
              <Settings size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: spacing['1'] }}>
            {['rfi', 'task', 'photo', 'budget'].map((type) => (
              <button
                key={type}
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
                  color: following.has(type) ? colors.primaryOrange : colors.textTertiary,
                  fontSize: '10px', fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily, cursor: 'pointer', textTransform: 'capitalize',
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
                {!readItems.has(item.id) && (
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
                    addToast('info', `Navigating to ${item.target}`);
                  }}
                />
                {item.photoUrl && (
                  <div style={{ padding: `0 ${spacing['5']} ${spacing['3']}`, marginTop: `-${spacing['2']}` }}>
                    <img src={item.photoUrl} alt="Site photo" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: borderRadius.md }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {grouped.length === 0 && (
          <div style={{ padding: spacing['8'], textAlign: 'center', color: colors.textTertiary }}>
            No activity matching this filter.
          </div>
        )}
      </Card>
    </PageContainer>
  );
};
