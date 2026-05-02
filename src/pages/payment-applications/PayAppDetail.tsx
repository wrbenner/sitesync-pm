import React, { useState, useCallback, memo } from 'react'
import { toast } from 'sonner'
import { FileText, AlertTriangle, Scale } from 'lucide-react'
import { Card, Skeleton, EmptyState } from '../../components/Primitives'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { usePayAppSOV } from '../../hooks/queries'
import type { G702Data, G703LineItem } from '../../machines/paymentMachine'
import type { LienWaiverRow, LienWaiverStatus } from '../../types/api'
import { fmtCurrency, LIEN_WAIVER_STATUS_CONFIG } from './types'
import { G702Preview } from './G702Preview'
import { SOVEditorPanel } from './SOVEditor'
import { WorkflowTimeline } from '../../components/WorkflowTimeline'

const PAY_APP_FLOW = ['draft', 'submitted', 'approved', 'paid'] as const
const PAY_APP_FLOW_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  paid: 'Paid',
}

interface PayAppDetailProps {
  app: Record<string, unknown>
  projectId: string
  waivers: LienWaiverRow[]
  contracts: Array<Record<string, unknown>>
  onApprove: () => void
  onMarkPaid?: () => void
  isApproving: boolean
  isMarkingPaid?: boolean
  onMarkReceived: (id: string) => void
  onMarkExecuted: (id: string) => void
  markingWaiverId: string | null
}

export const PayAppDetail = memo<PayAppDetailProps>(({
  app, projectId, waivers, contracts, onApprove, onMarkPaid, isApproving, isMarkingPaid, onMarkReceived, onMarkExecuted, markingWaiverId,
}) => {
  const appNumber = app.application_number as number
  const { data: sovData, isLoading: sovLoading } = usePayAppSOV(projectId, appNumber)
  const [liveG702, setLiveG702] = useState<G702Data | undefined>()
  const [liveG703, setLiveG703] = useState<G703LineItem[] | undefined>()
  const [detailTab, setDetailTab] = useState<'g702' | 'lien_waivers'>('g702')
  const [nowMs] = useState(() => Date.now())

  const appWaivers = waivers.filter((w) => w.pay_application_id === (app.id as string))
  const pendingWaivers = appWaivers.filter((w) => w.status === 'pending')
  const showMissingWarning = pendingWaivers.length > 0

  const handleLiveData = useCallback((g702: G702Data, g703: G703LineItem[]) => {
    setLiveG702(g702)
    setLiveG703(g703)
  }, [])

  const typeLabel: Record<string, string> = {
    conditional_progress: 'Conditional Progress',
    unconditional_progress: 'Unconditional Progress',
    conditional_final: 'Conditional Final',
    unconditional_final: 'Unconditional Final',
  }

  const appStatus = app.status as string
  const payAppFlowIndex = PAY_APP_FLOW.indexOf(appStatus as typeof PAY_APP_FLOW[number])
  const completedPayAppStates = payAppFlowIndex > 0 ? [...PAY_APP_FLOW.slice(0, payAppFlowIndex)] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          Pay Application #{appNumber}
        </span>
        {(appStatus === 'submitted' || appStatus === 'approved') && (
          <PermissionGate permission="financials.edit">
            <button
              onClick={() => {
                window.print()
                toast.success('G702/G703 print view opened')
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none', borderRadius: borderRadius.md,
                backgroundColor: colors.primaryOrange, color: colors.white,
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                cursor: 'pointer', fontFamily: typography.fontFamily,
              }}
            >
              <FileText size={14} /> Generate AIA G702/G703
            </button>
          </PermissionGate>
        )}
      </div>

      {/* ── Pay App Workflow Timeline ──────────────────────── */}
      {appStatus !== 'void' && PAY_APP_FLOW.includes(appStatus as typeof PAY_APP_FLOW[number]) && (
        <div style={{ marginBottom: spacing['2'] }}>
          <WorkflowTimeline
            states={[...PAY_APP_FLOW]}
            labels={PAY_APP_FLOW_LABELS}
            currentState={appStatus}
            completedStates={completedPayAppStates}
          />
        </div>
      )}

      {showMissingWarning && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
          padding: spacing['4'], backgroundColor: colors.statusCriticalSubtle,
          borderRadius: borderRadius.base, borderLeft: `3px solid ${colors.statusCritical}`,
        }}>
          <AlertTriangle size={16} color={colors.statusCritical} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Pending Lien Waivers
            </p>
            <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
              {pendingWaivers.length} waiver{pendingWaivers.length !== 1 ? 's' : ''} missing. Cannot submit pay app to owner until all waivers are received or executed.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: spacing['1'], borderBottom: `1px solid ${colors.borderSubtle}`, paddingBottom: spacing['3'] }}>
        {([
          { key: 'g702', label: 'G702 / SOV' },
          { key: 'lien_waivers', label: `Lien Waivers${appWaivers.length > 0 ? ` (${appWaivers.length})` : ''}` },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setDetailTab(t.key)}
            style={{
              padding: `${spacing['1.5']} ${spacing['3']}`,
              border: 'none',
              borderRadius: borderRadius.base,
              backgroundColor: detailTab === t.key ? colors.primaryOrange : 'transparent',
              color: detailTab === t.key ? colors.white : colors.textSecondary,
              fontSize: typography.fontSize.sm,
              fontWeight: detailTab === t.key ? typography.fontWeight.semibold : typography.fontWeight.normal,
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {detailTab === 'g702' && (
        <>
          <G702Preview
            app={app}
            liveG702={liveG702}
            liveG703={liveG703}
            onApprove={onApprove}
            onMarkPaid={onMarkPaid}
            isApproving={isApproving}
            isMarkingPaid={isMarkingPaid}
            hasPendingWaivers={pendingWaivers.length > 0}
          />
          {sovLoading && <Skeleton width="100%" height="200px" />}
          {sovData && (
            <SOVEditorPanel
              sovData={sovData}
              appStatus={(app.status as string) || 'draft'}
              projectId={projectId}
              onLiveDataChange={handleLiveData}
            />
          )}
        </>
      )}

      {detailTab === 'lien_waivers' && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{
            padding: `${spacing['4']} ${spacing['5']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            display: 'flex', alignItems: 'center', gap: spacing['2'],
          }}>
            <Scale size={16} color={colors.primaryOrange} />
            <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Lien Waivers
            </span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>
              {appWaivers.length} total · {appWaivers.filter((w) => w.status !== 'pending').length} collected
            </span>
          </div>

          {pendingWaivers.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['3']} ${spacing['5']}`,
              backgroundColor: colors.statusCriticalSubtle,
              borderBottom: `1px solid ${colors.statusCritical}`,
            }}>
              <AlertTriangle size={14} color={colors.statusCritical} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
                {pendingWaivers.length} waiver{pendingWaivers.length !== 1 ? 's' : ''} missing. Cannot submit pay app to owner.
              </span>
            </div>
          )}

          {appWaivers.length === 0 ? (
            <div style={{ padding: spacing['6'] }}>
              <EmptyState
                icon={<Scale size={28} color={colors.textTertiary} />}
                title="No lien waivers yet"
                description={
                  (['approved', 'paid'] as string[]).includes(app.status as string)
                    ? 'No subcontractor line items with payment were found on this pay app.'
                    : 'Approve this pay app to auto-generate conditional lien waiver requests for all subs with payment.'
                }
              />
            </div>
          ) : (
            <div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 110px 110px 180px', gap: 0,
                backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}`,
                padding: `${spacing['2']} ${spacing['5']}`,
              }}>
                {['Sub Name', 'Type', 'Amount', 'Status', 'Actions'].map((h) => (
                  <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>
                    {h}
                  </span>
                ))}
              </div>

              {appWaivers.map((waiver, i) => {
                const sub = contracts.find((c) => c.id === waiver.subcontractor_id)
                const subName = (sub?.counterparty as string) ?? waiver.subcontractor_id
                const isOverdue = waiver.status === 'pending' &&
                  new Date(waiver.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 < nowMs
                const displayStatus: LienWaiverStatus | 'overdue' = isOverdue ? 'overdue' : waiver.status
                const statusCfg = LIEN_WAIVER_STATUS_CONFIG[displayStatus] ?? LIEN_WAIVER_STATUS_CONFIG.pending
                const busy = markingWaiverId === waiver.id

                return (
                  <div
                    key={waiver.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 140px 110px 110px 180px', gap: 0,
                      padding: `${spacing['3']} ${spacing['5']}`,
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                      backgroundColor: i % 2 === 0 ? colors.white : colors.surfacePage,
                      alignItems: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      {subName}
                    </p>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      {typeLabel[waiver.waiver_type] ?? waiver.waiver_type}
                    </span>
                    <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>
                      {fmtCurrency(waiver.amount)}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                      color: statusCfg.color, backgroundColor: statusCfg.bg, width: 'fit-content',
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusCfg.color }} />
                      {statusCfg.label}
                    </span>
                    <div style={{ display: 'flex', gap: spacing['2'] }}>
                      {waiver.status === 'pending' && (
                        <button
                          onClick={() => onMarkReceived(waiver.id)}
                          disabled={busy}
                          style={{
                            padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`,
                            borderRadius: borderRadius.base, backgroundColor: 'transparent',
                            color: colors.textSecondary, fontSize: typography.fontSize.caption,
                            fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                            cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {busy ? 'Saving...' : 'Mark Received'}
                        </button>
                      )}
                      {waiver.status === 'received' && (
                        <button
                          onClick={() => onMarkExecuted(waiver.id)}
                          disabled={busy}
                          style={{
                            padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.statusInfo}`,
                            borderRadius: borderRadius.base, backgroundColor: colors.statusInfoSubtle,
                            color: colors.statusInfo, fontSize: typography.fontSize.caption,
                            fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                            cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {busy ? 'Saving...' : 'Mark Executed'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  )
})
PayAppDetail.displayName = 'PayAppDetail'
