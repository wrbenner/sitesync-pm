import React from 'react'
import { AlertCircle, RefreshCw, FileQuestion } from 'lucide-react'
import { Btn, Card } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

// ── PageState ──────────────────────────────────────────────
//
// One component that handles the three async-data states every list
// page needs: loading (skeleton), empty (with CTA), error (with retry).
//
// Why this exists: each daily-driver page (RFIs, Submittals, Daily Log,
// Punch List, Dashboard) was rolling its own loading/empty/error UI,
// resulting in three different skeleton animations and four different
// empty-state layouts. A demo that hops between them feels uneven.
// This is the single canonical pattern.
//
// Usage:
//
//   <PageState
//     status={isLoading ? 'loading' : isError ? 'error' : items.length === 0 ? 'empty' : 'ready'}
//     loading={{ rows: 8 }}
//     error={{ message: errorMessage, onRetry: refetch }}
//     empty={{
//       title: 'No RFIs yet',
//       description: 'Create your first RFI to get a documented question to the design team.',
//       icon: <FileQuestion size={32} />,
//       cta: { label: 'New RFI', onClick: handleCreate },
//     }}
//   >
//     {children}
//   </PageState>
//
// All three branches return the same outer shell (Card, padding) so the
// page layout doesn't shift between states.

export type PageStateStatus = 'loading' | 'ready' | 'empty' | 'error'

interface LoadingProps {
  /** Number of skeleton rows to render. Default 6. */
  rows?: number
  /** Skeleton row height (px). Default 56 — matches industrial touch-target. */
  rowHeight?: number
  /** Custom aria label. Defaults to "Loading content". */
  ariaLabel?: string
}

interface EmptyProps {
  title: string
  description?: React.ReactNode
  icon?: React.ReactNode
  cta?: { label: string; onClick: () => void; icon?: React.ReactNode }
  /** Optional secondary action (e.g. "Import from Procore"). */
  secondaryCta?: { label: string; onClick: () => void; icon?: React.ReactNode }
}

interface ErrorProps {
  /** Headline shown above the error detail. */
  title?: string
  /** The actual error string (or a friendly message). */
  message?: string
  /** Optional retry handler. If provided, a Retry button appears. */
  onRetry?: () => void
  /** Set true while a retry is in-flight; disables the button + shows spinning icon. */
  retrying?: boolean
}

interface Props {
  status: PageStateStatus
  loading?: LoadingProps
  empty?: EmptyProps
  error?: ErrorProps
  /** Rendered when status === 'ready'. */
  children?: React.ReactNode
}

// ── Skeleton ──────────────────────────────────────────────

const SkeletonRow: React.FC<{ height: number; widthPct: number }> = ({ height, widthPct }) => (
  <div
    aria-hidden="true"
    style={{
      height,
      width: `${widthPct}%`,
      borderRadius: borderRadius.md,
      background: `linear-gradient(90deg, ${colors.surfaceInset} 0%, ${colors.surfaceRaised} 50%, ${colors.surfaceInset} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'sitesync-page-state-shimmer 1.4s ease-in-out infinite',
    }}
  />
)

const LoadingState: React.FC<LoadingProps> = ({ rows = 6, rowHeight = 56, ariaLabel = 'Loading content' }) => (
  <div role="status" aria-live="polite" aria-busy="true" aria-label={ariaLabel}>
    <style>{`
      @keyframes sitesync-page-state-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], padding: spacing['4'] }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow
          key={i}
          height={rowHeight}
          widthPct={i === 0 ? 100 : 80 + ((i * 7) % 20)} // little organic variation
        />
      ))}
    </div>
  </div>
)

// ── Empty ──────────────────────────────────────────────────

const EmptyStateInner: React.FC<EmptyProps> = ({ title, description, icon, cta, secondaryCta }) => (
  <Card padding={spacing['6']}>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing['3'],
        textAlign: 'center',
        padding: `${spacing['10']} ${spacing['6']}`,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 72,
          height: 72,
          borderRadius: borderRadius.xl,
          background: colors.surfaceInset,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textTertiary,
          marginBottom: spacing['1'],
        }}
      >
        {icon ?? <FileQuestion size={32} />}
      </div>
      <h3
        style={{
          margin: 0,
          fontSize: typography.fontSize.title,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: 0,
            maxWidth: 460,
            fontSize: typography.fontSize.sm,
            color: colors.textSecondary,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      )}
      {(cta || secondaryCta) && (
        <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['2'], flexWrap: 'wrap', justifyContent: 'center' }}>
          {cta && (
            <Btn variant="primary" onClick={cta.onClick} icon={cta.icon} style={{ minHeight: 56 }}>
              {cta.label}
            </Btn>
          )}
          {secondaryCta && (
            <Btn variant="ghost" onClick={secondaryCta.onClick} icon={secondaryCta.icon} style={{ minHeight: 56 }}>
              {secondaryCta.label}
            </Btn>
          )}
        </div>
      )}
    </div>
  </Card>
)

// ── Error ──────────────────────────────────────────────────

const ErrorStateInner: React.FC<ErrorProps> = ({
  title = 'Unable to load',
  message = 'Check your connection and try again.',
  onRetry,
  retrying = false,
}) => (
  <Card padding={spacing['6']}>
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing['3'],
        textAlign: 'center',
        padding: `${spacing['10']} ${spacing['6']}`,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 56,
          height: 56,
          borderRadius: borderRadius.xl,
          background: `${colors.statusCritical}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.statusCritical,
        }}
      >
        <AlertCircle size={24} />
      </div>
      <h3
        style={{
          margin: 0,
          fontSize: typography.fontSize.title,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          maxWidth: 460,
          fontSize: typography.fontSize.sm,
          color: colors.textSecondary,
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>
      {onRetry && (
        <Btn
          variant="secondary"
          onClick={onRetry}
          disabled={retrying}
          icon={<RefreshCw size={14} style={retrying ? { animation: 'sitesync-spin 1s linear infinite' } : undefined} />}
          style={{ minHeight: 56, marginTop: spacing['2'] }}
        >
          <style>{`
            @keyframes sitesync-spin { to { transform: rotate(360deg); } }
          `}</style>
          {retrying ? 'Retrying…' : 'Retry'}
        </Btn>
      )}
    </div>
  </Card>
)

// ── Public component ──────────────────────────────────────

export const PageState: React.FC<Props> = ({ status, loading, empty, error, children }) => {
  if (status === 'loading') return <LoadingState {...(loading ?? {})} />
  if (status === 'error') return <ErrorStateInner {...(error ?? {})} />
  if (status === 'empty' && empty) return <EmptyStateInner {...empty} />
  return <>{children}</>
}
