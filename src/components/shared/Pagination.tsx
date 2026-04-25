import React, { useMemo, type CSSProperties } from 'react';
import { colors, typography, spacing, shadows } from '../../styles/theme';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing['4'],
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize.sm,
};

const buttonGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing['1'],
};

const baseButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 32,
  height: 32,
  padding: `0 ${spacing['2']}`,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: '6px',
  background: colors.surfacePage,
  color: colors.textSecondary,
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize.sm,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 150ms ease',
  lineHeight: '1',
  userSelect: 'none',
};

const activeButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: colors.primaryOrange,
  color: colors.white,
  borderColor: colors.primaryOrange,
  fontWeight: 600,
  cursor: 'default',
};

const disabledButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  color: colors.textDisabled,
  cursor: 'not-allowed',
  opacity: 0.5,
};

const ellipsisStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 32,
  height: 32,
  color: colors.textTertiary,
  fontSize: typography.fontSize.sm,
  userSelect: 'none',
};

const infoStyle: CSSProperties = {
  color: colors.textSecondary,
  fontSize: typography.fontSize.sm,
  whiteSpace: 'nowrap',
};

const selectStyle: CSSProperties = {
  height: 32,
  padding: `0 ${spacing['2']}`,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: '6px',
  background: colors.surfacePage,
  color: colors.textPrimary,
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize.sm,
  cursor: 'pointer',
  outline: 'none',
};

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  const rangeStart = Math.max(2, current - 1);
  const rangeEnd = Math.min(total - 1, current + 1);

  if (rangeStart > 2) pages.push('ellipsis');

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  if (rangeEnd < total - 1) pages.push('ellipsis');

  pages.push(total);
  return pages;
}

function NavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={disabled ? disabledButtonStyle : baseButtonStyle}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = colors.borderHover;
          e.currentTarget.style.boxShadow = shadows.sm;
          e.currentTarget.style.color = colors.textPrimary;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = colors.borderSubtle;
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.color = colors.textSecondary;
        }
      }}
    >
      {children}
    </button>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
  onPageSizeChange,
}: PaginationProps) {
  const pages = useMemo(() => getPageNumbers(currentPage, totalPages), [currentPage, totalPages]);

  const showInfo = totalItems != null && pageSize != null;
  const rangeStart = showInfo ? (currentPage - 1) * pageSize! + 1 : 0;
  const rangeEnd = showInfo ? Math.min(currentPage * pageSize!, totalItems!) : 0;

  return (
    <nav aria-label="Pagination" style={containerStyle}>
      {/* Item info */}
      <div style={infoStyle}>
        {showInfo && (
          <span>
            Showing {rangeStart}-{rangeEnd} of {totalItems} items
          </span>
        )}
      </div>

      {/* Page buttons */}
      <div style={buttonGroupStyle}>
        <NavButton label="First page" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
          &laquo;
        </NavButton>
        <NavButton
          label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          &lsaquo;
        </NavButton>

        {pages.map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`e-${idx}`} style={ellipsisStyle}>
              &hellip;
            </span>
          ) : (
            <button
              key={page}
              type="button"
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
              onClick={() => page !== currentPage && onPageChange(page)}
              style={page === currentPage ? activeButtonStyle : baseButtonStyle}
              onMouseEnter={(e) => {
                if (page !== currentPage) {
                  e.currentTarget.style.borderColor = colors.borderHover;
                  e.currentTarget.style.boxShadow = shadows.sm;
                  e.currentTarget.style.color = colors.textPrimary;
                }
              }}
              onMouseLeave={(e) => {
                if (page !== currentPage) {
                  e.currentTarget.style.borderColor = colors.borderSubtle;
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.color = colors.textSecondary;
                }
              }}
            >
              {page}
            </button>
          )
        )}

        <NavButton
          label="Next page"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          &rsaquo;
        </NavButton>
        <NavButton
          label="Last page"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          &raquo;
        </NavButton>
      </div>

      {/* Page size selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        {onPageSizeChange && pageSize != null && (
          <>
            <label
              htmlFor="page-size-select"
              style={{ ...infoStyle, cursor: 'pointer' }}
            >
              Rows:
            </label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={selectStyle}
              aria-label="Items per page"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </nav>
  );
}
