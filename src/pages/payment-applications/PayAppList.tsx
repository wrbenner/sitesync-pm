import React from 'react'
import { Plus, Receipt, CreditCard, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Card, Btn, SectionHeader, EmptyState } from '../../components/Primitives'
import { DataTable, createColumnHelper } from '../../components/shared/DataTable'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { colors, spacing, typography, borderRadius, touchTarget } from '../../styles/theme'
import {
  getPaymentStatusConfig,
  getValidPaymentTransitions,
} from '../../machines/paymentMachine'
import type { PaymentStatus } from '../../machines/paymentMachine'
import { fmtCurrency, fmtDate } from './types'

interface PayAppListProps {
  apps: Array<Record<string, unknown>>
  selectedAppId: string | null
  onSelectApp: (id: string | null) => void
  onCreateApp: () => void
  onEditApp: (app: Record<string, unknown>) => void
}

export const PayAppList: React.FC<PayAppListProps> = ({
  apps, selectedAppId, onSelectApp, onCreateApp, onEditApp,
}) => {
  const columns = React.useMemo(() => {
    const col = createColumnHelper<Record<string, unknown>>()
    return [
      col.accessor('application_number', {
        header: 'App #',
        cell: (info) => (
          <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono, fontSize: typography.fontSize.sm }}>
            #{info.getValue() as number}
          </span>
        ),
      }),
      col.accessor('period_to', {
        header: 'Period To',
        cell: (info) => <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>{fmtDate(info.getValue() as string)}</span>,
      }),
      col.accessor('contract_sum_to_date', {
        header: 'Contract Sum',
        cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{fmtCurrency(info.getValue() as number)}</span>,
      }),
      col.accessor('total_completed_and_stored', {
        header: 'Completed',
        cell: (info) => <span style={{ color: colors.textPrimary }}>{fmtCurrency(info.getValue() as number)}</span>,
      }),
      col.accessor('retainage', {
        header: 'Retainage',
        cell: (info) => <span style={{ color: colors.statusPending }}>{fmtCurrency(info.getValue() as number)}</span>,
      }),
      col.accessor('current_payment_due', {
        header: 'Payment Due',
        cell: (info) => <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.statusActive, fontSize: typography.fontSize.body }}>{fmtCurrency(info.getValue() as number)}</span>,
      }),
      col.accessor('status', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue() as PaymentStatus
          const config = getPaymentStatusConfig(status)
          return (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
              padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              color: config.color, backgroundColor: config.bg,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: config.color }} />
              {config.label}
            </span>
          )
        },
      }),
      col.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const status = info.row.original.status as PaymentStatus
          const transitions = getValidPaymentTransitions(status)
          if (transitions.length === 0) return null
          return (
            <div style={{ display: 'flex', gap: spacing['1'] }}>
              {(status === 'draft') && (
                <button
                  aria-label="Edit Schedule of Values"
                  title="Edit Schedule of Values"
                  onClick={(e) => { e.stopPropagation(); onEditApp(info.row.original) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                    padding: `0 ${spacing['3']}`, minHeight: touchTarget.field, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base,
                    backgroundColor: 'transparent', color: colors.textSecondary,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                    cursor: 'pointer', fontFamily: typography.fontFamily,
                  }}
                >
                  Edit SOV
                </button>
              )}
              {status === 'approved' && (
                <button
                  aria-label="Pay subcontractor"
                  title="Pay subcontractor"
                  onClick={() => toast.success('Payment flow initiated')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                    padding: `0 ${spacing['3']}`, minHeight: touchTarget.field, border: 'none', borderRadius: borderRadius.base,
                    backgroundColor: colors.primaryOrange, color: colors.white,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                    cursor: 'pointer', fontFamily: typography.fontFamily,
                  }}
                >
                  <CreditCard size={11} /> Pay Sub
                </button>
              )}
              {status === 'draft' && (
                <button
                  aria-label="Submit application for review"
                  title="Submit application for review"
                  onClick={() => toast.success('Application submitted for review')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                    padding: `0 ${spacing['3']}`, minHeight: touchTarget.field, border: 'none', borderRadius: borderRadius.base,
                    backgroundColor: colors.statusInfoSubtle, color: colors.statusInfo,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                    cursor: 'pointer', fontFamily: typography.fontFamily,
                  }}
                >
                  <Send size={11} /> Submit
                </button>
              )}
            </div>
          )
        },
      }),
    ]
  }, [onEditApp])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PermissionGate permission="payments.create">
          <Btn onClick={onCreateApp} size="sm">
            <Plus size={14} /> New Pay Application
          </Btn>
        </PermissionGate>
      </div>

      <Card padding={spacing['4']}>
        <SectionHeader title="Payment Applications" />
        {apps.length > 0 ? (
          <div style={{ marginTop: spacing['3'] }}>
            <DataTable
              columns={columns}
              data={apps}
              onRowClick={(row) => onSelectApp(
                selectedAppId === (row.id as string) ? null : (row.id as string),
              )}
            />
          </div>
        ) : (
          <EmptyState
            icon={<Receipt size={32} color={colors.textTertiary} />}
            title="No payment applications"
            description="Create your first AIA G702 payment application from the schedule of values."
            action={
              <PermissionGate permission="payments.create">
                <Btn onClick={onCreateApp} size="sm">
                  <Plus size={14} /> Create Pay App
                </Btn>
              </PermissionGate>
            }
          />
        )}
      </Card>
    </>
  )
}
