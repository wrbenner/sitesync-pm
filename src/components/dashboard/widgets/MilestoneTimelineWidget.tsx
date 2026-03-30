import React, { useState, useMemo } from 'react';
import { Flag } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useSchedulePhases } from '../../../hooks/queries';

type MilestoneStatus = 'hit' | 'at-risk' | 'missed' | 'upcoming';

interface Milestone {
  id: string;
  name: string;
  date: string;
  status: MilestoneStatus;
  critical: boolean;
  slackDays: number;
}

function phaseStatusToMilestone(status: string | null, percentComplete: number | null): MilestoneStatus {
  const pct = percentComplete ?? 0;
  if (pct >= 100) return 'hit';
  const s = (status || '').toLowerCase();
  if (s === 'complete' || s === 'completed') return 'hit';
  if (s === 'delayed' || s === 'behind') return 'at-risk';
  if (s === 'missed') return 'missed';
  if (pct > 0 && s === 'at_risk') return 'at-risk';
  return 'upcoming';
}

function formatDateLabel(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

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

export const MilestoneTimelineWidget: React.FC = React.memo(() => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const projectId = useProjectId();
  const { data: phases } = useSchedulePhases(projectId);

  const milestones: Milestone[] = useMemo(() => {
    if (!phases) return [];
    return phases.map((p) => ({
      id: p.id,
      name: p.name,
      date: formatDateLabel(p.end_date),
      status: phaseStatusToMilestone(p.status, p.percent_complete),
      critical: p.is_critical_path ?? false,
      slackDays: 0,
    }));
  }, [phases]);

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
});
