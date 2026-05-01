/**
 * AutoCoApprovalGate
 *
 * Lives near the top of the RFI detail view. When an RFI's answer was
 * auto-classified as a scope change, this panel surfaces the drafted CO so
 * the PM can review/approve/reject in one tap — instead of finding it three
 * weeks later in the monthly review with the owner.
 *
 * The component is presentational. The parent fetches the relevant
 * `change_orders` row + the matching `drafted_actions` row and passes them
 * in. onOpenCo handles navigation; onApprove/onReject hit the existing CO
 * mutations the page already wires up.
 *
 * Ships with a tasteful empty state — when no draft exists, the parent
 * should hide the gate entirely (visible=false).
 */

import React from 'react'
import { Sparkles, ArrowUpRight, Check, X, AlertTriangle } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { Btn } from '../Primitives'
import { Eyebrow, OrangeDot } from '../atoms'
import type { ScopeChangeKind, ScopeConfidence } from '../../types/coAutoDraft'

export interface AutoCoApprovalGateProps {
  /** false → render nothing. */
  visible?: boolean
  coId: string
  coNumber?: number | null
  coTitle: string
  coNarrative?: string | null
  /** Null when cost_database had no matches. UI surfaces "cost not estimated". */
  estimatedCost: number | null
  scheduleImpactDays?: number
  kind: ScopeChangeKind
  confidence: ScopeConfidence
  /** When the cost is null, the provenance string explains why. */
  costProvenance?: string
  /** Permissions: only roles with change_orders.create see this gate at all,
   *  but we still render disabled controls when interactive=false to keep the
   *  audit-context visible. */
  interactive?: boolean
  onOpenCo: () => void
  onApprove: () => void
  onReject: (reason: string) => void
}

const KIND_LABEL: Record<ScopeChangeKind, string> = {
  material_substitution: 'Material substitution',
  quantity_change: 'Quantity change',
  new_scope_element: 'New scope element',
  sequence_change: 'Sequence / relocation',
  detail_change: 'Detail change',
  no_change: 'No change',
}

function confidenceTone(c: ScopeConfidence): { label: string; color: string } {
  if (c === 'high')   return { label: 'High confidence',   color: colors.statusActive }
  if (c === 'medium') return { label: 'Medium confidence', color: colors.statusPending }
  return { label: 'Low confidence', color: colors.ink3 }
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export const AutoCoApprovalGate: React.FC<AutoCoApprovalGateProps> = ({
  visible = true,
  coId: _coId,
  coNumber,
  coTitle,
  coNarrative,
  estimatedCost,
  scheduleImpactDays = 0,
  kind,
  confidence,
  costProvenance,
  interactive = true,
  onOpenCo,
  onApprove,
  onReject,
}) => {
  if (!visible) return null

  const tone = confidenceTone(confidence)
  const costMissing = estimatedCost == null

  return (
    <section
      role="region"
      aria-label="Auto-drafted change order"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['3'],
        padding: `${spacing['4']} ${spacing['4']}`,
        backgroundColor: 'var(--color-primary-subtle)',
        border: '1px solid var(--color-primary-light)',
        borderRadius: 12,
        marginBottom: spacing['4'],
      }}
    >
      {/* ── Header row ──────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
        <OrangeDot size={9} haloSpread={4} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={11} aria-hidden="true" />
            Iris detected a scope change
          </Eyebrow>
          <h3
            style={{
              margin: `${spacing['1']} 0 0`,
              fontFamily: typography.fontFamilySerif,
              fontSize: 22,
              fontWeight: 400,
              color: colors.ink,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            {coTitle}
          </h3>
          {coNarrative && (
            <p
              style={{
                margin: `${spacing['1.5']} 0 0`,
                fontFamily: typography.fontFamilySerif,
                fontSize: 15,
                lineHeight: 1.55,
                color: colors.ink2,
                maxWidth: 620,
              }}
            >
              {coNarrative}
            </p>
          )}
        </div>
        {coNumber != null && (
          <button
            type="button"
            onClick={onOpenCo}
            aria-label={`Open Change Order #${coNumber}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: `4px 10px`,
              backgroundColor: 'var(--color-surfaceRaised, #FFFFFF)',
              border: '1px solid var(--hairline)',
              borderRadius: 999,
              fontFamily: typography.fontFamily,
              fontSize: 11,
              fontWeight: typography.fontWeight.medium,
              color: colors.ink,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            CO #{coNumber}
            <ArrowUpRight size={11} />
          </button>
        )}
      </div>

      {/* ── Stats row ──────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing['4'],
          rowGap: spacing['2'],
          fontFamily: typography.fontFamily,
          fontSize: 13,
          color: colors.ink2,
        }}
      >
        <Stat
          label="Estimated cost"
          value={costMissing ? '—' : formatUsd(estimatedCost as number)}
          valueColor={costMissing ? colors.ink3 : colors.ink}
          hint={costMissing ? (costProvenance ?? 'cost_database had no match') : costProvenance}
        />
        <Stat
          label="Schedule impact"
          value={scheduleImpactDays === 0 ? '0 days' : `${scheduleImpactDays > 0 ? '+' : ''}${scheduleImpactDays}d`}
          valueColor={colors.ink}
        />
        <Stat
          label="Kind"
          value={KIND_LABEL[kind]}
          valueColor={colors.ink}
        />
        <Stat
          label="Confidence"
          value={tone.label}
          valueColor={tone.color}
        />
      </div>

      {costMissing && (
        <div
          role="note"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: typography.fontFamily,
            fontSize: 12,
            color: colors.statusPending,
          }}
        >
          <AlertTriangle size={12} />
          Cost was not estimated automatically. Review and price manually before sending to owner.
        </div>
      )}

      {/* ── Action row ──────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: spacing['2'],
          flexWrap: 'wrap',
          paddingTop: spacing['2'],
          borderTop: '1px solid var(--hairline)',
        }}
      >
        <Btn
          variant="primary"
          size="sm"
          onClick={onApprove}
          disabled={!interactive}
          icon={<Check size={14} />}
        >
          Approve & open
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => onReject('Rejected from RFI gate')}
          disabled={!interactive}
          icon={<X size={14} />}
        >
          Not a CO
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          onClick={onOpenCo}
          disabled={!interactive}
        >
          Edit before sending
        </Btn>
      </div>
    </section>
  )
}

const Stat: React.FC<{
  label: string
  value: string
  valueColor: string
  hint?: string
}> = ({ label, value, valueColor, hint }) => (
  <div title={hint} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span
      style={{
        fontSize: 10,
        fontWeight: typography.fontWeight.semibold,
        color: colors.ink3,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: 14,
        fontWeight: typography.fontWeight.medium,
        color: valueColor,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </span>
  </div>
)
