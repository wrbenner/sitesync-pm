import React from 'react';
import { colors, spacing, borderRadius, shadows } from '../../styles/theme';

interface PageThumbnailSidebarProps {
  numPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  thumbnailUrls?: string[];
  annotationCounts?: Record<number, number>;
  loading?: boolean;
}

const MIN_TOUCH = 56;

export const PageThumbnailSidebar: React.FC<PageThumbnailSidebarProps> = ({
  numPages,
  currentPage,
  onPageChange,
  thumbnailUrls,
  annotationCounts = {},
  loading = false,
}) => {
  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading page thumbnails"
        style={{
          width: 120,
          padding: spacing.sm,
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.md,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.sm,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 96,
              height: 128,
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.md,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  if (!numPages) {
    return (
      <div
        style={{
          width: 120,
          padding: spacing.md,
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.md,
          color: colors.textTertiary,
          fontSize: 12,
          textAlign: 'center',
        }}
      >
        No pages available
      </div>
    );
  }

  return (
    <nav
      aria-label="Page thumbnails"
      style={{
        width: 120,
        padding: spacing.sm,
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.md,
        boxShadow: shadows.card,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.sm,
        maxHeight: 'calc(100vh - 160px)',
        overflowY: 'auto',
      }}
    >
      {Array.from({ length: numPages }).map((_, idx) => {
        const page = idx + 1;
        const isCurrent = page === currentPage;
        const count = annotationCounts[page] ?? 0;
        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            aria-label={`Go to page ${page}`}
            aria-current={isCurrent ? 'page' : undefined}
            style={{
              position: 'relative',
              minWidth: MIN_TOUCH,
              minHeight: MIN_TOUCH,
              width: 96,
              height: 128,
              padding: 0,
              border: isCurrent ? `3px solid ${colors.primaryOrange}` : `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.md,
              backgroundColor: colors.surfacePage,
              cursor: 'pointer',
              overflow: 'hidden',
              transform: isCurrent ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 150ms ease',
            }}
          >
            {thumbnailUrls?.[idx] ? (
              <img
                src={thumbnailUrls[idx]}
                alt={`Page ${page}`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.textTertiary,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {page}
              </div>
            )}
            {count > 0 && (
              <span
                aria-label={`${count} annotations`}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  backgroundColor: colors.primaryOrange,
                  color: colors.white,
                  borderRadius: borderRadius.full,
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {count}
              </span>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: 11,
                color: isCurrent ? colors.primaryOrange : colors.textTertiary,
                fontWeight: isCurrent ? 600 : 400,
              }}
            >
              {page}
            </div>
          </button>
        );
      })}
    </nav>
  );
};

export default PageThumbnailSidebar;
