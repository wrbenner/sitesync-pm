import React, { useState } from 'react';
import { MessageSquare, ThumbsUp, Camera, FileText, HelpCircle, Calendar, DollarSign, CheckSquare, Clock, Bookmark, ExternalLink } from 'lucide-react';
import { Avatar } from '../Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

export interface ActivityItem {
  id: string;
  type: 'rfi' | 'submittal' | 'photo' | 'daily_log' | 'schedule' | 'budget' | 'task' | 'comment' | 'punch' | string;
  user: string;
  userInitials: string;
  actorAvatar?: string | null;
  action: string;
  target: string;
  entityPath?: string;
  timestamp: Date;
  preview?: string;
  photoGradient?: string;
  commentCount?: number;
  isGrouped?: boolean;
}

interface ActivityCardProps {
  item: ActivityItem;
  onComment?: () => void;
  onClick?: () => void;
  onEntityClick?: (path: string) => void;
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

function EntityLabel({ target, entityPath, onEntityClick }: { target: string; entityPath?: string; onEntityClick?: (p: string) => void }) {
  if (entityPath) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onEntityClick?.(entityPath); }}
        aria-label={`View ${target}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
          color: colors.primaryOrange, backgroundColor: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: typography.fontFamily, padding: 0,
          textDecoration: 'underline', textUnderlineOffset: '2px',
        }}
      >
        {target}
        <ExternalLink size={10} />
      </button>
    );
  }
  return <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{target}</span>;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ item, onComment, onClick, onEntityClick }) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [focused, setFocused] = useState(false);
  const color = typeColors[item.type] || colors.textSecondary;

  const avatarWidth = 32;
  const avatarGap = parseInt(spacing['3'], 10) || 12;
  const groupedPaddingLeft = `calc(${spacing['5']} + ${avatarWidth}px + ${avatarGap}px)`;

  return (
    <div
      onClick={onClick}
      role="article"
      tabIndex={0}
      aria-labelledby={`activity-${item.id}-title`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      onFocus={() => { if (onClick) setFocused(true); }}
      onBlur={() => setFocused(false)}
      style={{
        paddingTop: item.isGrouped ? spacing['2'] : spacing['4'],
        paddingBottom: spacing['4'],
        paddingLeft: spacing['5'],
        paddingRight: spacing['5'],
        cursor: onClick ? 'pointer' : 'default',
        transition: `background-color ${transitions.instant}`,
        outline: focused ? `2px solid ${colors.primaryOrange}` : 'none',
        outlineOffset: focused ? '2px' : undefined,
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
    >
      {item.isGrouped ? (
        /* Grouped: no avatar row, indent content to align under previous avatar */
        <div style={{ paddingLeft: groupedPaddingLeft }}>
          <div id={`activity-${item.id}-title`} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['1'], flexWrap: 'wrap' }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.action}</span>
            <EntityLabel target={item.target} entityPath={item.entityPath} onEntityClick={onEntityClick} />
          </div>
          <GroupedMeta type={item.type} color={color} timestamp={item.timestamp} preview={item.preview} photoGradient={item.photoGradient} commentCount={item.commentCount} liked={liked} saved={saved} setLiked={setLiked} setSaved={setSaved} onComment={onComment} />
        </div>
      ) : (
        /* Normal: avatar + full header */
        <div style={{ display: 'flex', gap: spacing['3'] }}>
          {item.actorAvatar ? (
            <img src={item.actorAvatar} alt={item.user} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <Avatar initials={item.userInitials} size={32} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id={`activity-${item.id}-title`} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['1'], flexWrap: 'wrap' }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{item.user}</span>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.action}</span>
              <EntityLabel target={item.target} entityPath={item.entityPath} onEntityClick={onEntityClick} />
            </div>
            <GroupedMeta type={item.type} color={color} timestamp={item.timestamp} preview={item.preview} photoGradient={item.photoGradient} commentCount={item.commentCount} liked={liked} saved={saved} setLiked={setLiked} setSaved={setSaved} onComment={onComment} />
          </div>
        </div>
      )}
    </div>
  );
};

interface GroupedMetaProps {
  type: string;
  color: string;
  timestamp: Date;
  preview?: string;
  photoGradient?: string;
  commentCount?: number;
  liked: boolean;
  saved: boolean;
  setLiked: (v: boolean) => void;
  setSaved: (v: boolean) => void;
  onComment?: () => void;
}

function GroupedMeta({ type, color, timestamp, preview, photoGradient, commentCount, liked, saved, setLiked, setSaved, onComment }: GroupedMetaProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color, fontWeight: typography.fontWeight.medium }}>
          <span aria-hidden="true">{typeIcons[type] || <FileText size={12} />}</span>
          <span style={{ textTransform: 'capitalize' }}>{type.replace('_', ' ')}</span>
        </div>
        <time dateTime={timestamp.toISOString()} aria-label={formatTimeAgo(timestamp)} style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{formatTimeAgo(timestamp)}</time>
      </div>
      {preview && (
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginBottom: spacing['2'], lineHeight: typography.lineHeight.relaxed }}>
          {preview}
        </p>
      )}
      {photoGradient && (
        <div style={{ height: '120px', borderRadius: borderRadius.md, background: photoGradient, marginBottom: spacing['2'] }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
        <button
          onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
          aria-label="Like this activity"
          style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: liked ? colors.orangeText : colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily }}
        >
          <ThumbsUp size={12} /> {liked ? 'Liked' : 'Like'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onComment?.(); }}
          aria-label={`${commentCount || 0} comments`}
          style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily }}
        >
          <MessageSquare size={12} /> {commentCount || 0}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setSaved(!saved); }}
          aria-label="Bookmark this activity"
          style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: saved ? colors.statusReview : colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, marginLeft: 'auto' }}
        >
          <Bookmark size={12} fill={saved ? colors.statusReview : 'none'} /> {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </>
  );
}
