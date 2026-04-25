import React, { type CSSProperties } from 'react';
import { colors, typography, spacing } from '../../styles/theme';

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

const navStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize.sm,
  lineHeight: '1',
};

const listStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  listStyle: 'none',
  margin: 0,
  padding: 0,
  gap: spacing['1.5'],
};

const chevronStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  color: colors.textTertiary,
  fontSize: typography.fontSize.caption,
  userSelect: 'none',
};

const linkStyle: CSSProperties = {
  color: colors.textSecondary,
  textDecoration: 'none',
  cursor: 'pointer',
  padding: `${spacing['0.5']} ${spacing['1']}`,
  borderRadius: '4px',
  transition: 'color 150ms ease, background 150ms ease',
};

const linkHoverProps = {
  color: colors.primaryOrange,
  background: colors.orangeSubtle,
};

const currentStyle: CSSProperties = {
  color: colors.textPrimary,
  fontWeight: 600,
  padding: `${spacing['0.5']} ${spacing['1']}`,
};

function ChevronSvg() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path
        d="M4.5 2.5L7.5 6L4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" style={navStyle}>
      <ol style={listStyle}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} style={{ display: 'flex', alignItems: 'center', gap: spacing['1.5'] }}>
              {index > 0 && (
                <span style={chevronStyle}>
                  <ChevronSvg />
                </span>
              )}
              {isLast ? (
                <span style={currentStyle} aria-current="page">
                  {item.label}
                </span>
              ) : item.href ? (
                <a
                  href={item.href}
                  style={linkStyle}
                  onClick={
                    item.onClick
                      ? (e) => {
                          e.preventDefault();
                          item.onClick!();
                        }
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, linkHoverProps);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.textSecondary;
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {item.label}
                </a>
              ) : (
                <button
                  type="button"
                  style={{
                    ...linkStyle,
                    background: 'none',
                    border: 'none',
                    font: 'inherit',
                    fontSize: 'inherit',
                  }}
                  onClick={item.onClick}
                  onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, linkHoverProps);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.textSecondary;
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
