/**
 * /iris/inbox — the home of "Iris that ACTS, not chats."
 *
 * Three tabs:
 *   • Drafts       — pending approvals, grouped by entity_type
 *   • Suggestions  — non-blocking suggestions from IrisSuggests
 *   • History      — recent approved + rejected decisions (read-only)
 *
 * IA: this page is the "what does my AI super want me to look at?"
 * landing — replaces the inbox-zero pattern of email triage with a
 * visual queue of well-cited proposals.
 */

import React, { useMemo, useState } from 'react'
import { Sparkles, Inbox } from 'lucide-react'
import { PageContainer, EmptyState } from '../../components/Primitives'
import { Eyebrow } from '../../components/atoms'
import { IrisApprovalGate, ACTION_LABELS } from '../../components/iris/IrisApprovalGate'
import {
  useDraftedActionsForProject,
  useApproveDraftedAction,
  useRejectDraftedAction,
} from '../../hooks/queries/draftedActions'
import { useIrisInsights } from '../../hooks/useIrisInsights'
import { useProjectId } from '../../hooks/useProjectId'
import { IrisInsightsCard } from '../../components/cockpit/IrisInsightsCard'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { toast } from 'sonner'
import type { DraftedAction, DraftedActionType } from '../../types/draftedActions'
import type { IrisInsight, IrisInsightKind } from '../../services/iris/insights'

type TabKey = 'drafts' | 'suggestions' | 'history'

// ── Group label per action_type for the Drafts tab ────────────────────
const GROUP_LABELS: Record<DraftedActionType, string> = {
  'rfi.draft': 'RFI drafts',
  'daily_log.draft': 'Daily log drafts',
  'submittal.transmittal_draft': 'Submittal drafts',
  'pay_app.draft': 'Pay app drafts',
  'punch_item.draft': 'Punch item drafts',
  'schedule.resequence': 'Schedule resequence drafts',
}

// Stable order so the Drafts tab is predictable.
const GROUP_ORDER: DraftedActionType[] = [
  'rfi.draft',
  'daily_log.draft',
  'submittal.transmittal_draft',
  'pay_app.draft',
  'punch_item.draft',
  'schedule.resequence',
]

// ── Suggestions tab — kind filter chips ───────────────────────────────

const KIND_LABELS: Record<IrisInsightKind, string> = {
  cascade: 'Cascade',
  aging: 'Aging',
  variance: 'Variance',
  staffing: 'Staffing',
  weather: 'Weather',
}

const KIND_ORDER: IrisInsightKind[] = [
  'cascade',
  'aging',
  'variance',
  'staffing',
  'weather',
]

type KindFilter = 'all' | IrisInsightKind

// ── Page ──────────────────────────────────────────────────────────────

const IrisInboxPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('drafts')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const projectId = useProjectId()
  const {
    insights,
    isLoading: insightsLoading,
  } = useIrisInsights(projectId)

  // Drafts tab feeds — pending only
  const { data: pendingDrafts = [], isLoading: pendingLoading } = useDraftedActionsForProject({
    status: 'pending',
  })
  // History tab feeds — approved + rejected (and their downstream executed/failed)
  const { data: historyDrafts = [], isLoading: historyLoading } = useDraftedActionsForProject({
    status: ['approved', 'rejected'],
    limit: 50,
  })

  const approveDraft = useApproveDraftedAction()
  const rejectDraft = useRejectDraftedAction()

  // Group pending drafts by action_type, in a stable order.
  const groupedPending = useMemo(() => {
    const groups: Record<string, DraftedAction[]> = {}
    for (const d of pendingDrafts) {
      ;(groups[d.action_type] ??= []).push(d)
    }
    return GROUP_ORDER
      .filter((t) => (groups[t]?.length ?? 0) > 0)
      .map((t) => ({ type: t, label: GROUP_LABELS[t], items: groups[t]! }))
  }, [pendingDrafts])

  // Sort history by most-recent decision time (decided_at, falling back to updated_at).
  const sortedHistory = useMemo(() => {
    return [...historyDrafts].sort((a, b) => {
      const aT = a.decided_at ?? a.updated_at ?? a.created_at
      const bT = b.decided_at ?? b.updated_at ?? b.created_at
      return (bT ?? '').localeCompare(aT ?? '')
    })
  }, [historyDrafts])

  // Filter + group insights for the Suggestions tab.
  // The hook already returns severity-then-impact-sorted output; preserve that
  // order within each group so the most urgent risks surface first.
  const filteredInsights = useMemo<IrisInsight[]>(() => {
    if (kindFilter === 'all') return insights
    return insights.filter((i) => i.kind === kindFilter)
  }, [insights, kindFilter])

  const insightCountsByKind = useMemo(() => {
    const counts: Record<IrisInsightKind, number> = {
      cascade: 0,
      aging: 0,
      variance: 0,
      staffing: 0,
      weather: 0,
    }
    for (const i of insights) counts[i.kind] += 1
    return counts
  }, [insights])

  const draftsCount = pendingDrafts.length

  return (
    <PageContainer
      title="Iris Inbox"
      subtitle="Drafted actions waiting for your approval"
    >
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Iris inbox sections"
        style={{
          display: 'flex',
          gap: spacing['1'],
          borderBottom: `1px solid ${colors.borderSubtle}`,
          marginBottom: spacing['5'],
        }}
      >
        <TabButton
          active={tab === 'drafts'}
          onClick={() => setTab('drafts')}
          label="Drafts"
          count={draftsCount}
          ariaControls="iris-inbox-drafts"
        />
        <TabButton
          active={tab === 'suggestions'}
          onClick={() => setTab('suggestions')}
          label="Suggestions"
          ariaControls="iris-inbox-suggestions"
        />
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
          label="History"
          ariaControls="iris-inbox-history"
        />
      </div>

      {/* Drafts tab */}
      {tab === 'drafts' && (
        <div id="iris-inbox-drafts" role="tabpanel">
          {pendingLoading ? (
            <SkeletonStack />
          ) : groupedPending.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={28} />}
              title="No drafts pending"
              description="Iris will post here when an action needs your sign-off."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
              {groupedPending.map((group) => (
                <section key={group.type}>
                  <div style={{ marginBottom: spacing['3'] }}>
                    <Eyebrow>{group.label}</Eyebrow>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                    {group.items.map((draft) => (
                      <IrisApprovalGate
                        key={draft.id}
                        draft={draft}
                        busy={approveDraft.isPending || rejectDraft.isPending}
                        onApprove={async (d) => {
                          try {
                            await approveDraft.mutateAsync(d)
                            toast.success('Approved')
                          } catch {
                            toast.error('Could not approve — please try again')
                          }
                        }}
                        onReject={async (d) => {
                          await rejectDraft.mutateAsync({ draft: d, reason: undefined })
                          toast('Rejected')
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggestions tab — Iris Phase 4 risk insights. Consumes useIrisInsights
           and renders one card per detected risk, filterable by kind. */}
      {tab === 'suggestions' && (
        <div id="iris-inbox-suggestions" role="tabpanel">
          {insights.length > 0 && (
            <div
              role="toolbar"
              aria-label="Filter risks by category"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: spacing['2'],
                marginBottom: spacing['4'],
              }}
            >
              <FilterChip
                label="All"
                count={insights.length}
                active={kindFilter === 'all'}
                onClick={() => setKindFilter('all')}
              />
              {KIND_ORDER.filter((k) => insightCountsByKind[k] > 0).map((kind) => (
                <FilterChip
                  key={kind}
                  label={KIND_LABELS[kind]}
                  count={insightCountsByKind[kind]}
                  active={kindFilter === kind}
                  onClick={() => setKindFilter(kind)}
                />
              ))}
            </div>
          )}

          {insightsLoading ? (
            <SkeletonStack />
          ) : filteredInsights.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={28} />}
              title="No risks detected — Iris is watching."
              description="Iris monitors RFIs, submittals, schedule, budget, staffing, and weather. Risks appear here as they emerge."
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: spacing['3'],
              }}
            >
              {filteredInsights.map((insight) => (
                <IrisInsightsCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div id="iris-inbox-history" role="tabpanel">
          {historyLoading ? (
            <SkeletonStack />
          ) : sortedHistory.length === 0 ? (
            <EmptyState
              icon={<Inbox size={28} />}
              title="No decisions yet"
              description="Approved and rejected drafts show here once you decide."
            />
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing['2'],
              }}
            >
              {sortedHistory.map((d) => (
                <HistoryRow key={d.id} draft={d} />
              ))}
            </ul>
          )}
        </div>
      )}
    </PageContainer>
  )
}

// ── Tab button atom ───────────────────────────────────────────────────

const TabButton: React.FC<{
  active: boolean
  onClick: () => void
  label: string
  count?: number
  ariaControls: string
}> = ({ active, onClick, label, count, ariaControls }) => (
  <button
    role="tab"
    aria-selected={active}
    aria-controls={ariaControls}
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: spacing['2'],
      padding: `${spacing['2']} ${spacing['3']}`,
      background: 'transparent',
      border: 'none',
      borderBottom: `2px solid ${active ? colors.primaryOrange : 'transparent'}`,
      marginBottom: -1,
      color: active ? colors.textPrimary : colors.textTertiary,
      fontSize: typography.fontSize.sm,
      fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
      fontFamily: typography.fontFamily,
      cursor: 'pointer',
    }}
  >
    {label}
    {typeof count === 'number' && count > 0 && (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 20,
          padding: `0 ${spacing['1.5']}`,
          height: 18,
          borderRadius: borderRadius.full,
          backgroundColor: active ? colors.orangeSubtle : colors.surfaceInset,
          color: active ? colors.primaryOrange : colors.textTertiary,
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
    )}
  </button>
)

// ── Filter chip atom (Suggestions tab) ────────────────────────────────

const FilterChip: React.FC<{
  label: string
  count: number
  active: boolean
  onClick: () => void
}> = ({ label, count, active, onClick }) => {
  const IRIS_INDIGO = '#4F46E5'
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing['2'],
        padding: `${spacing['1']} ${spacing['3']}`,
        backgroundColor: active ? 'rgba(79, 70, 229, 0.10)' : colors.surfaceRaised,
        color: active ? IRIS_INDIGO : colors.textSecondary,
        border: `1px solid ${active ? 'rgba(79, 70, 229, 0.30)' : colors.borderSubtle}`,
        borderRadius: borderRadius.full,
        fontSize: typography.fontSize.sm,
        fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
        fontFamily: typography.fontFamily,
        cursor: 'pointer',
        lineHeight: 1.2,
      }}
    >
      {label}
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: typography.fontSize.caption,
          color: active ? IRIS_INDIGO : colors.textTertiary,
          fontWeight: typography.fontWeight.semibold,
        }}
      >
        {count}
      </span>
    </button>
  )
}

// ── Skeleton stack ────────────────────────────────────────────────────

const SkeletonStack: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        data-skeleton="true"
        style={{
          height: 140,
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.xl,
          animation: 'skeletonPulse 1.5s ease-in-out infinite',
        }}
      />
    ))}
  </div>
)

// ── History row (read-only) ───────────────────────────────────────────

const HistoryRow: React.FC<{ draft: DraftedAction }> = ({ draft }) => {
  const isApproved = draft.status === 'approved' || draft.status === 'executed'
  const pillBg = isApproved ? colors.statusActiveSubtle : colors.statusNeutralSubtle
  const pillFg = isApproved ? colors.statusActive : colors.statusNeutral
  const decidedAt = draft.decided_at ?? draft.updated_at ?? draft.created_at
  const initials = draft.decided_by ? draft.decided_by.slice(0, 2).toUpperCase() : '—'

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        padding: spacing['3'],
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.lg,
      }}
    >
      <span
        style={{
          padding: `2px ${spacing['2']}`,
          borderRadius: borderRadius.full,
          backgroundColor: pillBg,
          color: pillFg,
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}
      >
        {isApproved ? 'Approved' : 'Rejected'}
      </span>
      <span
        style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          fontWeight: typography.fontWeight.semibold,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}
      >
        {ACTION_LABELS[draft.action_type] ?? draft.action_type}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: typography.fontSize.sm,
          color: colors.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={draft.title}
      >
        {draft.title || draft.action_type}
      </span>
      <span
        aria-label="Decided by"
        title={draft.decided_by ?? 'Unknown'}
        style={{
          width: 24,
          height: 24,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surfaceInset,
          color: colors.textTertiary,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          flexShrink: 0,
        }}
      >
        {initials}
      </span>
      <span
        style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
        title={decidedAt ?? ''}
      >
        {relativeTime(decidedAt)}
      </span>
    </li>
  )
}

function relativeTime(d: string | null | undefined): string {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default IrisInboxPage
export { IrisInboxPage }
