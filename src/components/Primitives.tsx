import React from 'react';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';

// Dot - Status indicator with optional pulse
interface DotProps {
  color?: string;
  pulse?: boolean;
  size?: number;
}

export const Dot: React.FC<DotProps> = ({ color = colors.green, pulse = false, size = 8 }) => (
  <div
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      backgroundColor: color,
      animation: pulse ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
    }}
  />
);

// Tag - Colored badge
interface TagProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
}

export const Tag: React.FC<TagProps> = ({
  label,
  color = colors.textPrimary,
  backgroundColor = colors.lightBackground,
  fontSize = typography.fontSize.xs,
}) => (
  <span
    style={{
      display: 'inline-block',
      padding: `${spacing.xs} ${spacing.sm}`,
      borderRadius: borderRadius.sm,
      backgroundColor,
      color,
      fontSize,
      fontWeight: typography.fontWeight.medium,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);

// Status Tag - For RFI/Submittal status
interface StatusTagProps {
  status: 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed';
  label?: string;
}

export const StatusTag: React.FC<StatusTagProps> = ({ status, label }) => {
  const statusConfig: Record<string, { bg: string; color: string; text: string }> = {
    pending: { bg: '#FEF3C7', color: '#92400E', text: 'Pending' },
    approved: { bg: '#DCFCE7', color: '#166534', text: 'Approved' },
    under_review: { bg: '#E0E7FF', color: '#3730A3', text: 'Under Review' },
    revise_resubmit: { bg: '#FEE2E2', color: '#991B1B', text: 'Revise & Resubmit' },
    complete: { bg: '#DCFCE7', color: '#166534', text: 'Complete' },
    active: { bg: '#DCFCE7', color: '#166534', text: 'Active' },
    closed: { bg: '#F3F4F6', color: '#374151', text: 'Closed' },
  };
  const config = statusConfig[status];

  return (
    <Tag
      label={label || config.text}
      color={config.color}
      backgroundColor={config.bg}
    />
  );
};

// Priority Tag - For RFI/Punch priority
interface PriorityTagProps {
  priority: 'low' | 'medium' | 'high' | 'critical';
  label?: string;
}

export const PriorityTag: React.FC<PriorityTagProps> = ({ priority, label }) => {
  const priorityConfig: Record<string, { bg: string; color: string; text: string }> = {
    low: { bg: '#DBEAFE', color: '#1E40AF', text: 'Low' },
    medium: { bg: '#FEF3C7', color: '#92400E', text: 'Medium' },
    high: { bg: '#FED7AA', color: '#9A3412', text: 'High' },
    critical: { bg: '#FEE2E2', color: '#991B1B', text: 'Critical' },
  };
  const config = priorityConfig[priority];

  return (
    <Tag
      label={label || config.text}
      color={config.color}
      backgroundColor={config.bg}
    />
  );
};

// Btn - Button
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
  const variants = {
    primary: {
      bg: colors.primaryOrange,
      color: colors.white,
      hover: '#E66B0F',
    },
    secondary: {
      bg: colors.border,
      color: colors.textPrimary,
      hover: '#D1D5DB',
    },
    ghost: {
      bg: 'transparent',
      color: colors.textPrimary,
      hover: colors.lightBackground,
    },
    danger: {
      bg: colors.red,
      color: colors.white,
      hover: '#DC2626',
    },
  };

  const sizes = {
    sm: {
      padding: `${spacing.xs} ${spacing.md}`,
      fontSize: typography.fontSize.sm,
    },
    md: {
      padding: `${spacing.sm} ${spacing.lg}`,
      fontSize: typography.fontSize.base,
    },
    lg: {
      padding: `${spacing.md} ${spacing.xl}`,
      fontSize: typography.fontSize.lg,
    },
  };

  const variantStyle = variants[variant];
  const sizeStyle = sizes[size];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        width: fullWidth ? '100%' : 'auto',
        padding: sizeStyle.padding,
        fontSize: sizeStyle.fontSize,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily,
        backgroundColor: variantStyle.bg,
        color: variantStyle.color,
        border: 'none',
        borderRadius: borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `background-color 150ms ease-in-out`,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = variantStyle.hover;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = variantStyle.bg;
      }}
    >
      {icon && iconPosition === 'left' && <span>{icon}</span>}
      {children}
      {icon && iconPosition === 'right' && <span>{icon}</span>}
    </button>
  );
};

// Card - Container component
interface CardProps {
  children: React.ReactNode;
  padding?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, padding = spacing.lg, onClick }) => (
  <div
    onClick={onClick}
    style={{
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding,
      border: `1px solid ${colors.border}`,
      boxShadow: shadows.sm,
      cursor: onClick ? 'pointer' : 'default',
      transition: onClick ? 'box-shadow 150ms ease-in-out' : 'none',
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.md;
      }
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.sm;
    }}
  >
    {children}
  </div>
);

// SectionHeader - Section heading
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, action }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <h2
        style={{
          fontSize: typography.fontSize['3xl'],
          fontWeight: typography.fontWeight.bold,
          color: colors.textPrimary,
          margin: 0,
          marginBottom: subtitle ? spacing.xs : 0,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: typography.fontSize.base,
            color: colors.textSecondary,
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
    {action}
  </div>
);

// MetricBox - Metric display card
interface MetricBoxProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
}

export const MetricBox: React.FC<MetricBoxProps> = ({
  label,
  value,
  unit,
  change,
  changeLabel,
  icon,
}) => (
  <Card padding={spacing.lg}>
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
      }}
    >
      <p
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.textSecondary,
          margin: 0,
          fontWeight: typography.fontWeight.medium,
        }}
      >
        {label}
      </p>
      {icon && <div style={{ fontSize: '20px' }}>{icon}</div>}
    </div>
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: spacing.xs,
        marginBottom: change !== undefined ? spacing.sm : 0,
      }}
    >
      <p
        style={{
          fontSize: typography.fontSize['3xl'],
          fontWeight: typography.fontWeight.bold,
          color: colors.textPrimary,
          margin: 0,
        }}
      >
        {value}
      </p>
      {unit && (
        <p
          style={{
            fontSize: typography.fontSize.base,
            color: colors.textSecondary,
            margin: 0,
          }}
        >
          {unit}
        </p>
      )}
    </div>
    {change !== undefined && changeLabel && (
      <p
        style={{
          fontSize: typography.fontSize.sm,
          color: change >= 0 ? colors.green : colors.red,
          margin: 0,
        }}
      >
        {change >= 0 ? '+' : ''}{change}% {changeLabel}
      </p>
    )}
  </Card>
);

// AIRing - Circular score indicator
interface AIRingProps {
  score: number;
  label?: string;
  size?: number;
}

export const AIRing: React.FC<AIRingProps> = ({ score, label, size = 80 }) => {
  const circumference = 2 * Math.PI * 35;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? colors.green : score >= 60 ? colors.amber : colors.red;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r="35"
            fill="none"
            stroke={colors.border}
            strokeWidth="4"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r="35"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 300ms ease-in-out' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <p
            style={{
              fontSize: typography.fontSize['2xl'],
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              margin: 0,
            }}
          >
            {score}
          </p>
        </div>
      </div>
      {label && (
        <p
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textSecondary,
            margin: 0,
            textAlign: 'center',
          }}
        >
          {label}
        </p>
      )}
    </div>
  );
};

// TableHeader - Table header row
interface TableHeaderProps {
  columns: Array<{ label: string; width?: string }>;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ columns }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' '),
      gap: spacing.md,
      padding: `${spacing.md} ${spacing.lg}`,
      backgroundColor: colors.lightBackground,
      borderBottom: `1px solid ${colors.border}`,
      borderTopLeftRadius: borderRadius.lg,
      borderTopRightRadius: borderRadius.lg,
    }}
  >
    {columns.map((col, i) => (
      <p
        key={i}
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textSecondary,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {col.label}
      </p>
    ))}
  </div>
);

// TableRow - Table data row
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
      gap: spacing.md,
      padding: `${spacing.md} ${spacing.lg}`,
      borderBottom: divider ? `1px solid ${colors.border}` : 'none',
      backgroundColor: colors.cardBackground,
      cursor: onClick ? 'pointer' : 'default',
      transition: onClick ? 'background-color 150ms ease-in-out' : 'none',
      alignItems: 'center',
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.lightBackground;
      }
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.cardBackground;
    }}
  >
    {columns.map((col, i) => (
      <div key={i}>{col.content}</div>
    ))}
  </div>
);
