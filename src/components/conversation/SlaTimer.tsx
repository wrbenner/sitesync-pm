// ── SlaTimer ───────────────────────────────────────────────────────────────
// A small status pill that renders the current SLA state for an entity that
// has a contractual response window (RFI, Submittal, CO, Punch). Color and
// label are determined by `slaCalculator.calculateSlaState`.
//
// Usage:
//   <SlaTimer dueDate={rfi.response_due_date ?? rfi.due_date} pausedAt={rfi.sla_paused_at} />

import React from 'react';
import { Clock, Pause, AlertTriangle } from 'lucide-react';
import { calculateSlaState, type SlaState } from '../../lib/slaCalculator';
import { colors, typography } from '../../styles/theme';

interface SlaTimerProps {
  dueDate: string | null | undefined;
  pausedAt?: string | null;
  pausedTotalSeconds?: number;
  holidays?: ReadonlyArray<string>;
  size?: 'sm' | 'md';
  /** When true, hides the icon; useful in tight inbox rows. */
  compact?: boolean;
}

const colorMap: Record<SlaState['color'], { fg: string; bg: string }> = {
  neutral: { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  warn: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  danger: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
  paused: { fg: colors.textSecondary, bg: colors.surfaceInset },
  unknown: { fg: colors.textTertiary, bg: 'transparent' },
};

export const SlaTimer: React.FC<SlaTimerProps> = ({
  dueDate,
  pausedAt,
  pausedTotalSeconds,
  holidays,
  size = 'sm',
  compact,
}) => {
  const state = calculateSlaState({ dueDate, pausedAt, pausedTotalSeconds, holidays });
  const palette = colorMap[state.color];
  const fontSize = size === 'sm' ? typography.fontSize.label : typography.fontSize.sm;
  const iconSize = size === 'sm' ? 11 : 13;

  const Icon =
    state.color === 'paused' ? Pause :
    state.color === 'danger' ? AlertTriangle :
    Clock;

  return (
    <span
      role="status"
      aria-label={`SLA: ${state.label}`}
      title={titleFor(state)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
        fontSize,
        fontWeight: typography.fontWeight.semibold,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {!compact && state.color !== 'unknown' && <Icon size={iconSize} />}
      {state.label}
    </span>
  );
};

/**
 * Tooltip text — the full sentence the chip abbreviates. Helpful on a
 * dense inbox where the chip alone is ambiguous.
 */
function titleFor(state: SlaState): string {
  switch (state.stage) {
    case 'on_track':
      return `${state.businessDaysRemaining} business days remain on the SLA clock.`;
    case 'nudge':
      return state.businessDaysRemaining === 0
        ? 'Response is due today. A T-2 reminder may already have fired.'
        : `${state.businessDaysRemaining} business days remaining — within the T-2 nudge window.`;
    case 'overdue':
      return `${state.businessDaysOverdue} business day(s) past due. First overdue notice has been sent.`;
    case 'overdue_cc':
      return `${state.businessDaysOverdue} business days past due. Manager has been CC'd.`;
    case 'delay_risk':
      return `${state.businessDaysOverdue} business days past due — flagged as delay risk; CO narrative auto-drafted.`;
    case 'paused':
      return 'SLA clock is paused. The escalator will not fire until it is resumed.';
    default:
      return 'No response due-date set on this item.';
  }
}

export default SlaTimer;
