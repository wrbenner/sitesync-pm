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
import { useProject, useProjects } from '../../hooks/queries'
import { useActionStream } from '../../hooks/useActionStream'
import { usePermissions } from '../../hooks/usePermissions'
import { useIsOnline } from '../../hooks/useOfflineStatus'
import { useIsMobile } from '../../hooks/useWindowSize'
import { colors, typography, spacing } from '../../styles/theme'
import { Cockpit } from '../../components/cockpit/Cockpit'
import { CockpitMetrics } from '../../components/cockpit/CockpitMetrics'
import { IrisLane } from '../../components/cockpit/IrisLane'
import { IrisInsightsLane } from '../../components/cockpit/IrisInsightsLane'
import { useIrisInsights } from '../../hooks/useIrisInsights'
import type { IrisInsight } from '../../services/iris/insights'
import { NeedsYouTable } from '../../components/cockpit/NeedsYouTable'
import { NeedsYouMobileList } from '../../components/cockpit/NeedsYouMobileList'
import { ProjectNow } from '../../components/cockpit/ProjectNow'
import { ZonePanel } from '../../components/cockpit/ZonePanel'
import { TableSkeleton } from '../../components/cockpit/TableSkeleton'
import { TypeFilterChips } from '../../components/cockpit/TypeFilterChips'
import { InboxClearState } from '../../components/cockpit/InboxClearState'
import { IrisDraftDrawer } from '../../components/cockpit/IrisDraftDrawer'
import { useProfileNames, displayName as profileDisplayName } from '../../hooks/queries/profiles'
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
  // Type-canonical detail route. Each item knows its own detail page; we
  // strip the prefix the transformer added to item.id (e.g. "rfi-uuid" →
  // "uuid") and route to the per-id detail page where one exists. For types
  // without a detail page, fall back to the list page (with a query param
  // to focus the right activity / date when supported).
  const id = item.id.replace(/^[a-z_]+-/, '')
  switch (item.type) {
    case 'rfi':          return `/rfis/${id}`
    case 'submittal':    return `/submittals/${id}`
    case 'punch':        return `/punch-list/${id}`
    case 'change_order': return `/change-orders?focus=${id}`
    case 'task':         return `/tasks?focus=${id}`
    case 'daily_log':    return `/daily-log${item.dueDate ? `?date=${item.dueDate}` : ''}`
    case 'incident':     return `/safety?incident=${id}`
    case 'schedule':     return `/schedule?activity=${encodeURIComponent(id)}`
    case 'commitment':   return '/commitments'
    default:             return TYPE_ROUTE[item.type] ?? '/day'
  }
}

// ── Per-zone error fallback — keeps a single panel failure from killing
// the dashboard. Renders inside a ZonePanel so the layout stays stable.

function ZoneFallback({ label }: { label: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: `${spacing[4]}`,
        fontFamily: typography.fontFamily,
        fontSize: '12px',
        color: colors.ink3,
        background: colors.surfaceInset,
        borderRadius: 6,
        margin: spacing[3],
      }}
    >
      {label} unavailable. Reload to retry.
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

const DayPage: React.FC = () => {
  const projectId = useProjectId()
  const { data: project } = useProject(projectId)
  const { isLoading: projectsLoading } = useProjects()
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
  const [draftItem, setDraftItem] = useState<StreamItem | null>(null)

  const filteredItems = useMemo(
    () =>
      typeFilter === 'all'
        ? stream.items
        : stream.items.filter((i) => i.type === typeFilter),
    [stream.items, typeFilter],
  )

  const showSkeleton = stream.isLoading && stream.items.length === 0

  // Resolve user IDs in `assignedTo` / `party` to display names. Items can
  // carry either a UUID (assigned_to user id) or a free-text label (e.g.
  // "Smith Architects" as ball_in_court). UUID-shaped values get looked up;
  // anything else is passed through.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const userIds = useMemo(() => {
    const set = new Set<string>()
    for (const it of stream.items) {
      if (it.assignedTo && UUID_RE.test(it.assignedTo)) set.add(it.assignedTo)
      if (it.party && UUID_RE.test(it.party)) set.add(it.party)
    }
    return Array.from(set)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.items])
  const { data: profileMap } = useProfileNames(userIds)
  const resolveName = useCallback(
    (value: string | null | undefined): string | null => {
      if (!value) return null
      if (!UUID_RE.test(value)) return value
      return profileDisplayName(profileMap, value, value.slice(0, 6))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileMap],
  )

  useEffect(() => {
    setPageContext('day')
  }, [setPageContext])

  const handleRowClick = useCallback(
    (item: StreamItem) => navigate(destinationFor(item)),
    [navigate],
  )

  const handleIrisClick = useCallback(
    (item: StreamItem) => {
      // Open the inline Iris draft drawer. The drawer auto-generates the draft
      // (or reuses an in-memory cached one) and offers Send / Edit / Dismiss.
      // No navigation — the AI loop happens on the dashboard.
      if (item.irisEnhancement?.draftAvailable) {
        setDraftItem(item)
      } else {
        navigate(destinationFor(item))
      }
    },
    [navigate],
  )

  const { insights } = useIrisInsights(projectId)
  const handleInsightClick = useCallback(
    (insight: IrisInsight) => {
      const url = insight.sourceTrail[0]?.url
      if (url) navigate(url)
    },
    [navigate],
  )

  // While projects load, render the cockpit chrome with skeleton rows
  // instead of ProjectGate's tiny pulsing dot — the user should see the
  // dashboard SHAPE on first paint, not what looks like a blank page.
  // ProjectGate is reserved for the genuine "no projects yet" state.
  if (!projectId) {
    if (projectsLoading) {
      return (
        <Cockpit
          header={<CockpitHeader projectName="LOADING…" />}
          metrics={null}
          irisLane={null}
          needsYou={
            <ZonePanel title="Needs You" subtitle="Loading…" contentStyle={{ padding: 0 }}>
              <TableSkeleton rows={6} />
            </ZonePanel>
          }
          projectNow={
            <ZonePanel title="Project Now"><div style={{ padding: spacing[4], color: colors.ink3, fontFamily: typography.fontFamily, fontSize: 13 }}>Loading project context…</div></ZonePanel>
          }
          isMobile={isMobile}
        />
      )
    }
    return <ProjectGate />
  }

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
        metrics={
          <ErrorBoundary fallback={null}>
            <CockpitMetrics items={stream.items} />
          </ErrorBoundary>
        }
        irisLane={
          <ErrorBoundary fallback={null}>
            <IrisLane items={stream.items} onChip={handleIrisClick} resolveName={resolveName} />
            <IrisInsightsLane insights={insights} onSelect={handleInsightClick} />
          </ErrorBoundary>
        }
        needsYou={
          <ErrorBoundary fallback={<ZonePanel title="Needs You"><ZoneFallback label="Inbox" /></ZonePanel>}>
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
                    resolveName={resolveName}
                  />
                ) : (
                  <NeedsYouTable
                    items={filteredItems}
                    onRowClick={handleRowClick}
                    onIrisClick={handleIrisClick}
                    resolveName={resolveName}
                  />
                )}
              </>
            )}
          </ZonePanel>
          </ErrorBoundary>
        }
        projectNow={
          <ErrorBoundary fallback={<ZonePanel title="Project Now"><ZoneFallback label="Project status" /></ZonePanel>}>
            <ProjectNow items={stream.items} role={streamRole} resolveName={resolveName} />
          </ErrorBoundary>
        }
        isMobile={isMobile}
      />
      <IrisDraftDrawer
        item={draftItem}
        onClose={() => setDraftItem(null)}
        onSend={(item) => {
          // Iris approve flow: mark dismissed in the stream so the row vanishes
          // after a successful send. The actual side-effect (email send, RFI
          // response post, etc.) is owned by the destination feature page;
          // we just navigate the user there with the draft pre-applied.
          stream.dismiss(item.id)
          navigate(destinationFor(item))
        }}
      />
    </ErrorBoundary>
  )
}

export default DayPage
