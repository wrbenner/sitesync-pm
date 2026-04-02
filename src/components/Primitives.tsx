import React, { useState, useEffect, useContext, createContext, useCallback, useRef, useId } from 'react';
import { X, Search, CheckCircle, AlertTriangle, Info, XCircle, ChevronRight, LayoutGrid, HelpCircle, Calendar, DollarSign, User, Users, ClipboardList, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import type { RelatedItem, EntityType } from '../utils/connections';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex, layout } from '../styles/theme';
import { motion as motionTokens, easing, duration } from '../styles/animations';

// ─── Sidebar Context ────────────────────────────────────────────────────────
// Shared context so PageContainer and TopBar can respond to sidebar state

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

// ─── PageContainer ──────────────────────────────────────────────────────────
// Consistent page wrapper. Replaces the raw <main> with a fixed marginLeft.

interface PageContainerProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({ title, subtitle, actions, children }) => {
  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.surfacePage,
      }}
    >
      <div
        style={{
          maxWidth: layout.pageMaxWidth,
          margin: '0 auto',
          padding: `${layout.pagePaddingY} ${layout.pagePaddingX}`,
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: spacing['2xl'],
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: typography.fontSize.heading,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  margin: 0,
                  letterSpacing: typography.letterSpacing.tight,
                  lineHeight: typography.lineHeight.tight,
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  style={{
                    fontSize: typography.fontSize.body,
                    color: colors.textTertiary,
                    margin: 0,
                    marginTop: spacing['2'],
                    lineHeight: typography.lineHeight.normal,
                    letterSpacing: typography.letterSpacing.normal,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </main>
  );
};

// ─── Card ───────────────────────────────────────────────────────────────────
// Floating surface. No border. Shadow only.

interface CardProps {
  children: React.ReactNode;
  padding?: string;
  onClick?: () => void;
  'aria-label'?: string;
  role?: string;
}

export const Card: React.FC<CardProps> = React.memo(({ children, padding = spacing['5'], onClick, 'aria-label': ariaLabel, role }) => (
  <div
    onClick={onClick}
    role={role || (onClick ? 'button' : undefined)}
    tabIndex={onClick ? 0 : undefined}
    aria-label={ariaLabel}
    onKeyDown={onClick ? (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    } : undefined}
    style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      padding,
      boxShadow: shadows.card,
      cursor: onClick ? 'pointer' : 'default',
      transition: motionTokens.cardLift,
      transform: 'translateY(0)',
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = shadows.cardHover;
        el.style.transform = 'translateY(-2px)';
      }
    }}
    onMouseLeave={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = shadows.card;
        el.style.transform = 'translateY(0)';
      }
    }}
    onMouseDown={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0) scale(0.995)';
        el.style.boxShadow = shadows.card;
      }
    }}
    onMouseUp={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = shadows.cardHover;
      }
    }}
  >
    {children}
  </div>
));

// ─── Btn ────────────────────────────────────────────────────────────────────
// Purpose driven buttons. Orange = action. Everything else is quiet.

interface BtnProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  'aria-label'?: string;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
}

export const Btn: React.FC<BtnProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  'aria-label': ariaLabel,
  type = 'button',
  style: styleProp,
}) => {
  const variants = {
    primary: {
      bg: colors.primaryOrange,
      color: colors.white,
      hover: colors.orangeHover,
      border: 'none',
    },
    secondary: {
      bg: colors.surfaceFlat,
      color: colors.textPrimary,
      hover: colors.border,
      border: 'none',
    },
    ghost: {
      bg: 'transparent',
      color: colors.textSecondary,
      hover: colors.surfaceFlat,
      border: 'none',
    },
    danger: {
      bg: colors.red,
      color: colors.white,
      hover: colors.statusCritical,
      border: 'none',
    },
  };

  const sizes = {
    sm: { padding: `${spacing.sm} ${spacing.lg}`, fontSize: typography.fontSize.sm },
    md: { padding: `${spacing.md} ${spacing.xl}`, fontSize: typography.fontSize.base },
    lg: { padding: `${spacing.lg} ${spacing.xxl}`, fontSize: typography.fontSize.lg },
  };

  const v = variants[variant];
  const s = sizes[size];

  const pressedBg: Record<string, string> = {
    primary: colors.orangePressed,
    secondary: colors.surfaceInset,
    ghost: colors.surfaceInset,
    danger: colors.statusCritical,
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      style={{
        display: 'inline-flex',
        width: fullWidth ? '100%' : 'auto',
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily,
        backgroundColor: v.bg,
        color: v.color,
        border: v.border,
        borderRadius: borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `all ${duration.instant}ms ${easing.standard}, transform ${duration.fast}ms ${easing.spring}`,
        transform: 'scale(1)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        boxShadow: shadows.none,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.backgroundColor = v.hover;
          el.style.boxShadow = shadows.sm;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.backgroundColor = v.bg;
          el.style.transform = 'scale(1)';
          el.style.boxShadow = shadows.none;
        }
      }}
      onMouseDown={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'scale(0.98)';
          el.style.backgroundColor = pressedBg[variant];
          el.style.boxShadow = shadows.none;
        }
      }}
      onMouseUp={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'scale(1)';
          el.style.backgroundColor = v.hover;
          el.style.boxShadow = shadows.sm;
        }
      }}
    >
      {icon && iconPosition === 'left' && <span style={{ display: 'flex' }}>{icon}</span>}
      {children}
      {icon && iconPosition === 'right' && <span style={{ display: 'flex' }}>{icon}</span>}
    </button>
  );
};

// ─── MetricBox ──────────────────────────────────────────────────────────────
// No icon. The number speaks for itself. Label, value, optional trend.

const TREND_COLORS = {
  success: '#4EC896',
  warning: '#F5A623',
  danger: '#E74C3C',
} as const;

function formatMetricValue(value: number, format: 'currency' | 'percent' | 'number'): string {
  if (format === 'currency') {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  }
  if (format === 'percent') return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

interface MetricBoxProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode; // kept for backwards compat but ignored
  warning?: string; // amber caution icon with tooltip when data may be incomplete
  previousValue?: number;
  colorOverride?: 'success' | 'warning' | 'danger';
  format?: 'currency' | 'percent' | 'number';
}

export const MetricBox: React.FC<MetricBoxProps> = React.memo(({
  label,
  value,
  unit,
  change,
  changeLabel,
  warning,
  previousValue,
  colorOverride,
  format,
}) => {
  const trendPercent = (typeof value === 'number' && previousValue)
    ? ((value - previousValue) / Math.abs(previousValue)) * 100
    : null;

  const displayValue = typeof value === 'number' && format
    ? formatMetricValue(value, format)
    : value;

  const valueColor = colorOverride ? TREND_COLORS[colorOverride] : colors.textPrimary;

  return (
  <div
    role="group"
    aria-label={`${label}: ${value}${unit ? ` ${unit}` : ''}${warning ? ` (${warning})` : ''}`}
    className="sitesync-metric-box"
    style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      boxShadow: shadows.base,
      transition: motionTokens.cardLift,
      transform: 'translateY(0)',
    }}
    onMouseEnter={(e) => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.boxShadow = shadows.cardHover;
      el.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.boxShadow = shadows.base;
      el.style.transform = 'translateY(0)';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing['3'] }}>
      <p
        style={{
          fontSize: typography.fontSize.label,
          color: colors.textTertiary,
          margin: 0,
          fontWeight: typography.fontWeight.medium,
          letterSpacing: typography.letterSpacing.wider,
          textTransform: 'uppercase' as const,
        }}
      >
        {label}
      </p>
      {warning && (
        <span title={warning} style={{ display: 'flex', alignItems: 'center', cursor: 'help', flexShrink: 0 }}>
          <AlertTriangle size={13} color={colors.statusPending} />
        </span>
      )}
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm }}>
      <p
        style={{
          fontSize: typography.fontSize['4xl'],
          fontWeight: typography.fontWeight.semibold,
          color: valueColor,
          margin: 0,
          letterSpacing: typography.letterSpacing.tighter,
          lineHeight: typography.lineHeight.none,
          fontVariantNumeric: 'tabular-nums' as const,
        }}
      >
        {displayValue}
      </p>
      {unit && (
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, fontWeight: typography.fontWeight.medium }}>
          {unit}
        </p>
      )}
    </div>
    {trendPercent !== null ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
        {trendPercent >= 0
          ? <TrendingUp size={12} color={TREND_COLORS.success} aria-hidden="true" />
          : <TrendingDown size={12} color={TREND_COLORS.danger} aria-hidden="true" />
        }
        <p
          style={{
            fontSize: 12,
            color: trendPercent >= 0 ? TREND_COLORS.success : TREND_COLORS.danger,
            margin: 0,
            fontWeight: typography.fontWeight.medium,
          }}
        >
          {trendPercent >= 0 ? '+' : ''}{trendPercent.toFixed(1)}%
        </p>
      </div>
    ) : change !== undefined && changeLabel ? (
      <p
        style={{
          fontSize: typography.fontSize.sm,
          color: change >= 0 ? colors.statusActive : colors.statusCritical,
          margin: 0,
          marginTop: spacing.sm,
          fontWeight: typography.fontWeight.medium,
        }}
      >
        {change >= 0 ? '+' : ''}{change}% {changeLabel}
      </p>
    ) : null}
  </div>
  );
});

// ─── Tag ────────────────────────────────────────────────────────────────────
// Small, round, quiet. Whispers, not shouts.

interface TagProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
}

export const Tag: React.FC<TagProps> = React.memo(({
  label,
  color = colors.textSecondary,
  backgroundColor = colors.surfaceFlat,
  fontSize = typography.fontSize.caption,
}) => (
  <span
    style={{
      display: 'inline-block',
      padding: `${spacing['0.5']} ${spacing['2']}`,
      borderRadius: borderRadius.sm,
      backgroundColor,
      color,
      fontSize,
      fontWeight: typography.fontWeight.medium,
      whiteSpace: 'nowrap',
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.wide,
      transition: `box-shadow ${duration.instant}ms ${easing.standard}, filter ${duration.instant}ms ${easing.standard}`,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLSpanElement).style.boxShadow = shadows.sm;
      (e.currentTarget as HTMLSpanElement).style.filter = 'saturate(1.2)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLSpanElement).style.boxShadow = 'none';
      (e.currentTarget as HTMLSpanElement).style.filter = 'none';
    }}
  >
    {label}
  </span>
));

// ─── StatusTag ──────────────────────────────────────────────────────────────

interface StatusTagProps {
  status: 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval';
  label?: string;
}

export const StatusTag: React.FC<StatusTagProps> = React.memo(({ status, label }) => {
  const statusConfig: Record<string, { bg: string; color: string; text: string }> = {
    pending: { bg: colors.statusPendingSubtle, color: colors.statusPending, text: 'Pending' },
    approved: { bg: colors.statusActiveSubtle, color: colors.statusActive, text: 'Approved' },
    under_review: { bg: colors.statusInfoSubtle, color: colors.statusInfo, text: 'Under Review' },
    revise_resubmit: { bg: colors.statusCriticalSubtle, color: colors.statusCritical, text: 'Revise & Resubmit' },
    complete: { bg: colors.statusActiveSubtle, color: colors.statusActive, text: 'Complete' },
    active: { bg: colors.statusActiveSubtle, color: colors.statusActive, text: 'Active' },
    closed: { bg: colors.statusNeutralSubtle, color: colors.statusNeutral, text: 'Closed' },
    pending_approval: { bg: colors.statusPendingSubtle, color: colors.statusPending, text: 'Pending Approval' },
  };
  const config = statusConfig[status] || statusConfig.pending;
  return <Tag label={label || config.text} color={config.color} backgroundColor={config.bg} />;
});

// ─── PriorityTag ────────────────────────────────────────────────────────────

interface PriorityTagProps {
  priority: 'low' | 'medium' | 'high' | 'critical';
  label?: string;
}

export const PriorityTag: React.FC<PriorityTagProps> = React.memo(({ priority, label }) => {
  const priorityConfig: Record<string, { bg: string; color: string; text: string }> = {
    low: { bg: colors.statusInfoSubtle, color: colors.statusInfo, text: 'Low' },
    medium: { bg: colors.statusPendingSubtle, color: colors.statusPending, text: 'Medium' },
    high: { bg: colors.orangeSubtle, color: colors.orangeText, text: 'High' },
    critical: { bg: colors.statusCriticalSubtle, color: colors.statusCritical, text: 'Critical' },
  };
  const config = priorityConfig[priority];
  return <Tag label={label || config.text} color={config.color} backgroundColor={config.bg} />;
});

// ─── SectionHeader ──────────────────────────────────────────────────────────
// Clean section label. No subtitle noise.

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = React.memo(({ title, action }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing['4'],
    }}
  >
    <h2
      style={{
        fontSize: typography.fontSize.title,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        margin: 0,
        letterSpacing: typography.letterSpacing.tight,
        lineHeight: typography.lineHeight.snug,
      }}
    >
      {title}
    </h2>
    {action}
  </div>
));

// ─── TableHeader ────────────────────────────────────────────────────────────
// Quiet column labels. No uppercase shouting. No background fill.

interface TableHeaderProps {
  columns: Array<{ label: string; width?: string }>;
}

export const TableHeader: React.FC<TableHeaderProps> = React.memo(({ columns }) => (
  <div
    role="row"
    style={{
      display: 'grid',
      gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' '),
      padding: `${spacing['2.5']} ${spacing['5']}`,
      borderBottom: `1px solid ${colors.borderDefault}`,
      position: 'sticky',
      top: 0,
      backgroundColor: colors.surfaceInset,
      zIndex: zIndex.base,
    }}
  >
    {columns.map((col, i) => (
      <p
        key={i}
        role="columnheader"
        style={{
          fontSize: typography.fontSize.label,
          fontWeight: typography.fontWeight.medium,
          color: colors.textTertiary,
          margin: 0,
          letterSpacing: typography.letterSpacing.wide,
        }}
      >
        {col.label}
      </p>
    ))}
  </div>
));

// ─── TableRow ───────────────────────────────────────────────────────────────
// Breathing room. Soft hover. No harsh dividers.

interface TableRowProps {
  columns: Array<{ content: React.ReactNode; width?: string }>;
  onClick?: () => void;
  divider?: boolean;
  selected?: boolean;
}

export const TableRow: React.FC<TableRowProps> = React.memo(({ columns, onClick, divider = true, selected = false }) => {
  const baseBg = selected ? colors.surfaceSelected : colors.surfaceRaised;
  return (
  <div
    role="row"
    aria-selected={selected || undefined}
    onClick={onClick}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    } : undefined}
    style={{
      display: 'grid',
      gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' '),
      padding: `${spacing['3.5']} ${spacing['5']}`,
      borderBottom: divider ? `1px solid ${colors.borderSubtle}` : 'none',
      backgroundColor: baseBg,
      cursor: onClick ? 'pointer' : 'default',
      transition: `background-color ${duration.instant}ms ${easing.standard}, border-left ${duration.instant}ms ${easing.standard}`,
      alignItems: 'center',
      borderLeft: selected ? `3px solid ${colors.primaryOrange}` : '3px solid transparent',
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.backgroundColor = selected ? colors.surfaceSelected : colors.surfaceHover;
        if (!selected) el.style.borderLeft = `3px solid ${colors.primaryOrange}`;
      }
    }}
    onMouseLeave={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.backgroundColor = baseBg;
        if (!selected) el.style.borderLeft = '3px solid transparent';
      }
    }}
  >
    {columns.map((col, i) => (
      <div key={i} role="cell">{col.content}</div>
    ))}
  </div>
  );
});

// ─── Modal ──────────────────────────────────────────────────────────────────
// Soft, spacious dialog. No header border. Blurred backdrop.

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, width = '600px' }) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      setTimeout(() => dialogRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal as number,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.overlayDark,
        backdropFilter: 'blur(8px)',
        animation: `fadeIn ${duration.normal}ms ${easing.enter}`,
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          width,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          animation: `modalIn ${duration.smooth}ms ${easing.apple}`,
          boxShadow: shadows.lg,
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${spacing.xl} ${spacing.xl} 0`,
          }}
        >
          <h2
            id={titleId}
            style={{
              fontSize: typography.fontSize['3xl'],
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              margin: 0,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: borderRadius.full,
              cursor: 'pointer',
              color: colors.textTertiary,
              transition: `background-color ${duration.instant}ms ${easing.standard}, color ${duration.instant}ms ${easing.standard}, transform ${duration.fast}ms ${easing.spring}`,
              transform: 'scale(1)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = colors.surfaceHover;
              el.style.color = colors.textPrimary;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = 'transparent';
              el.style.color = colors.textTertiary;
              el.style.transform = 'scale(1)';
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceInset;
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: spacing.xl }}>{children}</div>
      </div>
    </div>
  );
};

// ─── TabBar ─────────────────────────────────────────────────────────────────
// Clean text tabs. Active = bold + orange underline. No container box.

interface TabBarProps {
  tabs: Array<{ id: string; label: string; count?: number }>;
  activeTab: string;
  onChange: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = React.memo(({ tabs, activeTab, onChange }) => (
  <div role="tablist" style={{ display: 'flex', gap: spacing.xl, position: 'relative' }}>
    {tabs.map((tab) => {
      const isActive = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          role="tab"
          aria-selected={isActive}
          aria-controls={`tabpanel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          style={{
            padding: `${spacing.sm} 0`,
            fontSize: typography.fontSize.base,
            fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
            fontFamily: typography.fontFamily,
            backgroundColor: 'transparent',
            color: isActive ? colors.textPrimary : colors.textTertiary,
            border: 'none',
            borderBottom: isActive ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
            cursor: 'pointer',
            transition: `color ${duration.instant}ms ${easing.standard}, border-color ${duration.normal}ms ${easing.standard}, font-weight ${duration.fast}ms ${easing.standard}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
          }}
          onMouseEnter={(e) => {
            if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
          }}
          onMouseLeave={(e) => {
            if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary;
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              style={{
                fontSize: typography.fontSize.xs,
                color: isActive ? colors.textSecondary : colors.textTertiary,
                fontWeight: typography.fontWeight.medium,
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
));

// ─── Avatar ─────────────────────────────────────────────────────────────────
// Soft pastel colors. Round. Clean initials.

interface AvatarProps {
  initials: string;
  size?: number;
  color?: string;
}

const avatarColors = [
  '#818CF8', '#A78BFA', '#F472B6', '#FB7185', '#FB923C',
  '#34D399', '#2DD4BF', '#60A5FA', '#22D3EE', '#A3E635',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

export const Avatar: React.FC<AvatarProps> = React.memo(({ initials, size = 36, color }) => {
  const bg = color || avatarColors[hashStr(initials) % avatarColors.length];
  return (
    <div
      role="img"
      aria-label={`Avatar: ${initials}`}
      style={{
        width: size,
        height: size,
        borderRadius: borderRadius.full,
        backgroundColor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.white,
        fontSize: size >= 36 ? typography.fontSize.sm : typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
});

// ─── ProgressBar ────────────────────────────────────────────────────────────
// Clean bar. Rounded ends. Soft track.

interface ProgressBarProps {
  value: number;
  max?: number;
  height?: number;
  color?: string;
  bgColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = React.memo(({
  value,
  max = 100,
  height = 3,
  color = colors.primaryOrange,
  bgColor = colors.surfaceInset,
}) => (
  <div
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-label={`${Math.round((value / max) * 100)}% complete`}
    style={{
      width: '100%',
      height,
      borderRadius: borderRadius.full,
      backgroundColor: bgColor,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        height: '100%',
        width: `${Math.min((value / max) * 100, 100)}%`,
        backgroundColor: color,
        borderRadius: borderRadius.full,
        transition: `width ${transitions.slow}`,
      }}
    />
  </div>
));

// ─── Dot ────────────────────────────────────────────────────────────────────

interface DotProps {
  color?: string;
  pulse?: boolean;
  size?: number;
}

export const Dot: React.FC<DotProps> = React.memo(({ color = colors.green, pulse = false, size = 8 }) => (
  <div
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      backgroundColor: color,
      animation: pulse ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
      flexShrink: 0,
    }}
  />
));

// ─── AIRing ─────────────────────────────────────────────────────────────────

interface AIRingProps {
  score: number;
  label?: string;
  size?: number;
}

export const AIRing: React.FC<AIRingProps> = ({ score, label, size = 80 }) => {
  const r = (size / 2) - 6;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? colors.tealSuccess : score >= 60 ? colors.amber : colors.red;

  return (
    <div role="group" aria-label={`${label || 'Score'}: ${score} out of 100`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.sm }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.borderLight} strokeWidth="5" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>
            {score}
          </span>
        </div>
      </div>
      {label && <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, textAlign: 'center' }}>{label}</p>}
    </div>
  );
};

// ─── InputField ─────────────────────────────────────────────────────────────
// Clean input. No border at rest. Focus reveals orange.

interface InputFieldProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: React.ReactNode;
  error?: string;
  required?: boolean;
  id?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  icon,
  error,
  required,
  id: externalId,
}) => {
  const autoId = useId();
  const inputId = externalId || autoId;
  const errorId = `${inputId}-error`;
  const [focused, setFocused] = useState(false);

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `${spacing.md} ${spacing.lg}`,
          backgroundColor: colors.surfaceFlat,
          borderRadius: borderRadius.md,
          border: focused ? `1px solid ${colors.primaryOrange}` : `1px solid transparent`,
          transition: `border-color ${transitions.fast}`,
        }}
      >
        {icon && <span style={{ color: colors.textTertiary, display: 'flex' }} aria-hidden="true">{icon}</span>}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-label={!label ? placeholder : undefined}
          style={{
            flex: 1,
            border: 'none',
            backgroundColor: 'transparent',
            outline: 'none',
            fontSize: typography.fontSize.base,
            fontFamily: typography.fontFamily,
            color: colors.textPrimary,
          }}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" style={{ fontSize: typography.fontSize.xs, color: colors.red, margin: 0, marginTop: spacing.xs }}>
          {error}
        </p>
      )}
    </div>
  );
};

// ─── EmptyState ─────────────────────────────────────────────────────────────
// Centered, quiet, helpful.

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

// ─── RelatedItems ───────────────────────────────────────────────────────────
// Cross-domain links. The connective tissue of the entire product.

const entityIcons: Record<EntityType, React.FC<{ size: number; color?: string }>> = {
  task: LayoutGrid,
  rfi: HelpCircle,
  submittal: ClipboardList,
  schedule_phase: Calendar,
  change_order: DollarSign,
  person: User,
  crew: Users,
  punch_item: CheckCircle,
  drawing: FileText,
};

interface RelatedItemsProps {
  items: RelatedItem[];
  onNavigate: (route: string) => void;
}

export const RelatedItems: React.FC<RelatedItemsProps> = ({ items, onNavigate }) => {
  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: spacing['8'] }}>
      <p style={{
        fontSize: typography.fontSize.label,
        fontWeight: typography.fontWeight.medium,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing?.wider || '0.4px',
        margin: 0,
        marginBottom: spacing['3'],
      }}>
        Related
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
        {items.map((item, idx) => {
          const IconComp = entityIcons[item.entityType] || FileText;
          return (
            <button
              key={`${item.entityType}-${item.id}-${idx}`}
              onClick={() => onNavigate(item.navigateTo)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
                padding: `${spacing['3']} ${spacing['4']}`,
                backgroundColor: colors.surfaceFlat,
                border: 'none',
                borderRadius: borderRadius.md,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: typography.fontFamily,
                transition: `background-color ${transitions.quick}`,
                width: '100%',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat; }}
            >
              <IconComp size={15} color={colors.textTertiary} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </p>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>
                  {item.subtitle}
                </p>
              </div>
              <ChevronRight size={14} color={colors.textTertiary} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Toast System ───────────────────────────────────────────────────────────
// Feedback for every action. Slide in top-right, auto-dismiss.

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  action?: ToastAction;
  dismissing?: boolean;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string, action?: ToastAction) => void;
}

export const ToastContext = createContext<ToastContextType>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((type: ToastType, message: string, action?: ToastAction) => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, type, message, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, dismissing: true } : t));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
    }, 3500);
  }, []);

  const toastIcons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={16} />,
    error: <XCircle size={16} />,
    warning: <AlertTriangle size={16} />,
    info: <Info size={16} />,
  };

  const toastColors: Record<ToastType, string> = {
    success: colors.tealSuccess,
    error: colors.red,
    warning: colors.amber,
    info: colors.blue,
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div aria-live="polite" aria-atomic="false" role="status" style={{ position: 'fixed', top: spacing.xl, right: spacing.xl, zIndex: zIndex.tooltip as number, display: 'flex', flexDirection: 'column', gap: spacing.sm, pointerEvents: 'none' }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.md,
              padding: `${spacing.md} ${spacing.xl}`,
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.lg,
              boxShadow: shadows.md,
              borderLeft: `3px solid ${toastColors[toast.type]}`,
              animation: toast.dismissing ? `toastOut ${duration.smooth}ms ${easing.exit} forwards` : `toastIn ${duration.smooth}ms ${easing.spring}`,
              pointerEvents: 'auto',
              minWidth: '280px',
              maxWidth: '400px',
            }}
          >
            <span style={{ color: toastColors[toast.type], display: 'flex' }}>{toastIcons[toast.type]}</span>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, flex: 1 }}>{toast.message}</span>
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                style={{
                  flexShrink: 0,
                  padding: `2px ${spacing.md}`,
                  backgroundColor: toastColors[toast.type],
                  color: '#fff',
                  border: 'none',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ─── Command Palette ────────────────────────────────────────────────────────
// Cmd+K intelligent search with recent items, quick actions, and keyboard nav.

interface CommandItem {
  id: string;
  label: string;
  section: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  subtitle?: string;
  shortcut?: string;
}

interface CommandPaletteProps {
  items: CommandItem[];
}

const RECENT_KEY = 'sitesync-recent-commands';
function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecent(id: string) {
  const recent = getRecent().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 8)));
}

// Natural language patterns
function parseNaturalLanguage(q: string): { type: string; value: string } | null {
  const rfiMatch = q.match(/(?:jump to |go to |open )?rfi[# -]?(\d+)/i);
  if (rfiMatch) return { type: 'rfi', value: rfiMatch[1] };
  const subMatch = q.match(/(?:jump to |go to |open )?sub[# -]?(\d+)/i);
  if (subMatch) return { type: 'submittal', value: subMatch[1] };
  const taskMatch = q.match(/(?:jump to |go to |open )?task[# -]?(\d+)/i);
  if (taskMatch) return { type: 'task', value: taskMatch[1] };
  return null;
}

const quickActions: CommandItem[] = [
  { id: 'qa-create-rfi', label: 'Create RFI', section: 'Quick Actions', icon: <ChevronRight size={14} />, onSelect: () => {}, subtitle: 'Start a new RFI', shortcut: '⌘+Shift+R' },
  { id: 'qa-daily-log', label: 'Log Daily Report', section: 'Quick Actions', icon: <ChevronRight size={14} />, onSelect: () => {}, subtitle: 'Submit today\'s daily log' },
  { id: 'qa-punch-item', label: 'Add Punch Item', section: 'Quick Actions', icon: <ChevronRight size={14} />, onSelect: () => {}, subtitle: 'Create a new punch list entry' },
  { id: 'qa-field-capture', label: 'Quick Photo Capture', section: 'Quick Actions', icon: <ChevronRight size={14} />, onSelect: () => {}, subtitle: 'Upload a field photo' },
];

const aiSuggestions: CommandItem[] = [
  { id: 'ai-1', label: 'Review steel delivery recovery options', section: 'AI Suggested', icon: <Info size={14} />, onSelect: () => {}, subtitle: 'Based on active delay risk' },
  { id: 'ai-2', label: 'Check structural budget contingency', section: 'AI Suggested', icon: <AlertTriangle size={14} />, onSelect: () => {}, subtitle: 'Division at 97% spend' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Build flat list of all visible items
  const recentIds = getRecent();
  const nlMatch = query ? parseNaturalLanguage(query) : null;

  const allItems: CommandItem[] = (() => {
    if (!query) {
      // Show: recent > quick actions > ai suggestions > pages
      const recentItems = recentIds
        .map((id) => items.find((i) => i.id === id))
        .filter(Boolean)
        .map((i) => ({ ...i!, section: 'Recent' }));
      const pageItems = items.filter((i) => i.section === 'Pages');
      return [...recentItems, ...quickActions, ...aiSuggestions, ...pageItems];
    }

    if (nlMatch) {
      // Natural language match: find the specific entity
      const matchedItems = items.filter((item) => {
        if (nlMatch.type === 'rfi') return item.section === 'RFIs' && item.label.includes(nlMatch.value);
        if (nlMatch.type === 'task') return item.section === 'Tasks';
        if (nlMatch.type === 'submittal') return item.section === 'Submittals';
        return false;
      });
      if (matchedItems.length > 0) return matchedItems;
    }

    // Fuzzy search across all items + quick actions
    const lq = query.toLowerCase();
    const searchable = [...items, ...quickActions];
    return searchable.filter((item) =>
      item.label.toLowerCase().includes(lq) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(lq))
    );
  })();

  const sections = Array.from(new Set(allItems.map((i) => i.section)));
  const flatList = allItems;

  const handleSelect = useCallback((item: CommandItem) => {
    addRecent(item.id);
    item.onSelect();
    setOpen(false);
    setQuery('');
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatList[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatList[selectedIndex]);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  if (!open) return null;

  let flatIdx = -1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: zIndex.command as number,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh', backgroundColor: colors.overlayDark, backdropFilter: 'blur(4px)',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          width: '600px', maxWidth: '90vw', backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl, boxShadow: shadows.lg, overflow: 'hidden',
          animation: `scaleIn ${duration.normal}ms ${easing.apple}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.lg} ${spacing.xl}`, borderBottom: `1px solid ${colors.borderLight}` }}>
          <Search size={18} color={colors.textTertiary} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or type a command..."
            aria-label="Search or type a command"
            role="combobox"
            aria-expanded={true}
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={flatList[selectedIndex] ? `cmd-item-${flatList[selectedIndex].id}` : undefined}
            style={{
              flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none',
              fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily, color: colors.textPrimary,
            }}
          />
          <kbd style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, backgroundColor: colors.surfaceFlat, padding: `${spacing['0.5']} ${spacing['1.5']}`, borderRadius: borderRadius.sm }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} id="command-palette-results" role="listbox" style={{ maxHeight: '420px', overflowY: 'auto', padding: spacing.sm }}>
          {sections.map((section) => {
            const sectionItems = allItems.filter((i) => i.section === section);
            return (
              <div key={section} role="group" aria-label={section}>
                <p style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, padding: `${spacing.sm} ${spacing.md}`, margin: 0, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                  {section}
                </p>
                {sectionItems.map((item) => {
                  flatIdx++;
                  const idx = flatIdx;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      id={`cmd-item-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-idx={idx}
                      onClick={() => handleSelect(item)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: spacing.md,
                        padding: `${spacing.md} ${spacing.lg}`,
                        backgroundColor: isSelected ? colors.surfaceFlat : 'transparent',
                        border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
                        fontSize: typography.fontSize.base, fontFamily: typography.fontFamily,
                        color: colors.textPrimary, textAlign: 'left',
                        transition: `background-color ${transitions.fast}`,
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      {item.icon && <span style={{ color: colors.textTertiary, display: 'flex', flexShrink: 0 }}>{item.icon}</span>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block' }}>{item.label}</span>
                        {item.subtitle && (
                          <span style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtitle}</span>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, backgroundColor: colors.surfaceInset, padding: `${spacing['0.5']} ${spacing['1.5']}`, borderRadius: borderRadius.sm, flexShrink: 0, fontFamily: typography.fontFamilyMono }}>{item.shortcut}</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {flatList.length === 0 && (
            <p style={{ padding: spacing.xl, textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
              No results for &quot;{query}&quot;
            </p>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], padding: `${spacing['2']} ${spacing.xl}`, borderTop: `1px solid ${colors.borderLight}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            <kbd style={{ fontSize: typography.fontSize.caption, backgroundColor: colors.surfaceInset, padding: `${spacing['0.5']} ${spacing['1']}`, borderRadius: borderRadius.sm, fontFamily: typography.fontFamilyMono }}>↑↓</kbd> navigate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            <kbd style={{ fontSize: typography.fontSize.caption, backgroundColor: colors.surfaceInset, padding: `${spacing['0.5']} ${spacing['1']}`, borderRadius: borderRadius.sm, fontFamily: typography.fontFamilyMono }}>↵</kbd> select
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            <kbd style={{ fontSize: typography.fontSize.caption, backgroundColor: colors.surfaceInset, padding: `${spacing['0.5']} ${spacing['1']}`, borderRadius: borderRadius.sm, fontFamily: typography.fontFamilyMono }}>esc</kbd> close
          </span>
          <span style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Try &quot;RFI 004&quot; or &quot;Create RFI&quot;
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── DetailPanel ────────────────────────────────────────────────────────────
// Reusable right-side slide panel for any entity detail view.

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ open, onClose, title, children, width = '520px' }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      setTimeout(() => panelRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Focus trap + Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: colors.overlayDark, zIndex: (zIndex.modal as number) - 1, animation: `fadeIn ${duration.normal}ms ${easing.enter}` }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width, maxWidth: '90vw',
          backgroundColor: colors.surfaceRaised, boxShadow: shadows.lg,
          zIndex: zIndex.modal as number, overflowY: 'auto',
          animation: `slideInRight ${duration.smooth}ms ${easing.standard}`,
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing.lg} ${spacing.xl}`, position: 'sticky', top: 0, backgroundColor: colors.surfaceRaised, zIndex: 1, borderBottom: `1px solid ${colors.borderLight}` }}>
          <h2 id={titleId} style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close panel"
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.full,
              cursor: 'pointer', color: colors.textTertiary,
              transition: `background-color ${duration.instant}ms ${easing.standard}, color ${duration.instant}ms ${easing.standard}, transform ${duration.fast}ms ${easing.spring}`,
              transform: 'scale(1)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = colors.surfaceHover;
              el.style.color = colors.textPrimary;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = 'transparent';
              el.style.color = colors.textTertiary;
              el.style.transform = 'scale(1)';
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceInset;
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: spacing.xl }}>{children}</div>
      </div>
    </>
  );
};

// ─── Skeleton ───────────────────────────────────────────────────────────────
// Loading placeholder with shimmer.

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
}

export const Skeleton: React.FC<SkeletonProps> = React.memo(({ width = '100%', height = '16px', borderRadius: br = borderRadius.md }) => (
  <div
    aria-hidden="true"
    style={{
      width, height, borderRadius: br,
      background: `linear-gradient(90deg, ${colors.surfaceFlat} 25%, ${colors.borderLight} 50%, ${colors.surfaceFlat} 75%)`,
      backgroundSize: '800px 100%',
      animation: 'shimmer 1.5s linear infinite',
    }}
  />
));

export const EmptyState: React.FC<EmptyStateProps> = React.memo(({ icon, title, description, action }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${spacing['3xl']} ${spacing.xl}`,
      textAlign: 'center',
    }}
  >
    <div style={{ color: colors.textTertiary, marginBottom: spacing.lg }}>{icon}</div>
    <h3
      style={{
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.medium,
        color: colors.textSecondary,
        margin: 0,
        marginBottom: spacing.sm,
      }}
    >
      {title}
    </h3>
    {description && (
      <p style={{ fontSize: typography.fontSize.base, color: colors.textTertiary, margin: 0, maxWidth: '360px', marginBottom: spacing.xl }}>
        {description}
      </p>
    )}
    {action}
  </div>
));
