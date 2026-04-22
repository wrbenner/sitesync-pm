import React, { useMemo, memo, lazy, Suspense } from 'react'
import {
  AlertTriangle, Scale, Plus, Download,
} from 'lucide-react'
import { Card, SectionHeader, MetricBox, EmptyState } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import type { LienWaiverRow, LienWaiverStatus } from '../../types/api'
import { LienWaiverPDF, lienWaiverDataFromRow } from '../../components/export/LienWaiverPDF'
import type { LienWaiverRowContext } from '../../components/export/LienWaiverPDF'
import {
  fmtCurrency,
  fmtDate,
  LIEN_WAIVER_STATUS_CONFIG,
  WAIVER_COLLECTION_CONFIG,
  getWaiverCollectionStatus,
  stateToWaiverState,
  type PayAppProject,
} from './types'

const PDFDownloadLink = lazy(() =>
  import('@react-pdf/renderer').then((m) => ({ default: m.PDFDownloadLink })),
)

interface LienWaiverPanelProps {
  payApps: Array<Record<string, unknown>>
  waivers: LienWaiverRow[]
  contracts: Array<Record<string, unknown>>
  project: PayAppProject | undefined
  onMarkReceived: (id: string) => void
  onMarkExecuted: (id: string) => void
  isMarkingReceived: string | null
  onGenerateAll: (payAppId: string) => void
  isGenerating: boolean
}

export const LienWaiverPanel = memo<LienWaiverPanelProps>(({
  payApps, waivers, contracts, project, onMarkReceived, onMarkExecuted, isMarkingReceived, onGenerateAll, isGenerating,
}) => {
  const [selectedPayAppId, setSelectedPayAppId] = React.useState<string>('')
  const approvedApps = payApps.filter((a) => a.status === 'approved' || a.status === 'paid')

  const totalWaivers = waivers.length
  const receivedCount = waivers.filter((w) => w.status === 'received' || w.status === 'executed').length
  const pendingCount = waivers.filter((w) => w.status === 'pending').length
  const activeSubs = contracts.filter((c) => c.status !== 'terminated')

  const pdfContext: LienWaiverRowContext = {
    projectName: project?.name ?? '',
    projectAddress: project?.address ?? '',
    ownerName: project?.owner_name ?? '',
    contractorName: project?.general_contractor ?? '',
    waiverState: stateToWaiverState(project?.state),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing['4'] }}>
        <MetricBox label="Total Waivers" value={totalWaivers} />
        <MetricBox label="Received" value={receivedCount} />
        <MetricBox label="Pending" value={pendingCount} change={pendingCount > 0 ? -1 : 0} />
        <MetricBox label="Active Subs" value={activeSubs.length} />
      </div>

      {pendingCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          backgroundColor: colors.statusCriticalSubtle,
          borderRadius: borderRadius.base,
          borderLeft: `3px solid ${colors.statusCritical}`,
        }}>
          <AlertTriangle size={14} color={colors.statusCritical} />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
            {pendingCount} waiver{pendingCount !== 1 ? 's' : ''} missing. Cannot submit pay app to owner.
          </span>
        </div>
      )}

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
          <Scale size={16} color={colors.primaryOrange} />
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Lien Waiver Tracker
          </span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {totalWaivers} total · {receivedCount} collected
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            {approvedApps.length > 0 && (
              <>
                <select
                  value={selectedPayAppId}
                  onChange={(e) => setSelectedPayAppId(e.target.value)}
                  style={{
                    padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base, fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily, color: colors.textPrimary,
                    backgroundColor: colors.white, cursor: 'pointer',
                  }}
                >
                  <option value="">Select pay app...</option>
                  {approvedApps.map((a) => (
                    <option key={a.id as string} value={a.id as string}>
                      Pay App #{a.application_number as number} ({fmtDate(a.period_to as string)})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => selectedPayAppId && onGenerateAll(selectedPayAppId)}
                  disabled={!selectedPayAppId || isGenerating}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                    padding: `${spacing['1.5']} ${spacing['3']}`,
                    border: `1px solid ${colors.primaryOrange}`, borderRadius: borderRadius.base,
                    backgroundColor: selectedPayAppId ? colors.orangeSubtle : colors.surfaceInset,
                    color: selectedPayAppId ? colors.orangeText : colors.textTertiary,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    cursor: selectedPayAppId && !isGenerating ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={13} />
                  {isGenerating ? 'Generating...' : 'Generate All'}
                </button>
              </>
            )}
          </div>
        </div>

        {waivers.length === 0 ? (
          <div style={{ padding: spacing['6'] }}>
            <EmptyState
              icon={<Scale size={28} color={colors.textTertiary} />}
              title="No lien waivers yet"
              description="Approve a pay application to auto-generate lien waiver requests for all active subs."
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 110px 110px 110px 220px',
              gap: 0,
              backgroundColor: colors.surfaceInset,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              padding: `${spacing['2']} ${spacing['5']}`,
            }}>
              {['Sub Name', 'Type', 'Amount', 'Status', 'Waiver Date', 'Actions'].map((h) => (
                <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>
                  {h}
                </span>
              ))}
            </div>

            {waivers.map((waiver, i) => {
              const isOverdue = waiver.status === 'pending' && new Date(waiver.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 < Date.now()
              const displayStatus: LienWaiverStatus | 'overdue' = isOverdue ? 'overdue' : waiver.status
              const statusCfg = LIEN_WAIVER_STATUS_CONFIG[displayStatus] ?? LIEN_WAIVER_STATUS_CONFIG.pending
              const payApp = payApps.find((a) => a.id === waiver.pay_application_id)
              const typeLabel: Record<string, string> = {
                conditional_progress: 'Conditional Progress',
                unconditional_progress: 'Unconditional Progress',
                conditional_final: 'Conditional Final',
                unconditional_final: 'Unconditional Final',
              }
              const subName = (contracts.find((c) => c.id === waiver.subcontractor_id)?.counterparty as string) ?? null
              const pdfData = lienWaiverDataFromRow({
                type: waiver.waiver_type,
                sub_name: subName,
                amount: waiver.amount,
                through_date: waiver.payment_period,
                signed_by: null,
                signed_date: waiver.waiver_date,
              }, pdfContext)
              const pdfFileName = `LienWaiver_${(subName ?? 'sub').replace(/\s+/g, '_')}_${payApp?.application_number ?? 'PA'}.pdf`
              const busy = isMarkingReceived === waiver.id

              return (
                <div
                  key={waiver.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 110px 110px 110px 220px',
                    gap: 0,
                    padding: `${spacing['3']} ${spacing['5']}`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: i % 2 === 0 ? colors.white : colors.surfacePage,
                    alignItems: 'center',
                  }}
                >
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                    {subName ?? 'Unknown Sub'}
                  </p>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
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
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                    {waiver.waiver_date ? fmtDate(waiver.waiver_date) : (waiver.received_at ? fmtDate(waiver.received_at) : '')}
                  </span>
                  <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
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
                    <Suspense fallback={
                      <button
                        style={{
                          padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`,
                          borderRadius: borderRadius.base, backgroundColor: 'transparent',
                          color: colors.textSecondary, fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                          cursor: 'default',
                        }}
                      >
                        <Download size={11} /> PDF
                      </button>
                    }>
                      <PDFDownloadLink document={<LienWaiverPDF data={pdfData} />} fileName={pdfFileName}>
                        {({ loading }: { loading: boolean }) => (
                          <button
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                              padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.primaryOrange}`,
                              borderRadius: borderRadius.base, backgroundColor: colors.orangeSubtle,
                              color: colors.orangeText, fontSize: typography.fontSize.caption,
                              fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            <Download size={11} /> {loading ? 'Building...' : 'PDF'}
                          </button>
                        )}
                      </PDFDownloadLink>
                    </Suspense>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {approvedApps.length > 0 && (
        <Card padding={spacing['5']}>
          <SectionHeader title="Compliance by Pay Application" />
          <div style={{ marginTop: spacing['4'] }}>
            {approvedApps.map((app) => {
              const appWaivers = waivers.filter((w) => w.pay_application_id === (app.id as string))
              const collectionStatus = getWaiverCollectionStatus(appWaivers)
              const statusConfig = WAIVER_COLLECTION_CONFIG[collectionStatus]
              return (
                <div
                  key={app.id as string}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['3']} 0`, borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: borderRadius.base,
                    backgroundColor: statusConfig.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Scale size={14} color={statusConfig.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      Pay App #{app.application_number as number}
                    </p>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {fmtCurrency(app.current_payment_due as number)} · {fmtDate(app.period_to as string)}
                      {appWaivers.length > 0 && ` · ${appWaivers.length} waiver${appWaivers.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                    padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                    color: statusConfig.color, backgroundColor: statusConfig.bg,
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusConfig.color }} />
                    {statusConfig.label}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
})
LienWaiverPanel.displayName = 'LienWaiverPanel'

// ── Cash Flow Panel ─────────────────────────────────────────

interface CashFlowPanelProps {
  payApps: Array<Record<string, unknown>>
  retainage: Array<Record<string, unknown>>
}

export const CashFlowPanel = memo<CashFlowPanelProps>(({ payApps, retainage }) => {
  const metrics = useMemo(() => {
    const totalBilled = payApps.reduce((s, a) => s + ((a.total_completed_and_stored as number) || 0), 0)
    const totalPaid = payApps.filter((a) => a.status === 'paid').reduce((s, a) => s + ((a.current_payment_due as number) || 0), 0)
    const totalRetainage = retainage.reduce((s, r) => s + (((r.amount as number) || 0) - ((r.released_amount as number) || 0)), 0)
    const outstanding = totalBilled - totalPaid - totalRetainage
    const pendingApps = payApps.filter((a) => a.status !== 'paid' && a.status !== 'void' && a.status !== 'draft')
    const pendingAmount = pendingApps.reduce((s, a) => s + ((a.current_payment_due as number) || 0), 0)

    return { totalBilled, totalPaid, totalRetainage, outstanding, pendingAmount }
  }, [payApps, retainage])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['6'] }}>
        <MetricBox label="Total Billed" value={fmtCurrency(metrics.totalBilled)} />
        <MetricBox label="Total Paid" value={fmtCurrency(metrics.totalPaid)} change={1} />
        <MetricBox label="Retainage Held" value={fmtCurrency(metrics.totalRetainage)} />
        <MetricBox label="Pending Payment" value={fmtCurrency(metrics.pendingAmount)} change={metrics.pendingAmount > 0 ? -1 : 0} />
      </div>

      <Card padding={spacing['5']}>
        <SectionHeader title="Cash Flow Projection" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], marginTop: spacing['4'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusActive }} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 100 }}>Money In</span>
            <div style={{ flex: 1, height: 24, backgroundColor: colors.statusActiveSubtle, borderRadius: borderRadius.base, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (metrics.totalPaid / Math.max(metrics.totalBilled, 1)) * 100)}%`, backgroundColor: colors.statusActive, borderRadius: borderRadius.base }} />
            </div>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, minWidth: 90, textAlign: 'right' }}>{fmtCurrency(metrics.totalPaid)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusCritical }} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 100 }}>Money Out</span>
            <div style={{ flex: 1, height: 24, backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.base, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (metrics.outstanding / Math.max(metrics.totalBilled, 1)) * 100)}%`, backgroundColor: colors.statusCritical, borderRadius: borderRadius.base }} />
            </div>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, minWidth: 90, textAlign: 'right' }}>{fmtCurrency(metrics.outstanding)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusPending }} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 100 }}>Retainage</span>
            <div style={{ flex: 1, height: 24, backgroundColor: colors.statusPendingSubtle, borderRadius: borderRadius.base, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (metrics.totalRetainage / Math.max(metrics.totalBilled, 1)) * 100)}%`, backgroundColor: colors.statusPending, borderRadius: borderRadius.base }} />
            </div>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, minWidth: 90, textAlign: 'right' }}>{fmtCurrency(metrics.totalRetainage)}</span>
          </div>
        </div>

        {metrics.pendingAmount > 50000 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
            padding: spacing['4'], marginTop: spacing['4'],
            backgroundColor: colors.statusPendingSubtle, borderRadius: borderRadius.base,
            borderLeft: `3px solid ${colors.statusPending}`,
          }}>
            <AlertTriangle size={16} color={colors.statusPending} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Cash Flow Gap Detected
              </p>
              <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
                You have {fmtCurrency(metrics.pendingAmount)} in approved payments due to subcontractors. Owner payment may not arrive for 15 to 20 days. Consider requesting early payment or using SiteSync Bridge Financing.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
})
CashFlowPanel.displayName = 'CashFlowPanel'
