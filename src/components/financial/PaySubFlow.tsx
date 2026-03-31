import React, { useState, useMemo, useCallback, memo } from 'react'
import {
  CreditCard, Building2, DollarSign, ArrowRight, CheckCircle,
  AlertTriangle, Loader, X, Shield, Receipt,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../../styles/theme'
import { Btn } from '../Primitives'
import { calculatePlatformFee } from '../../services/payments/stripe'
import type { PaymentMethod } from '../../services/payments/stripe'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────

interface PaySubFlowProps {
  open: boolean
  onClose: () => void
  applicationNumber: number
  recipientName: string
  amount: number // in dollars
  retainageAmount: number
  onSubmit: (method: PaymentMethod) => Promise<void>
}

type FlowStep = 'method' | 'review' | 'processing' | 'success'

const PAYMENT_METHODS: Array<{
  id: PaymentMethod
  label: string
  description: string
  icon: React.ElementType
  recommended: boolean
}> = [
  {
    id: 'ach_debit',
    label: 'ACH Bank Transfer',
    description: '0.5% fee, capped at $5. 2 to 3 business days.',
    icon: Building2,
    recommended: true,
  },
  {
    id: 'ach_credit',
    label: 'ACH Credit Push',
    description: '0.5% fee, capped at $5. Same day with early cutoff.',
    icon: Building2,
    recommended: false,
  },
  {
    id: 'card',
    label: 'Credit/Debit Card',
    description: '1.5% processing fee. Instant confirmation.',
    icon: CreditCard,
    recommended: false,
  },
]

// ── Formatters ────────────────────────────────────────────────

const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100)

const fmtDollars = (dollars: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(dollars)

// ── Main Component ────────────────────────────────────────────

export const PaySubFlow = memo<PaySubFlowProps>(
  ({ open, onClose, applicationNumber, recipientName, amount, retainageAmount, onSubmit }) => {
    const [step, setStep] = useState<FlowStep>('method')
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('ach_debit')

    const amountCents = Math.round(amount * 100)
    const fee = calculatePlatformFee(amountCents, selectedMethod)
    const totalAmount = amountCents + fee

    const handleConfirm = useCallback(async () => {
      setStep('processing')
      try {
        await onSubmit(selectedMethod)
        setStep('success')
      } catch (err) {
        toast.error(`Payment failed: ${(err as Error).message}`)
        setStep('review')
      }
    }, [selectedMethod, onSubmit])

    const handleClose = useCallback(() => {
      setStep('method')
      setSelectedMethod('ach_debit')
      onClose()
    }, [onClose])

    if (!open) return null

    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: zIndex.modal,
          backgroundColor: colors.overlayBackdrop, backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: spacing['4'],
        }}
        role="dialog"
        aria-label="Process payment"
        aria-modal="true"
      >
        <div style={{
          width: '100%', maxWidth: 480,
          backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
          boxShadow: shadows.panel, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${spacing['4']} ${spacing['5']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Pay Subcontractor
              </p>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                Pay App #{applicationNumber} · {recipientName}
              </p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close payment dialog"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['2'] }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Step: Method Selection */}
          {step === 'method' && (
            <div style={{ padding: spacing['5'] }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: spacing['4'], backgroundColor: colors.orangeSubtle,
                borderRadius: borderRadius.md, marginBottom: spacing['5'],
              }}>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Payment Amount</span>
                <span style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange }}>
                  {fmtDollars(amount)}
                </span>
              </div>

              <p style={{ margin: 0, marginBottom: spacing['3'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary }}>
                Select Payment Method
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = selectedMethod === method.id
                  const Icon = method.icon
                  const methodFee = calculatePlatformFee(amountCents, method.id)

                  return (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['3'],
                        padding: spacing['4'],
                        border: `2px solid ${isSelected ? colors.primaryOrange : colors.borderDefault}`,
                        borderRadius: borderRadius.md,
                        backgroundColor: isSelected ? colors.orangeSubtle : 'transparent',
                        cursor: 'pointer', fontFamily: typography.fontFamily, textAlign: 'left',
                        transition: `all ${transitions.quick}`,
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: borderRadius.base,
                        backgroundColor: isSelected ? colors.primaryOrange : colors.surfaceInset,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={16} color={isSelected ? colors.white : colors.textTertiary} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{method.label}</span>
                          {method.recommended && (
                            <span style={{
                              padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                              backgroundColor: colors.statusActiveSubtle, color: colors.statusActive,
                              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                            }}>
                              Recommended
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{method.description}</span>
                      </div>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>
                        {fmtCurrency(methodFee)} fee
                      </span>
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['5'] }}>
                <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
                <Btn onClick={() => setStep('review')}>
                  Continue <ArrowRight size={14} />
                </Btn>
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div style={{ padding: spacing['5'] }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginBottom: spacing['5'] }}>
                {[
                  { label: 'Recipient', value: recipientName },
                  { label: 'Pay App', value: `#${applicationNumber}` },
                  { label: 'Payment Amount', value: fmtDollars(amount) },
                  { label: 'Processing Fee', value: fmtCurrency(fee) },
                  { label: 'Total Charge', value: fmtCurrency(totalAmount), bold: true },
                  { label: 'Method', value: PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.label || '' },
                ].map((row) => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: `${spacing['2.5']} 0`, borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{row.label}</span>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      color: row.bold ? colors.textPrimary : colors.textSecondary,
                      fontWeight: row.bold ? typography.fontWeight.bold : typography.fontWeight.medium,
                    }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {retainageAmount > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: spacing['3'], backgroundColor: colors.statusInfoSubtle,
                  borderRadius: borderRadius.base, marginBottom: spacing['4'],
                }}>
                  <Shield size={14} color={colors.statusInfo} />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.statusInfo }}>
                    {fmtDollars(retainageAmount)} retainage will be held in escrow
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
                <Btn variant="ghost" onClick={() => setStep('method')}>Back</Btn>
                <Btn onClick={handleConfirm}>
                  <CheckCircle size={14} /> Confirm Payment
                </Btn>
              </div>
            </div>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div style={{ padding: spacing['8'], textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, margin: '0 auto', marginBottom: spacing['4'],
                border: `3px solid ${colors.borderDefault}`, borderTopColor: colors.primaryOrange,
                borderRadius: '50%', animation: 'paymentSpin 0.8s linear infinite',
              }} />
              <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Processing Payment...
              </p>
              <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                {fmtDollars(amount)} to {recipientName}
              </p>
              <style>{`@keyframes paymentSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div style={{ padding: spacing['8'], textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                backgroundColor: colors.statusActiveSubtle, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto', marginBottom: spacing['4'],
              }}>
                <CheckCircle size={28} color={colors.statusActive} />
              </div>
              <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Payment Sent
              </p>
              <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                {fmtDollars(amount)} sent to {recipientName} via {PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.label}
              </p>
              <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                A conditional lien waiver has been automatically generated.
              </p>
              <div style={{ marginTop: spacing['5'] }}>
                <Btn onClick={handleClose}>Done</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  },
)

PaySubFlow.displayName = 'PaySubFlow'
