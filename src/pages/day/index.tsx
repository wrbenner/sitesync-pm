/**
 * The Day — Command Cockpit homepage.
 *
 * Replaces the 720px-wide editorial stream with a full-viewport cockpit:
 * Iris lane on top → Needs You (dense aggregate inbox) on the left →
 * Project Now (pulse + lookahead + commitments + photos) on the right.
 *
 * Glanceable, dense, role-dynamic. Same skeleton for every role; the
 * underlying useActionStream(role) produces a role-filtered set, and the
 * Project Now panel emphasises whatever the role cares about.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { ProjectGate } from '../../components/ProjectGate'
import { useCopilotStore } from '../../stores/copilotStore'
import { useProjectId } from '../../hooks/useProjectId'
import { useProject } from '../../hooks/queries'
import { useActionStream } from '../../hooks/useActionStream'
import { usePermissions } from '../../hooks/usePermissions'
import { useIsOnline } from '../../hooks/useOfflineStatus'
import { useIsMobile } from '../../hooks/useWindowSize'
import { colors, typography, spacing } from '../../styles/theme'
import { Cockpit } from '../../components/cockpit/Cockpit'
import { CockpitMetrics } from '../../components/cockpit/CockpitMetrics'
import { IrisLane } from '../../components/cockpit/IrisLane'
import { NeedsYouTable } from '../../components/cockpit/NeedsYouTable'
import { NeedsYouMobileList } from '../../components/cockpit/NeedsYouMobileList'
import { ProjectNow } from '../../components/cockpit/ProjectNow'
import { ZonePanel } from '../../components/cockpit/ZonePanel'
import { TableSkeleton } from '../../components/cockpit/TableSkeleton'
import { TypeFilterChips } from '../../components/cockpit/TypeFilterChips'
import { InboxClearState } from '../../components/cockpit/InboxClearState'
import { toStreamRole } from '../../types/stream'
import type { StreamItem, StreamItemType } from '../../types/stream'
import { WifiOff } from 'lucide-react'

// ── Keyboard hint chip — surfaces j/k/Enter shortcuts ────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        fontFamily: typography.fontFamily,
        fontSize: '10px',
        fontWeight: 600,
        color: colors.ink2,
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: 4,
        padding: '1px 4px',
        lineHeight: 1.2,
      }}
    >
      {children}
    </kbd>
  )
}

function KeyboardHint() {
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: typography.fontFamily,
        fontSize: '11px',
        color: colors.ink3,
      }}
    >
      <Kbd>j</Kbd>
      <Kbd>k</Kbd>
      <span>move</span>
      <Kbd>↵</Kbd>
      <span>open</span>
      <Kbd>e</Kbd>
      <span>act</span>
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────

function CockpitHeader({ projectName }: { projectName: string }) {
  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: spacing[3],
        padding: `${spacing[3]} ${spacing[5]}`,
        background: colors.surfaceFlat,
        borderBottom: `1px solid ${colors.borderDefault}`,
        minHeight: 56,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: typography.fontFamily,
          fontSize: '15px',
          fontWeight: 700,
          color: colors.ink,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          lineHeight: 1.2,
          maxWidth: '60ch',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {projectName}
      </h1>
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '13px',
          fontWeight: 400,
          color: colors.ink3,
          lineHeight: 1.2,
        }}
      >
        {dateLabel}
      </span>
    </header>
  )
}

// ── Offline banner ────────────────────────────────────────────────────────

function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[2],
        padding: `${spacing[2]} ${spacing[5]}`,
        fontFamily: typography.fontFamily,
        fontSize: '12px',
        fontWeight: 500,
        color: colors.statusPending,
        background: 'var(--color-warningBannerBg)',
      }}
    >
      <WifiOff size={12} aria-hidden />
      <span>Showing cached items — offline</span>
    </div>
  )
}

// ── Routing helper ────────────────────────────────────────────────────────

const TYPE_ROUTE: Record<StreamItem['type'], string> = {
  rfi: '/rfis',
  submittal: '/submittals',
  punch: '/punch-list',
  change_order: '/change-orders',
  task: '/tasks',
  daily_log: '/daily-log',
  incident: '/safety',
  schedule: '/schedule',
  commitment: '/commitments',
}

function destinationFor(item: StreamItem): string {
  // Find the sourceTrail entry that points back to the ITEM ITSELF (e.g. for
  // an RFI item, the entry with type='rfi' — its own /rfis/:id deep link).
  // Other entries (drawing/spec references) are supplementary; using
  // sourceTrail[0] would send a clicked RFI to the Drawings page.
  const own = item.sourceTrail.find((s) => s.type === item.type)
  if (own?.url) return own.url
  return TYPE_ROUTE[item.type] ?? '/day'
}

// ── Page ──────────────────────────────────────────────────────────────────

const DayPage: React.FC = () => {
  const projectId = useProjectId()
  const { data: project } = useProject(projectId)
  const { setPageContext } = useCopilotStore()
  const isMobile = useIsMobile()
  const isOnline = useIsOnline()
  const navigate = useNavigate()
  const { role: projectRole } = usePermissions()
  const streamRole = toStreamRole(projectRole)

  const stream = useActionStream(streamRole)

  // Type filter — local UI state, not persisted. Resets when items change
  // shape dramatically (e.g., logout/login).
  const [typeFilter, setTypeFilter] = useState<StreamItemType | 'all'>('all')

  const filteredItems = useMemo(
    () =>
      typeFilter === 'all'
        ? stream.items
        : stream.items.filter((i) => i.type === typeFilter),
    [stream.items, typeFilter],
  )

  const showSkeleton = stream.isLoading && stream.items.length === 0

  useEffect(() => {
    setPageContext('day')
  }, [setPageContext])

  const handleRowClick = useCallback(
    (item: StreamItem) => navigate(destinationFor(item)),
    [navigate],
  )

  const handleIrisClick = useCallback(
    (item: StreamItem) => {
      // For Wave 1, Iris click navigates to the source page where the draft
      // is presented inline. The full inline-draft preview ships with Tab D
      // of Wave 2.
      navigate(destinationFor(item))
    },
    [navigate],
  )

  if (!projectId) return <ProjectGate />

  const projectName = project?.name?.toUpperCase() ?? 'PROJECT'

  return (
    <ErrorBoundary>
      <Cockpit
        header={
          <>
            {!isOnline && <OfflineBanner />}
            <CockpitHeader projectName={projectName} />
          </>
        }
        metrics={<CockpitMetrics items={stream.items} />}
        irisLane={
          <IrisLane items={stream.items} onChip={handleIrisClick} />
        }
        needsYou={
          <ZonePanel
            title="Needs You"
            count={
              typeFilter === 'all' ? stream.items.length : filteredItems.length
            }
            subtitle={
              showSkeleton
                ? 'Loading…'
                : stream.items.length === 0
                  ? 'Inbox clear'
                  : typeFilter !== 'all'
                    ? `Filtered to ${typeFilter}`
                    : undefined
            }
            action={
              !isMobile && stream.items.length > 0 ? (
                <KeyboardHint />
              ) : undefined
            }
            contentStyle={{ padding: 0 }}
          >
            {showSkeleton ? (
              <TableSkeleton rows={6} />
            ) : stream.items.length === 0 ? (
              <InboxClearState />
            ) : (
              <>
                <TypeFilterChips
                  items={stream.items}
                  selected={typeFilter}
                  onSelect={setTypeFilter}
                />
                {isMobile ? (
                  <NeedsYouMobileList
                    items={filteredItems}
                    onRowClick={handleRowClick}
                    onIrisClick={handleIrisClick}
                  />
                ) : (
                  <NeedsYouTable
                    items={filteredItems}
                    onRowClick={handleRowClick}
                    onIrisClick={handleIrisClick}
                  />
                )}
              </>
            )}
          </ZonePanel>
        }
        projectNow={<ProjectNow items={stream.items} role={streamRole} />}
        isMobile={isMobile}
      />
    </ErrorBoundary>
  )
}

export default DayPage
