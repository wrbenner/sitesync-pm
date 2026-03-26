import React from 'react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';

// Dot
interface DotProps {
  color?: string;
  pulse?: boolean;
  size?: number;
}
export const Dot: React.FC<DotProps> = ({ color = colors.positive, pulse = false, size = 6 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
      animation: pulse ? 'pulse-dot 2.5s ease-in-out infinite' : 'none',
    }}
  />
);

// Tag
interface TagProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
}
export const Tag: React.FC<TagProps> = ({
  label,
  color = colors.textSecondary,
  backgroundColor = colors.surfaceElevated,
  fontSize = typography.fontSize.xs,
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: `2px ${spacing['2']}`,
      borderRadius: borderRadius.sm,
      background: backgroundColor,
      color,
      fontSize,
      fontWeight: typography.fontWeight.medium,
      whiteSpace: 'nowrap',
      letterSpacing: '-0.01em',
    }}
  >
    {label}
  </span>
);

// StatusTag
type StatusType = 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed';
interface StatusTagProps {
  status: StatusType;
  label?: string;
}
const statusConfig: Record<StatusType, { bg: string; color: string; text: string }> = {
  pending:        { bg: colors.cautionDim,  color: colors.caution,   text: 'Pending' },
  approved:       { bg: colors.positiveDim, color: colors.positive,  text: 'Approved' },
  under_review:   { bg: colors.infoDim,     color: colors.info,      text: 'In Review' },
  revise_resubmit:{ bg: colors.criticalDim, color: colors.critical,  text: 'Revise' },
  complete:       { bg: colors.positiveDim, color: colors.positive,  text: 'Complete' },
  active:         { bg: colors.positiveDim, color: colors.positive,  text: 'Active' },
  closed:         { bg: colors.surfaceElevated, color: colors.textTertiary, text: 'Closed' },
};
export const StatusTag: React.FC<StatusTagProps> = ({ status, label }) => {
  const c = statusConfig[status];
  return <Tag label={label || c.text} color={c.color} backgroundColor={c.bg} />;
};

// PriorityTag
type PriorityType = 'low' | 'medium' | 'high' | 'critical';
interface PriorityTagProps {
  priority: PriorityType;
  label?: string;
}
const priorityConfig: Record<PriorityType, { bg: string; color: string; text: string }> = {
  low:      { bg: colors.infoDim,     color: colors.info,     text: 'Low' },
  medium:   { bg: colors.cautionDim,  color: colors.caution,  text: 'Medium' },
  high:     { bg: 'rgba(232,128,74,0.12)', color: colors.signal, text: 'High' },
  critical: { bg: colors.criticalDim, color: colors.critical, text: 'Critical' },
};
export const PriorityTag: React.FC<PriorityTagProps> = ({ priority, label }) => {
  const c = priorityConfig[priority];
  return <Tag label={label || c.text} color={c.color} backgroundColor={c.bg} />;
};

// Btn
interface BtnProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
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
}) => {
  const variantStyles = {
    primary:   { bg: colors.signal,           color: colors.white,        hover: colors.signalHover,       border: 'transparent' },
    secondary: { bg: colors.surfaceElevated,  color: colors.textSecondary, hover: colors.surfaceHover,    border: colors.borderSubtle },
    ghost:     { bg: 'transparent',           color: colors.textSecondary, hover: colors.surfaceElevated,  border: 'transparent' },
    danger:    { bg: colors.criticalDim,       color: colors.critical,     hover: 'rgba(224,82,82,0.2)',   border: colors.critical },
  };
  const sizeStyles = {
    sm: { padding: `5px ${spacing['3']}`,  fontSize: typography.fontSize.xs, gap: spacing['1'] },
    md: { padding: `7px ${spacing['4']}`,  fontSize: typography.fontSize.base, gap: spacing['2'] },
    lg: { padding: `10px ${spacing['5']}`, fontSize: typography.fontSize.md, gap: spacing['2'] },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        width: fullWidth ? '100%' : 'auto',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily,
        letterSpacing: '-0.01em',
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: `all ${transitions.fast}`,
        whiteSpace: 'nowrap',
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = v.hover;
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = v.bg;
      }}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  );
};

// Card
interface CardProps {
  children: React.ReactNode;
  padding?: string;
  onClick?: () => void;
  noBorder?: boolean;
}
export const Card: React.FC<CardProps> = ({ children, padding = spacing['5'], onClick, noBorder = false }) => (
  <div
    onClick={onClick}
    style={{
      background: colors.surface,
      borderRadius: borderRadius.xl,
      padding,
      border: noBorder ? 'none' : `1px solid ${colors.borderFaint}`,
      cursor: onClick ? 'pointer' : 'default',
      transition: onClick ? `all ${transitions.fast}` : 'none',
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = colors.borderSubtle;
        el.style.background = colors.surfaceElevated;
      }
    }}
    onMouseLeave={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = colors.borderFaint;
        el.style.background = colors.surface;
      }
    }}
  >
    {children}
  </div>
);

// SectionHeader
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, action, eyebrow }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: spacing['4'],
      paddingBottom: spacing['3'],
      borderBottom: `1px solid ${colors.borderFaint}`,
    }}
  >
    <div>
      {eyebrow && (
        <p
          style={{
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.medium,
            color: colors.signal,
            letterSpacing: typography.letterSpacing.widest,
            textTransform: 'uppercase',
            margin: `0 0 4px`,
          }}
        >
          {eyebrow}
        </p>
      )}
      <h2
        style={{
          fontSize: typography.fontSize.xl,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          margin: 0,
          letterSpacing: typography.letterSpacing.tight,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            margin: `4px 0 0`,
            letterSpacing: '-0.01em',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
    {action}
  </div>
);

// MetricBox — the soul of the dashboard
interface MetricBoxProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  status?: 'positive' | 'caution' | 'critical' | 'neutral';
}
export const MetricBox: React.FC<MetricBoxProps> = ({
  label,
  value,
  unit,
  change,
  changeLabel,
  icon,
  accent = false,
  status = 'neutral',
}) => {
  const statusColor = {
    positive: colors.positive,
    caution: colors.caution,
    critical: colors.critical,
    neutral: colors.textTertiary,
  }[status];

  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${accent ? colors.signalDim : colors.borderFaint}`,
        borderRadius: borderRadius.xl,
        padding: spacing['5'],
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['2'],
        transition: `border-color ${transitions.fast}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {accent && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${colors.signal}60, transparent)`,
          }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p
          style={{
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.medium,
            color: colors.textTertiary,
            margin: 0,
            letterSpacing: typography.letterSpacing.wide,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </p>
        {icon && <div style={{ color: statusColor, opacity: 0.8 }}>{icon}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['1'] }}>
        <p
          style={{
            fontSize: typography.fontSize['4xl'],
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
            margin: 0,
            letterSpacing: typography.letterSpacing.tighter,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </p>
        {unit && (
          <p
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {unit}
          </p>
        )}
      </div>
      {change !== undefined && changeLabel && (
        <p
          style={{
            fontSize: typography.fontSize.xs,
            color: change >= 0 ? colors.positive : colors.critical,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {change >= 0 ? '+' : ''}{change}% {changeLabel}
        </p>
      )}
    </div>
  );
};

// AIRing
interface AIRingProps {
  score: number;
  label?: string;
  size?: number;
}
export const AIRing: React.FC<AIRingProps> = ({ score, label, size = 80 }) => {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? colors.positive : score >= 60 ? colors.caution : colors.critical;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'] }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={colors.borderSubtle} strokeWidth="3" />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: `stroke-dashoffset ${transitions.slow}` }}
          />
        </svg>
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <p
            style={{
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {score}
          </p>
        </div>
      </div>
      {label && (
        <p style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, margin: 0, textAlign: 'center' }}>
          {label}
        </p>
      )}
    </div>
  );
};

// TableHeader
interface TableHeaderProps {
  columns: Array<{ label: string; width?: string }>;
}
export const TableHeader: React.FC<TableHeaderProps> = ({ columns }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' '),
      gap: spacing['3'],
      padding: `${spacing['2']} ${spacing['5']}`,
      borderBottom: `1px solid ${colors.borderFaint}`,
    }}
  >
    {columns.map((col, i) => (
      <p
        key={i}
        style={{
          fontSize: '10px',
          fontWeight: typography.fontWeight.semibold,
          color: colors.textTertiary,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: typography.letterSpacing.widest,
        }}
      >
        {col.label}
      </p>
    ))}
  </div>
);

// TableRow
interface TableRowProps {
  columns: Array<{ content: React.ReactNode; width?: string }>;
  onClick?: () => void;
  divider?: boolean;
}
export const TableRow: React.FC<TableRowProps> = ({ columns, onClick, divider = true }) => (
  <div
    onClick={onClick}
    style={{
      display: 'grid',
      gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' '),
      gap: spacing['3'],
      padding: `${spacing['3']} ${spacing['5']}`,
      borderBottom: divider ? `1px solid ${colors.borderFaint}` : 'none',
      background: colors.surface,
      cursor: onClick ? 'pointer' : 'default',
      transition: `background ${transitions.fast}`,
      alignItems: 'center',
    }}
    onMouseEnter={(e) => {
      if (onClick) (e.currentTarget as HTMLDivElement).style.background = colors.surfaceElevated;
    }}
    onMouseLeave={(e) => {
      if (onClick) (e.currentTarget as HTMLDivElement).style.background = colors.surface;
    }}
  >
    {columns.map((col, i) => <div key={i}>{col.content}</div>)}
  </div>
);

// Divider
export const Divider: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => (
  <div
    style={{
      background: colors.borderFaint,
      width: vertical ? '1px' : '100%',
      height: vertical ? '100%' : '1px',
      flexShrink: 0,
    }}
  />
);

// Avatar
interface AvatarProps {
  initials: string;
  size?: number;
  color?: string;
}
export const Avatar: React.FC<AvatarProps> = ({ initials, size = 28, color = colors.signal }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: borderRadius.md,
      background: `${color}20`,
      border: `1px solid ${color}40`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color,
      fontSize: size <= 28 ? '10px' : typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      letterSpacing: '0.02em',
      flexShrink: 0,
    }}
  >
    {initials}
  </div>
);
