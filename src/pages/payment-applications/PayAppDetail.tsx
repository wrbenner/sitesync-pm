import React, { useState, useCallback, memo, useMemo } from 'react'
import { toast } from 'sonner'
import { FileText, AlertTriangle, Scale } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Card, Skeleton, EmptyState } from '../../components/Primitives'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { WorkflowTimeline } from '../../components/WorkflowTimeline'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { usePayAppSOV } from '../../hooks/queries'
import { useInsuranceCertificates } from '../../hooks/queries/insurance-certificates'
import { supabase } from '../../lib/supabase'
import { logAuditEntry } from '../../lib/auditLogger'
import type { G702Data, G703LineItem } from '../../machines/paymentMachine'
import type { LienWaiverRow, LienWaiverStatus } from '../../types/api'
import { fmtCurrency, LIEN_WAIVER_STATUS_CONFIG } from './types'
import { G702Preview } from './G702Preview'
import { SOVEditorPanel } from './SOVEditor'
import { PreSubmissionAudit } from './PreSubmissionAudit'
import {
  runAudit,
  type AuditInput,
  type AuditPayApp,
  type AuditLineItem,
  type AuditLienWaiver,
  type AuditInsurance,
  type AuditPeriodContractor,
  type CheckId,
} from './auditChecks'
import {
  type Cents,
  addCents,
  applyRateCents,
  dollarsToCents,
  fromCents,
} from '../../types/money'

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

  // ─── Pre-submission audit wiring ───────────────────────────────────────
  // Audit gate runs while the pay app is being prepared (draft) or queued
  // for owner review (submitted). Once approved/paid, the audit's purpose
  // is over so the panel hides.
  const showAuditGate = appStatus === 'draft' || appStatus === 'submitted'
  const { data: insuranceRows } = useInsuranceCertificates(projectId)

  const auditInput = useMemo<AuditInput | null>(() => {
    if (!sovData) return null

    const payApp: AuditPayApp = {
      id: (app.id as string),
      application_number: (app.application_number as number) ?? 0,
      period_to: (app.period_to as string) ?? sovData.periodTo ?? new Date().toISOString().slice(0, 10),
      period_from: (app.period_from as string | null) ?? null,
      original_contract_sum:
        (app.original_contract_sum as number | undefined) ?? sovData.originalContractSum ?? 0,
      net_change_orders:
        (app.net_change_orders as number | undefined) ?? sovData.netChangeOrders ?? 0,
      total_completed_and_stored: (app.total_completed_and_stored as number | undefined) ?? 0,
      retainage_percent:
        (app.retainage_percent as number | undefined) ??
        (sovData.retainageRate ? sovData.retainageRate * 100 : 10),
      retainage_amount: (app.retainage_amount as number | undefined) ?? 0,
      less_previous_certificates:
        (app.less_previous_certificates as number | undefined) ??
        sovData.lessPreviousCertificates ??
        0,
      current_payment_due: (app.current_payment_due as number | undefined) ?? 0,
    }

    const lineItems: AuditLineItem[] = sovData.lineItems.map((row) => {
      // Internal cents math so pct × dollars doesn't drift; back to dollars
      // at the boundary for auditChecks.ts which still operates on number.
      const svC: Cents = dollarsToCents(row.scheduled_value)
      const prevAmtC: Cents = applyRateCents(svC, row.prev_pct_complete / 100)
      const thisAmtC: Cents = applyRateCents(svC, row.current_pct_complete / 100)
      return {
        id: row.id,
        item_number: row.item_number,
        description: row.description,
        scheduled_value: row.scheduled_value,
        previous_completed: fromCents(prevAmtC) / 100,
        this_period: fromCents(thisAmtC) / 100,
        materials_stored: row.stored_materials ?? 0,
        percent_complete: row.prev_pct_complete + row.current_pct_complete,
      }
    })

    // Map LienWaiverRow → AuditLienWaiver via the contracts join already
    // available in props. The audit lib only cares whether status !== 'pending';
    // map received/executed/missing to plausible waiver-type labels.
    const auditWaivers: AuditLienWaiver[] = appWaivers.map((w) => {
      const sub = contracts.find((c) => c.id === w.subcontractor_id)
      const contractor_name = ((sub?.counterparty as string | undefined) ?? w.subcontractor_id) || ''
      const status: AuditLienWaiver['status'] =
        w.status === 'received' ? 'conditional'
        : w.status === 'executed' ? 'unconditional'
        : 'pending'
      return {
        id: w.id,
        contractor_name,
        application_id: w.pay_application_id,
        amount: w.amount,
        status,
        through_date: w.payment_period ?? '',
      }
    })

    const insurance: AuditInsurance[] = (insuranceRows ?? []).map((c) => ({
      id: c.id,
      company: c.company,
      policy_type: c.policy_type ?? null,
      effective_date: c.effective_date,
      expiration_date: c.expiration_date,
      verified: !!c.verified,
    }))

    // One pay app = one contract in this app's data model. Roll up the
    // billed-this-period total against the contract's counterparty as the
    // single billing contractor; the audit lib then matches it against
    // waivers + COIs by name.
    // Sum on integer cents to prevent N-line accumulation drift.
    const totalThisPeriodC: Cents = lineItems.reduce<Cents>(
      (acc, li) =>
        addCents(
          acc,
          addCents(dollarsToCents(li.this_period), dollarsToCents(li.materials_stored)),
        ),
      0 as Cents,
    )
    const totalThisPeriod = fromCents(totalThisPeriodC) / 100
    const contractorsThisPeriod: AuditPeriodContractor[] =
      totalThisPeriod > 0 && sovData.contractorName
        ? [{
            contractor_id: sovData.contractId ?? null,
            contractor_name: sovData.contractorName,
            billed_amount_this_period: totalThisPeriod,
          }]
        : []

    return { payApp, lineItems, waivers: auditWaivers, insurance, contractorsThisPeriod }
  }, [app, sovData, appWaivers, contracts, insuranceRows])

  // Track override acceptance so the G702 print button re-enables once a
  // documented override has been persisted.
  const [overrideAccepted, setOverrideAccepted] = useState(false)

  const insertOverride = useMutation({
    mutationFn: async (args: { reason: string; check_ids: CheckId[] }) => {
      const { data, error } = await supabase
        .from('payapp_audit_overrides')
        .insert({
          project_id: projectId,
          pay_app_id: app.id as string,
          reason: args.reason,
          check_ids: args.check_ids,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
  })

  // Computed gate for the existing "Generate AIA G702/G703" button.
  const auditCanSubmit = auditInput ? runAudit(auditInput).canSubmit : true
  const g702Allowed = auditCanSubmit || overrideAccepted

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
                if (!g702Allowed) return
                window.print()
                toast.success('G702/G703 print view opened')
              }}
              disabled={!g702Allowed}
              title={!g702Allowed ? 'Pre-submission audit failed — accept overrides to proceed' : undefined}
              data-testid="generate-g702-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none', borderRadius: borderRadius.md,
                backgroundColor: g702Allowed ? colors.primaryOrange : colors.surfaceInset,
                color: g702Allowed ? colors.white : colors.textTertiary,
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                cursor: g702Allowed ? 'pointer' : 'not-allowed', fontFamily: typography.fontFamily,
                opacity: g702Allowed ? 1 : 0.7,
              }}
            >
              <FileText size={14} /> Generate AIA G702/G703
            </button>
          </PermissionGate>
        )}
      </div>

      {/* Workflow timeline — visual journey of pay-app status */}
      <div
        style={{
          padding: spacing['4'],
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <WorkflowTimeline
          ariaLabel={`Pay application ${appNumber} workflow status`}
          currentState={appStatus || 'draft'}
          states={[
            { key: 'draft', label: 'Draft' },
            { key: 'submitted', label: 'Submitted' },
            { key: 'approved', label: 'Approved' },
            { key: 'paid', label: 'Paid' },
          ]}
        />
      </div>

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

      {/* Pre-submission audit gate — runs above the approve/submit area while
          the pay app is in draft or submitted state. Hidden once approved/paid. */}
      {showAuditGate && auditInput && (
        <PreSubmissionAudit
          input={auditInput}
          isSubmitting={isApproving || insertOverride.isPending}
          onSubmit={async (_summary, override) => {
            try {
              if (override) {
                await insertOverride.mutateAsync(override)
                logAuditEntry({
                  projectId,
                  entityType: 'pay_app',
                  entityId: app.id as string,
                  action: 'submit_with_override',
                  metadata: {
                    reason: override.reason,
                    check_ids: override.check_ids,
                    application_number: appNumber,
                  },
                }).catch(() => {
                  // Audit logger swallows its own errors in dev; nothing to do here.
                })
                setOverrideAccepted(true)
                toast.success('Override recorded — proceeding to submit')
              }
              onApprove()
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Failed to record override'
              toast.error(`Could not record override: ${msg}`)
            }
          }}
        />
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
                        <PermissionGate permission="financials.edit">
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
                        </PermissionGate>
                      )}
                      {waiver.status === 'received' && (
                        <PermissionGate permission="financials.edit">
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
                        </PermissionGate>
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
