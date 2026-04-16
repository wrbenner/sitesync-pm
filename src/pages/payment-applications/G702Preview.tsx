import React, { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react'
import { FileText, CheckCircle, CreditCard, Download, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Card, Btn } from '../../components/Primitives'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'
import type { G702Data, G703LineItem } from '../../machines/paymentMachine'
import { G702ApplicationPDF } from '../../components/export/G702ApplicationPDF'
import { G703ContinuationPDF } from '../../components/export/G703ContinuationPDF'
import { generatePayAppPdfFromData, type PayAppPdfData } from '../../services/pdf/paymentAppPdf'
import { fmtCurrency, fmtDate } from './types'

const PDFDownloadLink = lazy(() =>
  import('@react-pdf/renderer').then((m) => ({ default: m.PDFDownloadLink })),
)

interface G702PreviewProps {
  app: Record<string, unknown>
  liveG702?: G702Data
  liveG703?: G703LineItem[]
  onApprove?: () => void
  isApproving?: boolean
  hasPendingWaivers?: boolean
}

export const G702Preview = memo<G702PreviewProps>(({
  app, liveG702, liveG703, onApprove, isApproving, hasPendingWaivers,
}) => {
  const [isPdfExporting, setIsPdfExporting] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIsMobile(window.innerWidth < 768), 150)
    }
    window.addEventListener('resize', handleResize)
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize) }
  }, [])

  const handleExportG702G703 = useCallback(async () => {
    setIsPdfExporting(true)
    try {
      const appNum = app.application_number as number
      const pdfData: PayAppPdfData = liveG702
        ? {
            applicationNumber: liveG702.applicationNumber,
            periodTo: liveG702.periodTo,
            periodFrom: app.period_from as string | null,
            status: app.status as string,
            projectName: liveG702.projectName,
            contractorName: liveG702.contractorName,
            originalContractSum: liveG702.originalContractSum,
            netChangeOrders: liveG702.netChangeOrders,
            contractSumToDate: liveG702.contractSumToDate,
            totalCompletedAndStored: liveG702.totalCompletedAndStored,
            retainagePercent: liveG702.retainagePercent,
            retainageAmount: liveG702.retainageAmount,
            totalEarnedLessRetainage: liveG702.totalEarnedLessRetainage,
            lessPreviousCertificates: liveG702.lessPreviousCertificates,
            currentPaymentDue: liveG702.currentPaymentDue,
            balanceToFinish: liveG702.balanceToFinish,
            sovLines: liveG703?.map((l) => ({
              itemNumber: l.itemNumber,
              description: l.description,
              scheduledValue: l.scheduledValue,
              previousCompleted: l.previousCompleted,
              thisPeroid: l.thisPeroid,
              materialsStored: l.materialsStored,
              totalCompletedAndStored: l.totalCompletedAndStored,
              percentComplete: l.percentComplete,
              balanceToFinish: l.balanceToFinish,
              retainage: l.retainage,
            })),
          }
        : {
            applicationNumber: appNum,
            periodTo: app.period_to as string,
            periodFrom: app.period_from as string | null,
            status: app.status as string,
            projectName: 'Project',
            originalContractSum: (app.original_contract_sum as number) ?? 0,
            netChangeOrders: (app.net_change_orders as number) ?? 0,
            contractSumToDate: (app.contract_sum_to_date as number) ?? 0,
            totalCompletedAndStored: (app.total_completed_and_stored as number) ?? 0,
            retainagePercent: 10,
            retainageAmount: (app.retainage as number) ?? 0,
            totalEarnedLessRetainage: (app.total_earned_less_retainage as number) ?? 0,
            lessPreviousCertificates: (app.less_previous_certificates as number) ?? 0,
            currentPaymentDue: (app.current_payment_due as number) ?? 0,
            balanceToFinish: (app.balance_to_finish as number) ?? 0,
          }
      const blob = await generatePayAppPdfFromData(pdfData)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `G702_G703_App${appNum}_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setIsPdfExporting(false)
    }
  }, [app, liveG702, liveG703])

  const g = liveG702
  const rows = [
    { label: '1. Original Contract Sum', value: fmtCurrency(g ? g.originalContractSum : (app.original_contract_sum as number)) },
    { label: '2. Net Change by Change Orders', value: fmtCurrency(g ? g.netChangeOrders : (app.net_change_orders as number)) },
    { label: '3. Contract Sum to Date (1 + 2)', value: fmtCurrency(g ? g.contractSumToDate : (app.contract_sum_to_date as number)), bold: true },
    { label: '4. Total Completed and Stored to Date', value: fmtCurrency(g ? g.totalCompletedAndStored : (app.total_completed_and_stored as number)) },
    { label: `5. Retainage${g ? ` (${g.retainagePercent.toFixed(0)}%)` : ''}`, value: fmtCurrency(g ? g.retainageAmount : (app.retainage as number)) },
    { label: '6. Total Earned Less Retainage (4 − 5)', value: fmtCurrency(g ? g.totalEarnedLessRetainage : (app.total_earned_less_retainage as number)) },
    { label: '7. Less Previous Certificates for Payment', value: fmtCurrency(g ? g.lessPreviousCertificates : (app.less_previous_certificates as number)) },
    { label: '8. Current Payment Due (6 − 7)', value: fmtCurrency(g ? g.currentPaymentDue : (app.current_payment_due as number)), bold: true, highlight: true },
    { label: '9. Balance to Finish (3 − 4)', value: fmtCurrency(g ? g.balanceToFinish : (app.balance_to_finish as number)) },
  ]

  const appNum = app.application_number as number
  const periodTo = fmtDate(app.period_to as string)

  return (
    <>
    <Card padding={spacing['5']}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <FileText size={16} color={colors.primaryOrange} />
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          AIA G702 Summary
        </span>
        {liveG702 && (
          <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive, backgroundColor: colors.statusActiveSubtle, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full }}>
            Live
          </span>
        )}
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>
          Application #{appNum} · Period to {periodTo}
        </span>
        <button
          onClick={handleExportG702G703}
          disabled={isPdfExporting || (app.status as string) === 'draft'}
          title={(app.status as string) === 'draft' ? 'Submit pay app before exporting' : undefined}
          aria-label="Export AIA G702 G703 payment application as PDF"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing['1.5'],
            height: '40px',
            padding: `0 ${spacing['4']}`,
            backgroundColor:
              isPdfExporting || (app.status as string) === 'draft'
                ? colors.textTertiary
                : colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor:
              isPdfExporting || (app.status as string) === 'draft' ? 'not-allowed' : 'pointer',
            opacity: (app.status as string) === 'draft' ? 0.5 : 1,
            transition: transitions.base,
            flexShrink: 0,
          }}
        >
          {isPdfExporting ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <Download size={14} />
              Export G702/G703
            </>
          )}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: `${spacing['2.5']} 0`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              backgroundColor: row.highlight ? colors.orangeSubtle : 'transparent',
              paddingLeft: row.highlight ? spacing['3'] : 0,
              paddingRight: row.highlight ? spacing['3'] : 0,
              borderRadius: row.highlight ? borderRadius.base : 0,
            }}
          >
            <span style={{
              fontSize: typography.fontSize.sm,
              color: row.bold ? colors.textPrimary : colors.textSecondary,
              fontWeight: row.bold ? typography.fontWeight.semibold : typography.fontWeight.normal,
            }}>
              {row.label}
            </span>
            <span style={{
              fontSize: row.highlight ? typography.fontSize.title : typography.fontSize.sm,
              color: row.highlight ? colors.primaryOrange : row.bold ? colors.textPrimary : colors.textSecondary,
              fontWeight: row.bold || row.highlight ? typography.fontWeight.bold : typography.fontWeight.medium,
              fontFeatureSettings: '"tnum"',
            }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['4'], flexWrap: 'wrap' }}>
        {!isMobile && (['submitted', 'gc_review', 'owner_review'] as string[]).includes(app.status as string) && onApprove && (
          <PermissionGate permission="payments.create">
            <Btn
              variant="primary"
              size="sm"
              onClick={onApprove}
              disabled={isApproving || hasPendingWaivers}
              title={hasPendingWaivers ? 'Collect all lien waivers before approving' : undefined}
            >
              <CheckCircle size={14} /> {isApproving ? 'Approving...' : 'Approve Pay App'}
            </Btn>
          </PermissionGate>
        )}
        {!isMobile && (app.status as string) === 'approved' && (
          <PermissionGate permission="payments.create">
            <Btn
              variant="primary"
              size="sm"
              onClick={() => toast.success('Opening payment flow...')}
            >
              <CreditCard size={14} /> Process Payment
            </Btn>
          </PermissionGate>
        )}
        {liveG702 ? (
          <Suspense fallback={<Btn variant="ghost" size="sm"><FileText size={14} /> Preparing G702...</Btn>}>
            <PDFDownloadLink
              document={<G702ApplicationPDF data={liveG702} />}
              fileName={`G702_App${appNum}_${new Date().toISOString().slice(0, 10)}.pdf`}
            >
              {({ loading }: { loading: boolean }) => (
                <Btn variant="ghost" size="sm">
                  <FileText size={14} /> {loading ? 'Generating...' : 'Export G702 PDF'}
                </Btn>
              )}
            </PDFDownloadLink>
          </Suspense>
        ) : (
          <Btn variant="ghost" size="sm" onClick={() => toast.info('Load SOV data to export G702 PDF')}>
            <FileText size={14} /> Export G702 PDF
          </Btn>
        )}
        {liveG702 && liveG703 ? (
          <Suspense fallback={<Btn variant="ghost" size="sm"><Receipt size={14} /> Preparing G703...</Btn>}>
            <PDFDownloadLink
              document={
                <G703ContinuationPDF
                  projectName={liveG702.projectName}
                  applicationNumber={liveG702.applicationNumber}
                  periodTo={liveG702.periodTo}
                  lineItems={liveG703}
                  summary={liveG702}
                />
              }
              fileName={`G703_App${appNum}_${new Date().toISOString().slice(0, 10)}.pdf`}
            >
              {({ loading }: { loading: boolean }) => (
                <Btn variant="ghost" size="sm">
                  <Receipt size={14} /> {loading ? 'Generating...' : 'Export G703'}
                </Btn>
              )}
            </PDFDownloadLink>
          </Suspense>
        ) : (
          <Btn variant="ghost" size="sm" onClick={() => toast.info('Load SOV data to export G703')}>
            <Receipt size={14} /> Export G703
          </Btn>
        )}
      </div>
    </Card>

    {isMobile && (
      <div style={{
        position: 'sticky',
        bottom: 0,
        padding: spacing['3'],
        backgroundColor: colors.white,
        borderTop: '1px solid ' + colors.borderDefault,
        display: 'flex',
        gap: spacing['2'],
        zIndex: 10,
      }}>
        {(['submitted', 'gc_review', 'owner_review'] as string[]).includes(app.status as string) && onApprove && (
          <PermissionGate permission="payments.create">
            <Btn
              variant="primary"
              size="sm"
              onClick={onApprove}
              disabled={isApproving || hasPendingWaivers}
              title={hasPendingWaivers ? 'Collect all lien waivers before approving' : undefined}
              style={{ minHeight: 56, minWidth: 56 }}
            >
              <CheckCircle size={14} /> {isApproving ? 'Approving...' : 'Approve Pay App'}
            </Btn>
          </PermissionGate>
        )}
        {(app.status as string) === 'approved' && (
          <PermissionGate permission="payments.create">
            <Btn
              variant="primary"
              size="sm"
              onClick={() => toast.success('Opening payment flow...')}
              style={{ minHeight: 56, minWidth: 56 }}
            >
              <CreditCard size={14} /> Process Payment
            </Btn>
          </PermissionGate>
        )}
      </div>
    )}
  </>
  )
})
G702Preview.displayName = 'G702Preview'
