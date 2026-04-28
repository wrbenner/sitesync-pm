/**
 * /iris/inbox — the home of "Iris that ACTS, not chats."
 *
 * Lists pending drafted actions across the active project and lets the
 * user approve or reject each one. After approval the executor runs;
 * after rejection the draft is archived (kept for the audit trail).
 *
 * IA: this page is the "what does my AI super want me to look at?"
 * landing — replaces the inbox-zero pattern of email triage with a
 * visual queue of well-cited proposals.
 */

import React, { useCallback, useState } from 'react'
import { Sparkles, Inbox, RefreshCw } from 'lucide-react'
import { PageContainer, EmptyState } from '../../components/Primitives'
import { IrisApprovalGate } from '../../components/iris/IrisApprovalGate'
import { useIrisDrafts } from '../../hooks/useIrisDrafts'
import { useProjectId } from '../../hooks/useProjectId'
import { useAuth } from '../../hooks/useAuth'
import { approveAndExecute, rejectDraft } from '../../services/iris/executeAction'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { DraftedAction } from '../../types/draftedActions'

const IrisInboxPage: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: drafts, isLoading, refetch } = useIrisDrafts(projectId)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  const visible = (drafts ?? []).filter((d) => filter === 'all' ? true : d.status === 'pending')

  const handleApprove = useCallback(async (draft: DraftedAction) => {
    if (!user?.id) { toast.error('Sign in required'); return }
    setBusyId(draft.id)
    const result = await approveAndExecute({
      draftId: draft.id,
      decided_by: user.id,
    })
    setBusyId(null)
    if (result.ok) {
      toast.success(`${labelForType(draft.action_type)} sent`)
      qc.invalidateQueries({ queryKey: ['drafted_actions'] })
    } else {
      toast.error(result.error ?? 'Failed to execute')
    }
  }, [user?.id, qc])

  const handleReject = useCallback(async (draft: DraftedAction) => {
    if (!user?.id) { toast.error('Sign in required'); return }
    setBusyId(draft.id)
    const result = await rejectDraft({ draftId: draft.id, decided_by: user.id })
    setBusyId(null)
    if (result.ok) {
      toast.success('Draft rejected')
      qc.invalidateQueries({ queryKey: ['drafted_actions'] })
    } else {
      toast.error(result.error ?? 'Failed to reject')
    }
  }, [user?.id, qc])

  return (
    <PageContainer
      title="Iris Inbox"
      subtitle="Drafted actions waiting for your approval"
      actions={
        <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
          <button
            onClick={() => setFilter((f) => (f === 'pending' ? 'all' : 'pending'))}
            style={filterBtn(filter === 'all')}
          >
            {filter === 'pending' ? 'Show all' : 'Pending only'}
          </button>
          <button
            onClick={() => refetch()}
            aria-label="Refresh inbox"
            style={iconBtn}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {[1, 2, 3].map((i) => (
            <div key={i} data-skeleton="true" style={{
              height: 140,
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.xl,
              animation: 'skeletonPulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={28} />}
          title={filter === 'pending' ? 'Inbox zero — Iris has nothing for you' : 'No drafts yet'}
          description={
            filter === 'pending'
              ? "When Iris spots something on the project that needs an action — a missing RFI, a pay app due, a clash on the drawings — it'll draft it and queue it here for one-click approval."
              : 'Drafts are surfaced as Iris analyzes the project. Run an analysis from the AI panel to seed the inbox.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {visible.map((draft) => (
            <IrisApprovalGate
              key={draft.id}
              draft={draft}
              busy={busyId === draft.id}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </PageContainer>
  )
}

function labelForType(t: DraftedAction['action_type']): string {
  switch (t) {
    case 'rfi.draft': return 'RFI'
    case 'daily_log.draft': return 'Daily log'
    case 'pay_app.draft': return 'Pay application'
    case 'punch_item.draft': return 'Punch item'
    case 'schedule.resequence': return 'Schedule resequence'
    case 'submittal.transmittal_draft': return 'Submittal transmittal'
  }
}

const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.md,
  cursor: 'pointer',
  color: colors.textSecondary,
}

function filterBtn(active: boolean): React.CSSProperties {
  return {
    padding: `${spacing['1.5']} ${spacing['3']}`,
    background: active ? colors.surfaceInset : 'transparent',
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily,
  }
}

export default IrisInboxPage
export { IrisInboxPage }

// Tiny re-import to keep the icon import used — the empty-state Inbox
// glyph is intentionally unused right now (Sparkles reads better as the
// AI brand mark) but kept for a future "Inbox zero" variant.
const _Inbox = Inbox
void _Inbox
