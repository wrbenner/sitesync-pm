import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { PageContainer, Card, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { ActivityCard } from '../components/activity/ActivityCard';
import type { ActivityItem } from '../components/activity/ActivityCard';
import { MentionInput } from '../components/activity/MentionInput';

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

const mockActivities: (ActivityItem & { photoUrl?: string })[] = [
  { id: 1, type: 'task', user: 'Thomas Rodriguez', userInitials: 'TR', action: 'completed', target: 'Install fire stopping at floor penetrations', timestamp: new Date(Date.now() - 45 * 60 * 1000), commentCount: 3 },
  { id: 2, type: 'comment', user: 'David Kumar', userInitials: 'DK', action: 'commented on', target: 'Resolve curtain wall interface detail', timestamp: new Date(Date.now() - 90 * 60 * 1000), preview: 'The connection detail looks good. I have marked up the drawing with two minor adjustments needed at grid line B4.', commentCount: 5 },
  { id: 3, type: 'rfi', user: 'Mike Patterson', userInitials: 'MP', action: 'submitted', target: 'RFI-004: Structural connection at curtain wall', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), preview: 'Need clarification on the connection detail between structural steel and curtain wall panel system at the south face.', commentCount: 2 },
  { id: 4, type: 'photo', user: 'John Smith', userInitials: 'JS', action: 'uploaded 3 photos to', target: 'Floor 7 Steel Connection', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), photoGradient: undefined, photoUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400', commentCount: 1 },
  { id: 5, type: 'submittal', user: 'Jennifer Lee', userInitials: 'JL', action: 'approved', target: 'SUB-001: Structural Steel Shop Drawings', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), preview: 'Approved with no comments. Fabrication may proceed per submitted shop drawings.' },
  { id: 6, type: 'schedule', user: 'Karen Williams', userInitials: 'KW', action: 'moved to In Review', target: 'Review CO-002 HVAC upgrade scope', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) },
  { id: 7, type: 'budget', user: 'Robert Anderson', userInitials: 'RA', action: 'flagged', target: 'Structural division budget at 97%', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), preview: 'Contingency is effectively zero after CO-001. Recommend reallocation from Interior budget.' },
  { id: 8, type: 'task', user: 'Mike Patterson', userInitials: 'MP', action: 'created task', target: 'Safety audit walkthrough', timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000) },
  { id: 9, type: 'photo', user: 'Maria Garcia', userInitials: 'MG', action: 'captured voice note', target: 'Safety observation at north entrance', timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000), preview: 'North entrance rebar exposed, needs capping before tomorrow morning. Flagged as priority.', photoUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400' },
  { id: 10, type: 'punch', user: 'Robert Chen', userInitials: 'RC', action: 'updated', target: 'PL-003: Door closer adjustment', timestamp: new Date(Date.now() - 50 * 60 * 60 * 1000) },
];

function groupByTime(items: (ActivityItem & { photoUrl?: string })[]): { label: string; items: (ActivityItem & { photoUrl?: string })[] }[] {
  const now = Date.now();
  const today: (ActivityItem & { photoUrl?: string })[] = [];
  const yesterday: (ActivityItem & { photoUrl?: string })[] = [];
  const thisWeek: (ActivityItem & { photoUrl?: string })[] = [];

  items.forEach(item => {
    const hours = (now - item.timestamp.getTime()) / (1000 * 60 * 60);
    if (hours < 24) today.push(item);
    else if (hours < 48) yesterday.push(item);
    else thisWeek.push(item);
  });

  const groups: { label: string; items: (ActivityItem & { photoUrl?: string })[] }[] = [];
  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (thisWeek.length) groups.push({ label: 'This Week', items: thisWeek });
  return groups;
}

export const Activity: React.FC = () => {
  const { addToast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [following, setFollowing] = useState<Set<string>>(new Set(['rfi', 'task']));
  const [readItems, setReadItems] = useState<Set<number>>(new Set());

  const filtered = activeFilter === 'all'
    ? mockActivities
    : mockActivities.filter((a) => a.type === activeFilter);

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
              onClick={() => setReadItems(new Set(mockActivities.map(i => i.id)))}
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
              onClick={() => addToast('info', 'Notification preferences coming soon')}
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
