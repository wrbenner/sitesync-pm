import React, { useState } from 'react';
import { MessageSquare, ThumbsUp, Camera, FileText, HelpCircle, Calendar, DollarSign, CheckSquare, Clock, Bookmark } from 'lucide-react';
import { Avatar } from '../Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

export interface ActivityItem {
  id: number;
  type: 'rfi' | 'submittal' | 'photo' | 'daily_log' | 'schedule' | 'budget' | 'task' | 'comment' | 'punch';
  user: string;
  userInitials: string;
  action: string;
  target: string;
  timestamp: Date;
  preview?: string;
  photoGradient?: string;
  commentCount?: number;
}

interface ActivityCardProps {
  item: ActivityItem;
  onComment?: () => void;
  onClick?: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  rfi: <HelpCircle size={12} />,
  submittal: <FileText size={12} />,
  photo: <Camera size={12} />,
  daily_log: <Calendar size={12} />,
  schedule: <Clock size={12} />,
  budget: <DollarSign size={12} />,
  task: <CheckSquare size={12} />,
  comment: <MessageSquare size={12} />,
  punch: <CheckSquare size={12} />,
};

const typeColors: Record<string, string> = {
  rfi: colors.statusInfo,
  submittal: colors.statusReview,
  photo: colors.statusActive,
  daily_log: colors.primaryOrange,
  schedule: colors.statusPending,
  budget: colors.statusCritical,
  task: colors.statusInfo,
  comment: colors.textSecondary,
  punch: colors.statusPending,
};

function formatTimeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ item, onComment, onClick }) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const color = typeColors[item.type] || colors.textSecondary;

  return (
    <div
      onClick={onClick}
      style={{
        padding: `${spacing['4']} ${spacing['5']}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: `background-color ${transitions.instant}`,
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', gap: spacing['3'] }}>
        <Avatar initials={item.userInitials} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{item.user}</span>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.action}</span>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{item.target}</span>
          </div>

          {/* Type badge + time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color, fontWeight: typography.fontWeight.medium }}>
              {typeIcons[item.type]}
              <span style={{ textTransform: 'capitalize' }}>{item.type.replace('_', ' ')}</span>
            </div>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{formatTimeAgo(item.timestamp)}</span>
          </div>

          {/* Preview content */}
          {item.preview && (
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginBottom: spacing['2'], lineHeight: typography.lineHeight.relaxed }}>
              {item.preview}
            </p>
          )}

          {/* Photo preview */}
          {item.photoGradient && (
            <div style={{
              height: '120px', borderRadius: borderRadius.md,
              background: item.photoGradient, marginBottom: spacing['2'],
            }} />
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <button
              onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                color: liked ? colors.orangeText : colors.textTertiary,
                fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily,
              }}
            >
              <ThumbsUp size={12} /> {liked ? 'Liked' : 'Like'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onComment?.(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily,
              }}
            >
              <MessageSquare size={12} /> {item.commentCount || 0}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setSaved(!saved); }}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                color: saved ? colors.statusReview : colors.textTertiary,
                fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, marginLeft: 'auto',
              }}
            >
              <Bookmark size={12} fill={saved ? colors.statusReview : 'none'} /> {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
