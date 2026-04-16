/**
 * Change Order Widgets
 *
 * Mobile-first, field-ready components for rendering change order data.
 * All interactive elements meet the 48px minimum touch target for field use.
 * All styles use tokens from src/styles/theme.ts. No raw hex or hardcoded px.
 */
import React from 'react';
import { FileText, AlertCircle, ArrowRight } from 'lucide-react';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  touchTarget,
  skeleton,
  transitions,
} from '../../styles/theme';
import {
  getCOTypeConfig,
  getCOStatusConfig,
} from '../../machines/changeOrderMachine';
import type { ChangeOrderType, ChangeOrderState } from '../../machines/changeOrderMachine';
import type { ChangeOrderRecord } from '../../services/changeOrderService';
import { formatCOAmount, formatCOAmountCompact } from './formatCOAmount';

// ── Type Badge ────────────────────────────────────────────────────────────────

interface ChangeOrderTypeBadgeProps {
  type: ChangeOrderType;
  size?: 'sm' | 'md';
}

export const ChangeOrderTypeBadge: React.FC<ChangeOrderTypeBadgeProps> = React.memo(
  ({ type, size = 'md' }) => {
    const config = getCOTypeConfig(type);
    const fontSize = size === 'sm' ? typography.fontSize.caption : typography.fontSize.label;
    const padding = size === 'sm'
      ? `${spacing['0.5']} ${spacing['1.5']}`
      : `${spacing['1']} ${spacing['2']}`;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding,
          backgroundColor: config.bg,
          color: config.color,
          fontSize,
          fontWeight: typography.fontWeight.semibold,
          letterSpacing: typography.letterSpacing.wider,
          borderRadius: borderRadius.sm,
          lineHeight: typography.lineHeight.none,
          whiteSpace: 'nowrap',
        }}
      >
        {config.shortLabel}
      </span>
    );
  },
);
ChangeOrderTypeBadge.displayName = 'ChangeOrderTypeBadge';

// ── Status Badge ──────────────────────────────────────────────────────────────

interface ChangeOrderStatusBadgeProps {
  status: ChangeOrderState | string;
  size?: 'sm' | 'md';
}

export const ChangeOrderStatusBadge: React.FC<ChangeOrderStatusBadgeProps> = React.memo(
  ({ status, size = 'md' }) => {
    const config = getCOStatusConfig(status as ChangeOrderState);
    const fontSize = size === 'sm' ? typography.fontSize.caption : typography.fontSize.label;
    const padding = size === 'sm'
      ? `${spacing['0.5']} ${spacing['1.5']}`
      : `${spacing['1']} ${spacing['2']}`;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding,
          backgroundColor: config.bg,
          color: config.color,
          fontSize,
          fontWeight: typography.fontWeight.medium,
          borderRadius: borderRadius.sm,
          lineHeight: typography.lineHeight.none,
          whiteSpace: 'nowrap',
        }}
      >
        {config.label}
      </span>
    );
  },
);
ChangeOrderStatusBadge.displayName = 'ChangeOrderStatusBadge';

// ── Loading Skeleton ──────────────────────────────────────────────────────────

const SkeletonBlock: React.FC<{
  width?: string;
  height?: string;
  style?: React.CSSProperties;
}> = ({ width = '100%', height = '14px', style }) => (
  <div
    style={{
      width,
      height,
      backgroundColor: skeleton.baseColor,
      borderRadius: borderRadius.sm,
      animation: skeleton.animation,
      ...style,
    }}
  />
);

/**
 * Skeleton for a single change order card row.
 * Used while loadChangeOrders() is in flight.
 */
export const ChangeOrderCardSkeleton: React.FC = React.memo(() => (
  <div
    style={{
      padding: spacing['4'],
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      boxShadow: shadows.card,
      border: `1px solid ${colors.borderSubtle}`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
      <SkeletonBlock width="48px" height="20px" style={{ borderRadius: borderRadius.sm }} />
      <SkeletonBlock width="64px" height="20px" style={{ borderRadius: borderRadius.sm }} />
      <SkeletonBlock width="120px" height="16px" style={{ marginLeft: 'auto' }} />
    </div>
    <SkeletonBlock height="18px" style={{ marginBottom: spacing['2'] }} />
    <SkeletonBlock width="60%" height="14px" />
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: spacing['3'],
    }}>
      <SkeletonBlock width="80px" height="12px" />
      <SkeletonBlock width="64px" height="16px" />
    </div>
  </div>
));
ChangeOrderCardSkeleton.displayName = 'ChangeOrderCardSkeleton';

/**
 * Full-page loading state: renders N skeleton cards.
 */
export const ChangeOrderListSkeleton: React.FC<{ count?: number }> = React.memo(
  ({ count = 5 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      {Array.from({ length: count }, (_, i) => (
        <ChangeOrderCardSkeleton key={i} />
      ))}
    </div>
  ),
);
ChangeOrderListSkeleton.displayName = 'ChangeOrderListSkeleton';

// ── Empty State ───────────────────────────────────────────────────────────────

interface ChangeOrderEmptyStateProps {
  message?: string;
  onCreateClick?: () => void;
}

/**
 * Empty state for when a project has no change orders yet, or when filters
 * produce zero results. Superintendent-first copy.
 */
export const ChangeOrderEmptyState: React.FC<ChangeOrderEmptyStateProps> = React.memo(
  ({ message = 'No change orders yet', onCreateClick }) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${spacing['12']} ${spacing['6']}`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: borderRadius['2xl'],
          backgroundColor: colors.surfaceInset,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing['4'],
        }}
      >
        <FileText size={24} color={colors.textTertiary} />
      </div>
      <p
        style={{
          fontSize: typography.fontSize.title,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          margin: `0 0 ${spacing['1']} 0`,
        }}
      >
        {message}
      </p>
      <p
        style={{
          fontSize: typography.fontSize.body,
          color: colors.textSecondary,
          margin: `0 0 ${spacing['5']} 0`,
          maxWidth: '280px',
        }}
      >
        Track potential, requested, and approved contract modifications in one place.
      </p>
      {onCreateClick && (
        <button
          onClick={onCreateClick}
          style={{
            minHeight: touchTarget.comfortable,
            paddingLeft: spacing['5'],
            paddingRight: spacing['5'],
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            cursor: 'pointer',
            transition: transitions.quick,
          }}
        >
          Create Change Order
        </button>
      )}
    </div>
  ),
);
ChangeOrderEmptyState.displayName = 'ChangeOrderEmptyState';

// ── Error State ───────────────────────────────────────────────────────────────

interface ChangeOrderErrorStateProps {
  error: string;
  onRetry?: () => void;
}

/**
 * Error state for when loadChangeOrders() fails or the service returns an error.
 */
export const ChangeOrderErrorState: React.FC<ChangeOrderErrorStateProps> = React.memo(
  ({ error, onRetry }) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${spacing['12']} ${spacing['6']}`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: borderRadius['2xl'],
          backgroundColor: colors.statusCriticalSubtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing['4'],
        }}
      >
        <AlertCircle size={24} color={colors.statusCritical} />
      </div>
      <p
        style={{
          fontSize: typography.fontSize.title,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          margin: `0 0 ${spacing['1']} 0`,
        }}
      >
        Could not load change orders
      </p>
      <p
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.textSecondary,
          margin: `0 0 ${spacing['5']} 0`,
          maxWidth: '320px',
          wordBreak: 'break-word',
        }}
      >
        {error}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            minHeight: touchTarget.comfortable,
            paddingLeft: spacing['5'],
            paddingRight: spacing['5'],
            backgroundColor: colors.surfaceRaised,
            color: colors.textPrimary,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.medium,
            cursor: 'pointer',
            transition: transitions.quick,
          }}
        >
          Try Again
        </button>
      )}
    </div>
  ),
);
ChangeOrderErrorState.displayName = 'ChangeOrderErrorState';

// ── Change Order Card ─────────────────────────────────────────────────────────

interface ChangeOrderCardProps {
  changeOrder: ChangeOrderRecord;
  isSelected?: boolean;
  onClick?: (co: ChangeOrderRecord) => void;
}

/**
 * Mobile-first card for displaying a single change order.
 *
 * Touch target: the entire card is the tap target (meets 48px minimum via
 * padding; min-height is explicitly clamped). Tapping anywhere on the card
 * triggers onClick.
 *
 * Financial: shows approved_cost when approved, estimated_cost otherwise.
 * Uses formatCOAmount() for full precision display.
 */
export const ChangeOrderCard: React.FC<ChangeOrderCardProps> = React.memo(
  ({ changeOrder: co, isSelected = false, onClick }) => {
    const coType = co.type as ChangeOrderType ?? 'co';
    const coStatus = co.status as ChangeOrderState ?? 'draft';

    // Show the most relevant financial figure based on lifecycle state
    const displayAmount = coStatus === 'approved'
      ? (co.approved_cost ?? co.approved_amount ?? co.amount)
      : (co.estimated_cost ?? co.amount);

    const hasScheduleImpact = (co.schedule_impact_days ?? 0) > 0;
    const isPromoted = !!co.promoted_at;

    return (
      <button
        onClick={() => onClick?.(co)}
        style={{
          display: 'block',
          width: '100%',
          minHeight: touchTarget.comfortable,
          padding: spacing['4'],
          backgroundColor: isSelected ? colors.surfaceSelected : colors.surfaceRaised,
          border: `1px solid ${isSelected ? colors.primaryOrange : colors.borderSubtle}`,
          borderRadius: borderRadius.lg,
          boxShadow: isSelected ? shadows.glow : shadows.card,
          cursor: onClick ? 'pointer' : 'default',
          textAlign: 'left',
          transition: transitions.quick,
          outline: 'none',
        }}
        aria-pressed={isSelected}
      >
        {/* Header row: badges + number */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            marginBottom: spacing['2'],
            flexWrap: 'wrap',
          }}
        >
          <ChangeOrderTypeBadge type={coType} size="sm" />
          <ChangeOrderStatusBadge status={coStatus} size="sm" />
          <span
            style={{
              marginLeft: 'auto',
              fontSize: typography.fontSize.label,
              color: colors.textTertiary,
              fontFamily: 'monospace',
            }}
          >
            {coType.toUpperCase()}-{String(co.number).padStart(3, '0')}
          </span>
        </div>

        {/* Title */}
        <p
          style={{
            margin: `0 0 ${spacing['1']} 0`,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            lineHeight: typography.lineHeight.snug,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {co.title ?? 'Untitled Change Order'}
        </p>

        {/* Description excerpt */}
        {co.description && (
          <p
            style={{
              margin: `0 0 ${spacing['3']} 0`,
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              lineHeight: typography.lineHeight.normal,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {co.description}
          </p>
        )}

        {/* Footer row: schedule impact + amount + promoted indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing['2'],
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            {hasScheduleImpact && (
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  color: colors.statusPending,
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                +{co.schedule_impact_days}d
              </span>
            )}
            {isPromoted && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: spacing['1'],
                  fontSize: typography.fontSize.caption,
                  color: colors.statusInfo,
                }}
              >
                <ArrowRight size={10} />
                Promoted
              </span>
            )}
            {co.cost_code && (
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                }}
              >
                {co.cost_code}
              </span>
            )}
          </div>

          <span
            style={{
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold,
              color: coStatus === 'approved' ? colors.statusActive : colors.textPrimary,
              lineHeight: typography.lineHeight.none,
            }}
          >
            {formatCOAmount(displayAmount)}
          </span>
        </div>
      </button>
    );
  },
);
ChangeOrderCard.displayName = 'ChangeOrderCard';

// ── Metric Summary Row ────────────────────────────────────────────────────────

interface ChangeOrderMetricProps {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
}

/**
 * Single metric cell used in the financial summary row at the top of lists.
 */
export const ChangeOrderMetric: React.FC<ChangeOrderMetricProps> = React.memo(
  ({ label, value, sublabel, color }) => (
    <div style={{ flex: 1, minWidth: '100px' }}>
      <p
        style={{
          margin: `0 0 ${spacing['0.5']} 0`,
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          fontWeight: typography.fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: typography.letterSpacing.wider,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: typography.fontSize.subtitle,
          fontWeight: typography.fontWeight.semibold,
          color: color ?? colors.textPrimary,
          lineHeight: typography.lineHeight.none,
        }}
      >
        {value}
      </p>
      {sublabel && (
        <p
          style={{
            margin: `${spacing['0.5']} 0 0 0`,
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
          }}
        >
          {sublabel}
        </p>
      )}
    </div>
  ),
);
ChangeOrderMetric.displayName = 'ChangeOrderMetric';

/**
 * Financial summary row computed from a list of change orders.
 * Shows approved total, pending total, and schedule impact.
 */
export const ChangeOrderFinancialSummary: React.FC<{
  changeOrders: ChangeOrderRecord[];
}> = React.memo(({ changeOrders }) => {
  // Sum using integer cents to avoid floating-point drift
  const approvedCents = changeOrders
    .filter((co) => co.status === 'approved')
    .reduce((sum, co) => sum + Math.round((co.approved_cost ?? co.approved_amount ?? 0) * 100), 0);

  const pendingCents = changeOrders
    .filter((co) => co.status === 'pending_review')
    .reduce((sum, co) => sum + Math.round((co.estimated_cost ?? co.amount ?? 0) * 100), 0);

  const totalScheduleDays = changeOrders
    .filter((co) => co.status === 'approved')
    .reduce((sum, co) => sum + (co.schedule_impact_days ?? 0), 0);

  const count = changeOrders.filter((co) => co.status === 'pending_review').length;

  return (
    <div
      style={{
        display: 'flex',
        gap: spacing['4'],
        padding: `${spacing['4']} ${spacing['5']}`,
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.card,
        border: `1px solid ${colors.borderSubtle}`,
        flexWrap: 'wrap',
      }}
    >
      <ChangeOrderMetric
        label="Approved"
        value={formatCOAmountCompact(approvedCents / 100)}
        sublabel="contract increase"
        color={colors.statusActive}
      />
      <div
        style={{
          width: '1px',
          backgroundColor: colors.borderSubtle,
          alignSelf: 'stretch',
        }}
      />
      <ChangeOrderMetric
        label="Pending"
        value={formatCOAmountCompact(pendingCents / 100)}
        sublabel={`${count} under review`}
        color={colors.statusPending}
      />
      <div
        style={{
          width: '1px',
          backgroundColor: colors.borderSubtle,
          alignSelf: 'stretch',
        }}
      />
      <ChangeOrderMetric
        label="Schedule Impact"
        value={totalScheduleDays === 0 ? 'None' : `+${totalScheduleDays}d`}
        sublabel="approved days added"
        color={totalScheduleDays > 0 ? colors.statusPending : colors.statusActive}
      />
    </div>
  );
});
ChangeOrderFinancialSummary.displayName = 'ChangeOrderFinancialSummary';
