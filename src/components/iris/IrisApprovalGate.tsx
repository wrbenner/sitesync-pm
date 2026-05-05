/**
 * IrisApprovalGate — the one-click approve/reject UI primitive for a
 * single drafted action. This is the visual "AI super hands you a draft;
 * you stamp it" moment that sells the product.
 *
 * Design intent (Jobs / Ive):
 *   • Confidence dot + draft title visible at a glance
 *   • Citations (why Iris drafted this) stay collapsed by default —
 *     "Why?" expands them. Don't overwhelm the user.
 *   • Approve is a saturated brand orange (this is the action). Reject
 *     is ghosted (this is the escape hatch). They are not equally weighted.
 *   • The whole card is keyboard-navigable; Enter approves, Escape rejects.
 */

import React, { useState } from 'react'
import { Sparkles, Check, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useRecordDraftView } from '../../hooks/useRecordDraftView'
import { useOpenCitationPanel } from '../../hooks/useOpenCitationPanel'
import { isCitationKind } from '../../lib/iris/citationRouting'
import type { DraftedAction } from '../../types/draftedActions'

type DecisionMethod = 'keyboard' | 'mouse' | 'voice' | 'unknown'

/**
 * Mouse vs keyboard detection. A `<button>` activated by Enter/Space
 * fires a synthetic click whose MouseEvent.detail is 0 (no click count).
 * Real mouse clicks set detail >= 1. This is the cheapest reliable
 * signal — no separate keyboard handlers, no global focus tracking.
 */
function detectDecisionMethod(event: React.MouseEvent<HTMLButtonElement>): DecisionMethod {
  return event.detail === 0 ? 'keyboard' : 'mouse'
}

/** Fire-and-forget telemetry. Errors are silently swallowed — never block the user. */
function recordDecisionTelemetry(
  draftId: string,
  method: DecisionMethod,
  requiredEdits: boolean,
): void {
  if (!isSupabaseConfigured) return
  // Synthetic drafts (e.g. IrisSuggestionCard) use a non-uuid id like
  // "synthetic:..." — skip telemetry rather than fail the RPC's uuid cast.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draftId)) return
  void supabase.rpc('record_draft_decision', {
    p_draft_id: draftId,
    p_decision_method: method,
    p_required_edits: requiredEdits,
  })
}

export interface IrisApprovalGateProps {
  draft: DraftedAction
  onApprove: (draft: DraftedAction) => void | Promise<void>
  onReject: (draft: DraftedAction) => void | Promise<void>
  /** Disabled while a decision is in flight. */
  busy?: boolean
}

export const ACTION_LABELS: Record<DraftedAction['action_type'], string> = {
  'rfi.draft': 'RFI',
  'daily_log.draft': 'Daily log',
  'pay_app.draft': 'Pay app',
  'punch_item.draft': 'Punch item',
  'schedule.resequence': 'Schedule resequence',
  'submittal.transmittal_draft': 'Submittal transmittal',
}

function confidenceTone(c: number): { fg: string; bg: string; label: string } {
  if (c >= 0.85) return { fg: colors.statusActive, bg: colors.statusActiveSubtle, label: 'High confidence' }
  if (c >= 0.6) return { fg: colors.statusInfo, bg: colors.statusInfoSubtle, label: 'Medium confidence' }
  return { fg: colors.statusPending, bg: colors.statusPendingSubtle, label: 'Needs review' }
}

export const IrisApprovalGate: React.FC<IrisApprovalGateProps> = ({
  draft,
  onApprove,
  onReject,
  busy = false,
}) => {
  const [expanded, setExpanded] = useState(false)
  // Lap 3 will wire an inline edit panel that flips this true. Today the
  // value is always false; the column exists so the gate can record it
  // honestly the moment edit-then-approve ships.
  const [editsApplied] = useState(false)
  const tone = confidenceTone(draft.confidence)
  const actionLabel = ACTION_LABELS[draft.action_type]

  // Records first_viewed_at when the card scrolls into view (≥ 50% visible).
  const recordViewRef = useRecordDraftView(draft.id)
  const openCitationPanel = useOpenCitationPanel()

  const handleApprove = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const method = detectDecisionMethod(event)
    try {
      await onApprove(draft)
    } catch (err) {
      // Don't record telemetry for a decision that didn't land.
      throw err
    }
    recordDecisionTelemetry(draft.id, method, editsApplied)
  }

  const handleReject = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const method = detectDecisionMethod(event)
    try {
      await onReject(draft)
    } catch (err) {
      throw err
    }
    recordDecisionTelemetry(draft.id, method, editsApplied)
  }

  return (
    <article
      ref={recordViewRef}
      role="article"
      aria-label={`Iris drafted ${actionLabel}: ${draft.title}`}
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        padding: spacing['5'],
        boxShadow: shadows.base,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['3'],
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
        <div
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: borderRadius.full,
            background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.brand300})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Sparkles size={14} color={colors.white} />
        </div>
        <span style={{
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Iris drafted · {actionLabel}
        </span>
        <span
          title={tone.label}
          style={{
            padding: `2px ${spacing['2']}`,
            borderRadius: borderRadius.full,
            backgroundColor: tone.bg,
            color: tone.fg,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(draft.confidence * 100)}%
        </span>
      </div>

      {/* Title */}
      <h3 style={{
        margin: 0,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        lineHeight: 1.35,
      }}>
        {draft.title}
      </h3>

      {/* Summary */}
      {draft.summary && (
        <p style={{
          margin: 0,
          fontSize: typography.fontSize.sm,
          color: colors.textSecondary,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
        }}>
          {draft.summary}
        </p>
      )}

      {/* Why? expander */}
      {draft.citations.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['1'],
              padding: 0,
              background: 'transparent',
              border: 'none',
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
            }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Why Iris drafted this ({draft.citations.length} {draft.citations.length === 1 ? 'reason' : 'reasons'})
          </button>
          {expanded && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: `${spacing['2']} 0 0 0`,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing['2'],
              }}
            >
              {draft.citations.map((c, i) => {
                const clickable = isCitationKind(c.kind) && !!c.ref
                const handleClick = () => {
                  if (!clickable || !isCitationKind(c.kind)) return
                  openCitationPanel(draft.id, i, c.kind)
                }
                return (
                  <li
                    key={i}
                    style={{
                      padding: 0,
                      listStyle: 'none',
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleClick}
                      disabled={!clickable}
                      aria-label={
                        clickable
                          ? `Open citation: ${c.label}`
                          : `Citation: ${c.label} (no source link)`
                      }
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: spacing['2'],
                        backgroundColor: colors.surfaceInset,
                        borderRadius: borderRadius.base,
                        border: `1px solid transparent`,
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        fontFamily: typography.fontFamily,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: spacing['1'],
                        cursor: clickable ? 'pointer' : 'default',
                        transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!clickable) return
                        e.currentTarget.style.borderColor = colors.primaryOrange
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent'
                      }}
                    >
                      <span
                        style={{
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                        }}
                      >
                        {c.label}
                        {clickable && (
                          <span
                            aria-hidden
                            style={{
                              marginLeft: 6,
                              fontSize: typography.fontSize.caption,
                              color: colors.primaryOrange,
                              fontWeight: typography.fontWeight.semibold,
                            }}
                          >
                            ↗
                          </span>
                        )}
                      </span>
                      {c.snippet && (
                        <span style={{ fontStyle: 'italic', color: colors.textTertiary }}>
                          "{c.snippet}"
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Action row */}
      <div style={{
        display: 'flex',
        gap: spacing['2'],
        marginTop: spacing['1'],
        borderTop: `1px solid ${colors.borderSubtle}`,
        paddingTop: spacing['3'],
      }}>
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy}
          aria-label="Approve and execute this drafted action"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing['1'],
            padding: `${spacing['2']} ${spacing['4']}`,
            backgroundColor: busy ? colors.surfaceDisabled : colors.primaryOrange,
            color: busy ? colors.textDisabled : colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          <Check size={14} /> Approve & send
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={busy}
          aria-label="Reject this drafted action"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing['1'],
            padding: `${spacing['2']} ${spacing['4']}`,
            backgroundColor: 'transparent',
            color: colors.textSecondary,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          <X size={14} /> Reject
        </button>
        {draft.executed_resource_id && (
          <a
            href={`#/${draft.executed_resource_type}s/${draft.executed_resource_id}`}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['1'],
              padding: `${spacing['2']} ${spacing['3']}`,
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              textDecoration: 'none',
            }}
          >
            View created <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  )
}

export default IrisApprovalGate
