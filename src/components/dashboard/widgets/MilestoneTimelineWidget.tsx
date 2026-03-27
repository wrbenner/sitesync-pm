import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../../styles/theme';

type MilestoneStatus = 'hit' | 'at-risk' | 'missed' | 'upcoming';

interface Milestone {
  id: number;
  name: string;
  date: string;
  status: MilestoneStatus;
  critical: boolean;
  slackDays: number;
}

const milestones: Milestone[] = [
  { id: 1, name: 'Foundation Complete', date: 'Dec 2023', status: 'hit', critical: true, slackDays: 3 },
  { id: 2, name: 'Structure Topped Out', date: 'Aug 2024', status: 'hit', critical: true, slackDays: 0 },
  { id: 3, name: 'MEP Rough In 50%', date: 'Jan 2025', status: 'hit', critical: true, slackDays: 4 },
  { id: 4, name: 'Exterior Enclosed', date: 'Apr 2025', status: 'at-risk', critical: true, slackDays: -2 },
  { id: 5, name: 'Interior Framing Done', date: 'Jul 2025', status: 'upcoming', critical: false, slackDays: 12 },
  { id: 6, name: 'MEP Trim Out', date: 'Aug 2025', status: 'upcoming', critical: true, slackDays: 5 },
  { id: 7, name: 'Finishes Complete', date: 'Nov 2025', status: 'upcoming', critical: false, slackDays: 8 },
  { id: 8, name: 'Substantial Completion', date: 'Dec 2025', status: 'upcoming', critical: true, slackDays: 0 },
];

const statusColors: Record<MilestoneStatus, string> = {
  hit: colors.statusActive,
  'at-risk': colors.statusPending,
  missed: colors.statusCritical,
  upcoming: colors.textTertiary,
};

const statusLabels: Record<MilestoneStatus, string> = {
  hit: 'Complete',
  'at-risk': 'At Risk',
  missed: 'Missed',
  upcoming: 'Upcoming',
};

export const MilestoneTimelineWidget: React.FC = () => {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <Flag size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          Milestones
        </span>
        <span style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: colors.statusActive, fontWeight: typography.fontWeight.semibold }}>
          {milestones.filter((m) => m.status === 'hit').length}/{milestones.length} complete
        </span>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', display: 'flex', alignItems: 'center', position: 'relative' }}>
        {/* Line */}
        <div style={{ position: 'absolute', left: spacing['3'], right: spacing['3'], top: '50%', height: 2, backgroundColor: colors.borderDefault, transform: 'translateY(-1px)' }} />

        <div style={{ display: 'flex', gap: 0, minWidth: `${milestones.length * 90}px`, width: '100%', position: 'relative', zIndex: 1, justifyContent: 'space-between', padding: `0 ${spacing['2']}` }}>
          {milestones.map((ms) => {
            const color = statusColors[ms.status];
            const isHovered = hoveredId === ms.id;
            return (
              <div
                key={ms.id}
                onMouseEnter={() => setHoveredId(ms.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: spacing['1'],
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: 0,
                  position: 'relative',
                }}
              >
                {/* Label above */}
                <div style={{ textAlign: 'center', marginBottom: spacing['1'] }}>
                  <p style={{ fontSize: '10px', fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                    {ms.name}
                  </p>
                </div>

                {/* Dot */}
                <div
                  style={{
                    width: ms.critical ? 14 : 10,
                    height: ms.critical ? 14 : 10,
                    borderRadius: '50%',
                    backgroundColor: ms.status === 'upcoming' ? colors.surfaceRaised : color,
                    border: `2px solid ${color}`,
                    flexShrink: 0,
                  }}
                />

                {/* Date and slack below */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '9px', color: colors.textTertiary, margin: 0 }}>{ms.date}</p>
                  {ms.slackDays !== 0 && ms.status !== 'hit' && (
                    <p style={{ fontSize: '9px', color: ms.slackDays < 0 ? colors.statusCritical : colors.statusActive, margin: 0, fontWeight: typography.fontWeight.medium }}>
                      {ms.slackDays > 0 ? `+${ms.slackDays}d` : `${ms.slackDays}d`}
                    </p>
                  )}
                </div>

                {/* Hover tooltip with full name */}
                {isHovered && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginBottom: 4, padding: `${spacing['1']} ${spacing['2']}`,
                    backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.sm,
                    boxShadow: shadows.dropdown, whiteSpace: 'nowrap', zIndex: 10,
                    fontSize: typography.fontSize.caption,
                    pointerEvents: 'none',
                  }}>
                    <p style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{ms.name}</p>
                    <p style={{ color: colors.textTertiary, margin: 0, marginTop: 1 }}>{ms.date} · {statusLabels[ms.status]}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['2'], justifyContent: 'center' }}>
        {(['hit', 'at-risk', 'missed', 'upcoming'] as MilestoneStatus[]).map((status) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColors[status] }} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{statusLabels[status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
