import React from 'react';
import { Camera, MapPin } from 'lucide-react';
import { colors, spacing, typography, borderRadius, touchTarget } from '../../styles/theme';
import { getPunchStatusConfig } from '../../machines/punchItemMachine';
import type { PunchItemState } from '../../machines/punchItemMachine';
import type { PunchItem } from '../../types/database';
import { PriorityTag } from '../Primitives';

interface PunchItemCardProps {
  item: PunchItem;
  onClick: (item: PunchItem) => void;
  selected?: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getDueDateColor(iso: string | null): string {
  if (!iso) return colors.textTertiary;
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diff <= 0) return colors.statusCritical;
  if (diff <= 4) return colors.statusPending;
  return colors.textTertiary;
}

/**
 * Mobile-first punch item card.
 * Touch target: min 48px height. Single tap opens detail panel.
 * Conforms to V7 token rules: all colors from theme, no hardcoded hex.
 */
export const PunchItemCard = React.memo<PunchItemCardProps>(({ item, onClick, selected }) => {
  const status = (item.status ?? 'open') as PunchItemState;
  const statusCfg = getPunchStatusConfig(status);
  const photos = Array.isArray(item.photos) ? (item.photos as string[]) : [];
  const firstPhoto = photos[0] ?? null;
  const location = [item.floor, item.area, item.location].filter(Boolean).join(' \u203a ');

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(item);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing['3'],
        padding: `${spacing['4']} ${spacing['4']}`,
        minHeight: touchTarget.comfortable,
        backgroundColor: selected ? colors.surfaceSelected : colors.surfaceRaised,
        border: `1px solid ${selected ? colors.borderFocus : colors.borderSubtle}`,
        borderRadius: borderRadius.lg,
        cursor: 'pointer',
        transition: 'border-color 160ms ease, background-color 160ms ease',
      }}
    >
      {/* Left: content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['2'], minWidth: 0 }}>
        {/* Number + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, flexShrink: 0 }}>
            #{item.number ?? '...'}
          </span>
          <span
            style={{
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              lineHeight: typography.lineHeight.snug,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.title}
          </span>
        </div>

        {/* Location */}
        {location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <MapPin size={11} color={colors.textTertiary} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {location}
            </span>
          </div>
        )}

        {/* Bottom row: priority, status, due date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
          <PriorityTag priority={(item.priority ?? 'medium') as 'low' | 'medium' | 'high' | 'critical'} />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['1'],
              padding: `2px ${spacing['2']}`,
              borderRadius: borderRadius.full,
              backgroundColor: statusCfg.bg,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              color: statusCfg.color,
            }}
          >
            {statusCfg.label}
          </span>
          {item.due_date && (
            <span style={{ fontSize: typography.fontSize.caption, color: getDueDateColor(item.due_date), marginLeft: 'auto', flexShrink: 0 }}>
              Due {formatDate(item.due_date)}
            </span>
          )}
        </div>

        {/* Assigned to */}
        {item.assigned_to && (
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
            {item.assigned_to}
            {item.trade ? ` \u00b7 ${item.trade}` : ''}
          </span>
        )}
      </div>

      {/* Right: photo thumbnail or placeholder */}
      <div style={{ flexShrink: 0 }}>
        {firstPhoto ? (
          <img
            src={firstPhoto}
            alt="Site"
            style={{
              width: 56,
              height: 56,
              objectFit: 'cover',
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.borderSubtle}`,
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: borderRadius.md,
              border: `1px dashed ${colors.borderDefault}`,
              backgroundColor: colors.surfaceInset,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Camera size={18} color={colors.textTertiary} />
          </div>
        )}
        {photos.length > 1 && (
          <span style={{ display: 'block', marginTop: 2, fontSize: typography.fontSize.caption, color: colors.textTertiary, textAlign: 'center' }}>
            +{photos.length - 1}
          </span>
        )}
      </div>
    </div>
  );
});

PunchItemCard.displayName = 'PunchItemCard';
